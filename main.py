import logging
import socket
import sys
from datetime import datetime
from pathlib import Path

from compliance import check_compliance
from emailer import send_report
from recorder import CallRecorder
from storage import save_call, update_compliance, upload_audio
from transcriber import transcribe
from config import MIN_CALL_DURATION_SEC, SILENCE_TIMEOUT_SEC

AGENT_ID = socket.gethostname()

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("compliance.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger(__name__)

# ── Pipeline callback ──────────────────────────────────────────────────────────


def handle_call(wav_path: str, timestamp: str, duration: float) -> None:
    """Full compliance pipeline for one completed call.
    Runs in a daemon thread — every step is guarded so a failure never
    crashes the background process or blocks the recorder."""

    logger.info("=== Pipeline start: %s (%.1fs) ===", timestamp, duration)

    try:
        # 1. Transcribe
        transcript = transcribe(wav_path)
        if not transcript:
            logger.warning("[%s] Transcription returned empty — aborting pipeline", timestamp)
            return

        # 2. Upload audio to Supabase Storage (also deletes local .wav on success)
        file_url = upload_audio(Path(wav_path))
        if not file_url:
            logger.warning("[%s] Audio upload failed — aborting pipeline", timestamp)
            return

        # 3. Save call row to DB
        call_ts = datetime.strptime(timestamp, "%Y%m%d_%H%M%S")
        call_id = save_call(call_ts, timestamp, file_url, duration, transcript, AGENT_ID)
        if not call_id:
            logger.warning("[%s] Failed to save call row — aborting pipeline", timestamp)
            return

        # 4. Compliance check
        report = check_compliance(transcript)
        if report.get("algemeen_oordeel") == "FOUT":
            logger.warning("[%s] Compliance check failed: %s", timestamp, report.get("error"))
            # Still attempt to persist the failed report so the dashboard shows something
            update_compliance(call_id, report)
            return

        # 5. Persist compliance results
        update_compliance(call_id, report)

        # 6. Send email if needed (RISICO or AFGEKEURD)
        send_report(timestamp, transcript, report)

        logger.info(
            "=== Pipeline complete: %s → %s ===",
            timestamp,
            report.get("algemeen_oordeel"),
        )

    except Exception:
        logger.exception("Unhandled error in pipeline for call %s", timestamp)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  Voltera Voice Compliance Checker")
    logger.info("  Min call duration : %ds", MIN_CALL_DURATION_SEC)
    logger.info("  Silence timeout   : %ds", SILENCE_TIMEOUT_SEC)
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    try:
        recorder = CallRecorder()
        recorder.start(on_call_complete=handle_call)
    except KeyboardInterrupt:
        logger.info("Shutting down — KeyboardInterrupt received.")
