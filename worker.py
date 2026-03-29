"""
worker.py — Voltera Compliance Checker pipeline worker
Consumes upload_queue from server.py and runs the full pipeline per call:
  transcribe → compliance → upload to Supabase → save DB row → email alert

Import from server.py and call start_workers() after Flask app is created:
    import worker; worker.start_workers()
"""

import json
import logging
import shutil
import threading
from datetime import datetime
from pathlib import Path

# ── Shared state (injected by server.py via start_workers) ───────────────────
# Do NOT import server here — when run as 'python server.py', that module is
# registered as '__main__', so 'import server' would load a second copy with a
# fresh queue. Instead, server.py passes its own objects directly.
import queue as _queue_module

_upload_queue: _queue_module.Queue = _queue_module.Queue()  # replaced by start_workers
workers_busy: int = 0
workers_busy_lock: threading.Lock = threading.Lock()


def _queue() -> _queue_module.Queue:
    return _upload_queue

# ── Pipeline imports (unchanged from single-PC version) ───────────────────────
from transcriber import transcribe
from compliance import check_compliance
from storage import upload_audio, save_call, update_compliance
from emailer import send_report

logger = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────

NUM_WORKERS = 2  # concurrent Whisper threads — raise only if RAM allows
MAX_RETRIES = 3  # max times a crashed file is re-queued before giving up

BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"

# State folders — worker moves files through these to track progress
PENDING_DIR    = UPLOADS_DIR / "pending"
PROCESSING_DIR = UPLOADS_DIR / "processing"
DONE_DIR       = UPLOADS_DIR / "done"
FAILED_DIR     = UPLOADS_DIR / "failed"

for _d in (PENDING_DIR, PROCESSING_DIR, DONE_DIR, FAILED_DIR):
    _d.mkdir(parents=True, exist_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _increment_workers() -> None:
    global workers_busy
    with workers_busy_lock:
        workers_busy += 1


def _decrement_workers() -> None:
    global workers_busy
    with workers_busy_lock:
        workers_busy = max(0, workers_busy - 1)


def _move(src: Path, dst_dir: Path) -> Path:
    """Move src into dst_dir, return new path. Silently skip if src gone."""
    dst = dst_dir / src.name
    try:
        shutil.move(str(src), str(dst))
    except FileNotFoundError:
        logger.warning("Tried to move %s but it no longer exists", src.name)
    return dst


# ── Startup recovery ───────────────────────────────────────────────────────────

def _recover_stuck_files() -> None:
    """
    On server startup, clean up all leftover files from previous run.
    Files in uploads/, pending/ and processing/ are deleted — they are old
    uploads from a previous session and should not be reprocessed on restart.
    """
    for folder, label in (
        (UPLOADS_DIR, "uploads"),
        (PENDING_DIR, "pending"),
        (PROCESSING_DIR, "processing"),
    ):
        leftover = [f for f in folder.iterdir() if f.is_file()]
        if leftover:
            logger.warning("Startup cleanup: verwijder %d oud(e) bestanden uit %s/", len(leftover), label)
            for f in leftover:
                try:
                    f.unlink()
                except Exception:
                    pass


# ── Pipeline ───────────────────────────────────────────────────────────────────

def process_call(item: dict) -> None:
    """
    Full compliance pipeline for one call.
    item keys: wav_path, agent_id, duration, timestamp

    File state machine:
      server writes to uploads/  (flat)
      worker moves  to pending/  (ready to process)
      worker moves  to processing/ (being transcribed)
      worker moves  to done/ or failed/ (finished)
    """
    wav_path    = Path(item["wav_path"])
    agent_id    = item.get("agent_id", "unknown")
    duration    = float(item.get("duration", 0))
    timestamp   = item.get("timestamp", datetime.now().strftime("%Y%m%d_%H%M%S"))

    # Files from /upload land in UPLOADS_DIR (flat). Move to pending/ first.
    if wav_path.parent == UPLOADS_DIR:
        wav_path = _move(wav_path, PENDING_DIR)

    if not wav_path.exists():
        logger.error("[%s] wav file missing before processing: %s", agent_id, wav_path)
        return

    # Als duration 0 is, lees het uit het WAV bestand zelf
    if duration <= 0:
        try:
            import wave as _wave
            with _wave.open(str(wav_path), "rb") as _wf:
                duration = _wf.getnframes() / _wf.getframerate()
            logger.info("[%s] Duration uit WAV bestand gelezen: %.1fs", agent_id, duration)
        except Exception:
            logger.warning("[%s] Kon duration niet uit WAV lezen", agent_id)

    logger.info("=== Pipeline start: agent=%s ts=%s dur=%.1fs ===", agent_id, timestamp, duration)

    processing_path = _move(wav_path, PROCESSING_DIR)
    if not processing_path.exists():
        logger.error("[%s] Move naar processing/ mislukt — bestand verdwenen: %s", agent_id, wav_path.name)
        return
    _increment_workers()

    try:
        # ── Step 1: Transcribe ─────────────────────────────────────────────────
        try:
            transcript = transcribe(str(processing_path))
        except Exception:
            logger.exception("[%s] Transcription failed", agent_id)
            _move(processing_path, FAILED_DIR)
            return

        if not transcript:
            logger.warning("[%s] Transcription returned empty — moving to failed", agent_id)
            _move(processing_path, FAILED_DIR)
            return

        # ── Step 2: Compliance check ───────────────────────────────────────────
        try:
            report = check_compliance(transcript)
        except Exception:
            logger.exception("[%s] Compliance check raised an exception", agent_id)
            _move(processing_path, FAILED_DIR)
            return

        if report.get("algemeen_oordeel") == "FOUT":
            logger.warning("[%s] Compliance check returned FOUT: %s", agent_id, report.get("error"))
            # Still attempt to save partial result — don't discard the transcript
            # Fall through to storage so the call is at least visible in the dashboard

        # ── Step 3: Audio opslag — alleen lokaal, niet naar Supabase ─────────────
        file_url = None  # audio wordt niet geüpload naar Supabase
        logger.info("[%s] Audio bewaard lokaal: %s", agent_id, processing_path)
        # Verplaats terug naar uploads/ zodat processing/ leeg blijft
        _move(processing_path, UPLOADS_DIR)

        # ── Step 4: Save call row ──────────────────────────────────────────────
        try:
            call_ts = datetime.strptime(timestamp, "%Y%m%d_%H%M%S")
        except ValueError:
            call_ts = datetime.now()

        try:
            call_id = save_call(call_ts, timestamp, file_url, duration, transcript, agent_id)
        except Exception:
            logger.exception("[%s] save_call raised an exception", agent_id)
            return  # file already gone (uploaded), nothing left to move

        if not call_id:
            logger.warning("[%s] save_call returned None", agent_id)
            return

        # ── Step 5: Update compliance ──────────────────────────────────────────
        try:
            update_compliance(call_id, report)
        except Exception:
            logger.exception("[%s] update_compliance raised an exception", agent_id)
            # Non-fatal: call is already saved, just missing the report

        # ── Step 6: Email alert ────────────────────────────────────────────────
        try:
            send_report(timestamp, transcript, report)
        except Exception:
            logger.exception("[%s] send_report raised an exception", agent_id)
            # Non-fatal: compliance data is saved, email is best-effort

        logger.info(
            "=== Pipeline complete: agent=%s ts=%s → %s ===",
            agent_id, timestamp, report.get("algemeen_oordeel", "?"),
        )

    except Exception:
        logger.exception("[%s] Unhandled error in process_call", agent_id)
        if processing_path.exists():
            _move(processing_path, FAILED_DIR)
        else:
            logger.info("[%s] File already uploaded — no local file to move to failed/", agent_id)

    finally:
        # Clean up sidecar JSON
        for candidate in (Path(item["wav_path"]).with_suffix('.json'),):
            candidate.unlink(missing_ok=True)
        _decrement_workers()
        _queue().task_done()


# ── Worker thread loop ─────────────────────────────────────────────────────────

def _worker_loop(worker_id: int) -> None:
    logger.info("Worker %d started", worker_id)
    while True:
        try:
            item = _queue().get()  # blocks until a job is available
            process_call(item)
        except Exception:
            logger.exception("Worker %d: unhandled exception in loop — continuing", worker_id)
            # Never let the thread die — log and loop back


# ── Public API ─────────────────────────────────────────────────────────────────

def start_workers(queue: _queue_module.Queue) -> None:
    """
    Called from server.py after Flask app is created.
    server.py passes its own upload_queue directly to avoid the __main__ vs
    'server' module double-import problem.
    """
    global _upload_queue
    _upload_queue = queue

    _recover_stuck_files()

    for i in range(1, NUM_WORKERS + 1):
        t = threading.Thread(target=_worker_loop, args=(i,), daemon=True, name=f"worker-{i}")
        t.start()
        logger.info("Worker %d spawned", i)

    logger.info("Worker pool ready (%d threads)", NUM_WORKERS)
