"""
agent_main.py — Voltera Agent entry point
Runs on each agent PC. Records calls and uploads them to the central server.
Started automatically by Task Scheduler on login (via pythonw.exe, silent).
"""

import logging
import os
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# ── Auto-install missing packages ─────────────────────────────────────────────
_req_file = Path(__file__).parent / "requirements_agent.txt"
if _req_file.exists():
    _python = sys.executable if "python.exe" in sys.executable.lower() else str(Path(sys.executable).parent / "python.exe")
    subprocess.run(
        [_python, "-m", "pip", "install", "-r", str(_req_file), "--quiet"],
        check=False,
    )

from dotenv import load_dotenv

# ── Paths & env ────────────────────────────────────────────────────────────────
# Load .env before importing uploader/config so SERVER_URL is available.

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

from config import SERVER_URL     # noqa: E402 — must come after load_dotenv
from recorder import CallRecorder # noqa: E402
from uploader import upload_call  # noqa: E402  (start_pending_retry runs automatically on import)

AGENT_ID = os.getenv("AGENT_ID", socket.gethostname())

# ── Logging ────────────────────────────────────────────────────────────────────
# Absolute path so the log is always next to agent_main.py regardless of cwd.
# No StreamHandler — sys.stdout is None under pythonw.exe (no console window).

_log_path = BASE_DIR / "agent.log"

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


# ── Callback ───────────────────────────────────────────────────────────────────

def handle_call(wav_path: str, timestamp: str, duration: float) -> None:
    """Called by recorder.py after every valid call. Passes .wav to uploader."""
    logger.info("[%s] Call complete — uploading: %s (%.1fs)", AGENT_ID, wav_path, duration)
    upload_call(wav_path, duration)


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info("=" * 55)
    logger.info("Voltera Agent started")
    logger.info("  Agent ID  : %s", AGENT_ID)
    logger.info("  Server    : %s", SERVER_URL)
    logger.info("  Log       : %s", _log_path)
    logger.info("  Started   : %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("=" * 55)

    # uploader.py already retries any pending files from previous sessions on import.

    try:
        recorder = CallRecorder()
        recorder.start(handle_call)
    except KeyboardInterrupt:
        logger.info("Agent stopped by user.")
    except Exception:
        logger.exception("Agent crashed — Task Scheduler will restart.")
        raise

        raise
