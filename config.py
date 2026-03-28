import os
from pathlib import Path
from dotenv import load_dotenv

# Paths
BASE_DIR = Path(__file__).parent

# Absolute path to .env: load_dotenv() with no argument searches from cwd,
# which under Task Scheduler is System32 — the .env file will never be found.
load_dotenv(BASE_DIR / ".env")
RECORDINGS_DIR = BASE_DIR / "recordings"
TRANSCRIPTS_DIR = BASE_DIR / "transcripts"

RECORDINGS_DIR.mkdir(exist_ok=True)
TRANSCRIPTS_DIR.mkdir(exist_ok=True)

# Audio
SAMPLE_RATE = 16000
CHANNELS = 1
FRAME_DURATION_MS = 30

# Call detection
SILENCE_TIMEOUT_SEC = 30
MIN_CALL_DURATION_SEC = 300  # minimale gespreksduur in seconden
MAX_CALL_DURATION_SEC = 60 * 90  # 90 minutes hard cap

# Whisper
WHISPER_MODEL = "small"
WHISPER_LANGUAGE = "nl"

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# AI
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Email
GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
EMAIL_TO = os.getenv("EMAIL_TO")
