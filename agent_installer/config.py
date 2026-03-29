"""
config.py — Agent-side configuration (stripped version)
Only contains what the agent PC needs: audio settings + server URL.
No Whisper, no Supabase, no AI keys.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Paths
BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")

RECORDINGS_DIR = BASE_DIR / "recordings"
RECORDINGS_DIR.mkdir(exist_ok=True)

# Audio
SAMPLE_RATE = 16000
CHANNELS = 1
FRAME_DURATION_MS = 30

# Input apparaat — None = standaard microfoon
# Zet op een naam of index om een ander apparaat te gebruiken, bijv:
#   AUDIO_DEVICE = "Stereo Mix"
#   AUDIO_DEVICE = "CABLE Output"
# Voer 'python -c "import sounddevice as sd; print(sd.query_devices())"' uit om alle apparaten te zien.
AUDIO_DEVICE = os.getenv("AUDIO_DEVICE") or None

# Call detection
SILENCE_TIMEOUT_SEC = 30
MIN_CALL_DURATION_SEC = 300  # minimale gespreksduur in seconden
MAX_CALL_DURATION_SEC = 60 * 90  # 90 minutes hard cap

# Server
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:5000")
