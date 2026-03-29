"""
server.py — Voltera Compliance Checker central server
Receives .wav uploads from agent PCs, queues them for worker.py to process.

Run on the central (always-on) office PC:
    python server.py

Agent PCs POST to: http://<SERVER_IP>:5000/upload
"""

import json
import logging
import sys
import threading
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request

# ── Paths & env ────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

load_dotenv(BASE_DIR / ".env")

# ── Logging ────────────────────────────────────────────────────────────────────

_log_path = BASE_DIR / "server.log"
_handlers: list[logging.Handler] = [
    logging.FileHandler(_log_path, encoding="utf-8"),
]
if sys.stdout is not None:
    _handlers.append(logging.StreamHandler(sys.stdout))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=_handlers,
)
logger = logging.getLogger(__name__)

# ── Shared state ───────────────────────────────────────────────────────────────

# Queue consumed by worker.py — items are dicts with wav_path, agent_id, etc.
upload_queue: "queue.Queue[dict]" = None  # type: ignore[assignment]
try:
    import queue as _queue_module
    upload_queue = _queue_module.Queue()
except Exception as e:  # pragma: no cover
    logger.critical("Failed to create upload queue: %s", e)
    raise

MAX_CONCURRENT_UPLOADS = 5
_upload_counter = 0
_upload_counter_lock = threading.Lock()

# Incremented/decremented by worker.py around active pipeline processing
workers_busy = 0
workers_busy_lock = threading.Lock()

# ── Flask app ──────────────────────────────────────────────────────────────────

app = Flask(__name__)


def _increment_uploads() -> bool:
    """Increment active upload counter. Returns False if limit reached."""
    global _upload_counter
    with _upload_counter_lock:
        if _upload_counter >= MAX_CONCURRENT_UPLOADS:
            return False
        _upload_counter += 1
        return True


def _decrement_uploads() -> None:
    global _upload_counter
    with _upload_counter_lock:
        _upload_counter = max(0, _upload_counter - 1)


# ── POST /upload ───────────────────────────────────────────────────────────────

@app.route("/upload", methods=["POST"])
def upload():
    """
    Accepts multipart/form-data:
      - file:     .wav binary
      - agent_id: hostname string
      - duration: float (seconds)

    Writes to .tmp first, renames to .wav only on success.
    Queues metadata for worker.py.
    """

    # 1. Check concurrency limit
    if not _increment_uploads():
        logger.warning("Upload rejected — concurrency limit (%d) reached", MAX_CONCURRENT_UPLOADS)
        return jsonify({"error": "server busy, retry later"}), 429

    tmp_path = None
    wav_path = None

    try:
        # 2. Validate required fields
        if "file" not in request.files:
            return jsonify({"error": "missing field: file"}), 400

        agent_id = request.form.get("agent_id", "unknown").strip()
        duration_raw = request.form.get("duration", "0")

        try:
            duration = float(duration_raw)
        except ValueError:
            return jsonify({"error": "duration must be a float"}), 400

        wav_file = request.files["file"]

        if not wav_file.filename:
            return jsonify({"error": "empty filename"}), 400

        # 3. Build paths
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_agent_id = "".join(c for c in agent_id if c.isalnum() or c in "-_")[:32]
        base_name = f"{safe_agent_id}_{timestamp_str}"
        # Voeg microseconds toe als het bestand al bestaat (twee uploads in dezelfde seconde)
        if (UPLOADS_DIR / f"{base_name}.wav").exists() or (UPLOADS_DIR / f"{base_name}.tmp").exists():
            base_name = f"{safe_agent_id}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

        tmp_path = UPLOADS_DIR / f"{base_name}.tmp"
        wav_path = UPLOADS_DIR / f"{base_name}.wav"

        # 4. Write to .tmp (partial upload protection)
        logger.info("Receiving upload from agent=%s (%.1fs) → %s", agent_id, duration, tmp_path.name)
        wav_file.save(str(tmp_path))

        # 5. Validate size — reject obviously empty/corrupt files
        if tmp_path.stat().st_size < 1024:
            logger.warning("Upload from %s is suspiciously small (%d bytes) — rejecting",
                           agent_id, tmp_path.stat().st_size)
            tmp_path.unlink(missing_ok=True)
            return jsonify({"error": "file too small, likely corrupt"}), 400

        # 6. Rename .tmp → .wav (marks upload as complete)
        tmp_path.rename(wav_path)
        tmp_path = None  # prevent cleanup in finally block

        # 6b. Write sidecar JSON for crash-safe metadata recovery
        json_path = wav_path.with_suffix('.json')
        json_path.write_text(json.dumps({
            "agent_id": agent_id,
            "duration": duration,
            "timestamp": timestamp_str,
            "retries": 0,
        }), encoding="utf-8")

        # 7. Queue for worker
        job = {
            "wav_path": str(wav_path),
            "agent_id": agent_id,
            "duration": duration,
            "timestamp": timestamp_str,
            "retries": 0,
        }
        upload_queue.put(job)

        logger.info("Queued: %s (queue depth now %d)", wav_path.name, upload_queue.qsize())

        return jsonify({
            "status": "queued",
            "file": wav_path.name,
            "queue_depth": upload_queue.qsize(),
        }), 200

    except Exception as e:
        logger.exception("Unhandled error during upload from agent=%s: %s", agent_id if 'agent_id' in dir() else "?", e)
        return jsonify({"error": "internal server error"}), 500

    finally:
        _decrement_uploads()
        # Clean up .tmp if rename never happened (error mid-upload)
        if tmp_path is not None and tmp_path.exists():
            try:
                tmp_path.unlink()
                logger.debug("Cleaned up incomplete tmp file: %s", tmp_path.name)
            except OSError:
                pass


# ── GET /status ────────────────────────────────────────────────────────────────

@app.route("/status", methods=["GET"])
def status():
    """Returns current queue depth and active worker count."""
    with _upload_counter_lock:
        active_uploads = _upload_counter
    with workers_busy_lock:
        active_workers = workers_busy

    return jsonify({
        "queue_depth": upload_queue.qsize(),
        "active_uploads": active_uploads,
        "workers_busy": active_workers,
        "uploads_dir": str(UPLOADS_DIR),
    }), 200


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Voltera Compliance Server starting")
    logger.info("Uploads dir : %s", UPLOADS_DIR)
    logger.info("Log file    : %s", _log_path)
    logger.info("Port        : 5000")
    logger.info("=" * 60)

    import worker
    worker.start_workers(upload_queue)

    app.run(host="0.0.0.0", port=5000, debug=False)
