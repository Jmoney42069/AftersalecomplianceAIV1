"""
uploader.py — Voltera Compliance Checker agent-side uploader
Called by recorder.py after every completed call.
POSTs .wav to the central server. If that fails, stores locally and retries
in a background thread so the recorder is never blocked.
"""

import logging
import shutil
import socket
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
import os

# ── Paths & config ─────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

SERVER_URL    = os.getenv("SERVER_URL", "http://localhost:5000")
PENDING_DIR   = BASE_DIR / "pending_uploads"
PENDING_DIR.mkdir(exist_ok=True)

AGENT_ID      = os.getenv("AGENT_ID") or socket.gethostname()
RETRY_DELAYS  = [0, 60, 120, 300, 600]   # seconds between attempts; last value repeats
UPLOAD_TIMEOUT = 120                      # seconds — generous for large .wav files

logger = logging.getLogger(__name__)


# ── Core upload ────────────────────────────────────────────────────────────────

def _do_upload(wav_path: Path, duration: float) -> bool:
    """
    POST wav_path to SERVER_URL/upload.
    Returns True on HTTP 200, False on any error.
    Does NOT delete the file — caller decides based on return value.
    """
    try:
        with open(wav_path, "rb") as f:
            resp = requests.post(
                f"{SERVER_URL}/upload",
                files={"file": (wav_path.name, f, "audio/wav")},
                data={"agent_id": AGENT_ID, "duration": str(duration)},
                timeout=UPLOAD_TIMEOUT,
            )

        if resp.status_code == 200:
            logger.info("[%s] Upload success: %s (server queue depth: %s)",
                        AGENT_ID, wav_path.name, resp.json().get("queue_depth", "?"))
            return True

        if resp.status_code == 429:
            logger.warning("[%s] Server busy (429) for %s — will retry", AGENT_ID, wav_path.name)
        else:
            logger.warning("[%s] Upload failed HTTP %d for %s", AGENT_ID, resp.status_code, wav_path.name)

        return False

    except requests.exceptions.ConnectionError:
        logger.warning("[%s] Cannot reach server (%s) for %s", AGENT_ID, SERVER_URL, wav_path.name)
        return False
    except requests.exceptions.Timeout:
        logger.warning("[%s] Upload timed out for %s", AGENT_ID, wav_path.name)
        return False
    except Exception:
        logger.exception("[%s] Unexpected error uploading %s", AGENT_ID, wav_path.name)
        return False


# ── Retry with backoff ─────────────────────────────────────────────────────────

def _retry_with_backoff(wav_path: Path, duration: float) -> None:
    """
    Daemon thread: keeps retrying upload until success.
    Uses RETRY_DELAYS list; after exhausting the list repeats the last value.
    Deletes the file from pending_uploads/ on success.
    """
    delays = RETRY_DELAYS.copy()

    for attempt, delay in enumerate(delays, start=1):
        if delay > 0:
            logger.info("[%s] Retry attempt %d for %s — waiting %ds",
                        AGENT_ID, attempt, wav_path.name, delay)
            time.sleep(delay)

        if _do_upload(wav_path, duration):
            try:
                wav_path.unlink()
                logger.info("[%s] Pending file removed after successful retry: %s",
                            AGENT_ID, wav_path.name)
            except FileNotFoundError:
                pass
            return

    # Exhausted defined delays — keep retrying at max interval forever
    attempt = len(delays)
    max_delay = delays[-1]
    while True:
        attempt += 1
        logger.info("[%s] Retry attempt %d for %s — waiting %ds (max interval)",
                    AGENT_ID, attempt, wav_path.name, max_delay)
        time.sleep(max_delay)

        if _do_upload(wav_path, duration):
            try:
                wav_path.unlink()
                logger.info("[%s] Pending file removed after retry: %s", AGENT_ID, wav_path.name)
            except FileNotFoundError:
                pass
            return


def _start_retry_thread(wav_path: Path, duration: float) -> None:
    t = threading.Thread(
        target=_retry_with_backoff,
        args=(wav_path, duration),
        daemon=True,
        name=f"retry-{wav_path.stem}",
    )
    t.start()


# ── Startup: retry any pending files from previous session ─────────────────────

def start_pending_retry() -> None:
    """
    Called on import. Finds any .wav files left in pending_uploads/
    from a previous failed session and starts retry threads for them.
    Duration is unknown for old pending files — send 0.0 as placeholder.
    """
    pending = list(PENDING_DIR.glob("*.wav"))
    if not pending:
        return

    logger.info("[%s] Found %d pending file(s) from previous session — retrying",
                AGENT_ID, len(pending))
    for wav in pending:
        logger.info("[%s] Queuing retry for: %s", AGENT_ID, wav.name)
        _start_retry_thread(wav, duration=0.0)


# ── Public API ─────────────────────────────────────────────────────────────────

def upload_call(wav_path: str, duration: float) -> None:
    """
    Main entry point. Called by recorder.py / main.py after every call.
    Tries an immediate upload. On success, deletes the .wav.
    On failure, copies to pending_uploads/ and starts a background retry thread.
    Never blocks — returns immediately regardless of outcome.
    """
    path = Path(wav_path)

    if not path.exists():
        logger.error("[%s] upload_call: file not found: %s", AGENT_ID, wav_path)
        return

    logger.info("[%s] Uploading: %s (%.1fs)", AGENT_ID, path.name, duration)

    if _do_upload(path, duration):
        try:
            path.unlink()
            logger.info("[%s] Local file deleted after upload: %s", AGENT_ID, path.name)
        except FileNotFoundError:
            pass
        return

    # Upload failed — store locally and retry in background
    pending_path = PENDING_DIR / path.name
    try:
        shutil.copy2(str(path), str(pending_path))
        logger.warning("[%s] Upload failed — saved to pending: %s", AGENT_ID, pending_path.name)
    except Exception:
        logger.exception("[%s] Could not copy to pending_uploads/ — call may be lost!", AGENT_ID)
        return

    _start_retry_thread(pending_path, duration)


# ── Auto-start pending retries on import ──────────────────────────────────────

start_pending_retry()
