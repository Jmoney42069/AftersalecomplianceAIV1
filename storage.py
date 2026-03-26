import logging
from datetime import datetime
from pathlib import Path

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

logger = logging.getLogger(__name__)

BUCKET = "recordings"
TABLE = "calls"

_supabase_client: Client | None = None


def _client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client


def upload_audio(wav_path: Path) -> str | None:
    """Upload .wav to Supabase Storage (public bucket).
    Returns public file_url or None on failure.
    Deletes local file after successful upload."""
    try:
        file_bytes = wav_path.read_bytes()
        destination = wav_path.name

        _client().storage.from_(BUCKET).upload(
            path=destination,
            file=file_bytes,
            file_options={"content-type": "audio/wav"},
        )

        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{destination}"
        wav_path.unlink()
        logger.info("Uploaded %s → %s", wav_path.name, public_url)
        return public_url

    except Exception:
        logger.exception("Failed to upload audio %s", wav_path)
        return None


def save_call(
    timestamp: datetime,
    timestamp_str: str,
    file_url: str,
    duration: float,
    transcript: str,
    agent_id: str | None = None,
) -> str | None:
    """Insert a new call row. Returns the generated call id or None on failure."""
    row = {
        "created_at": timestamp.isoformat(),
        "timestamp": timestamp_str,
        "file_url": file_url,
        "duration": duration,
        "transcript": transcript,
        "agent_id": agent_id,
    }

    try:
        result = _client().table(TABLE).insert(row).execute()
        call_id = result.data[0]["id"]
        logger.info("Saved call row id=%s (duration=%.1fs)", call_id, duration)
        return call_id

    except Exception:
        logger.exception("Failed to save call row")
        return None


def update_compliance(call_id: str, report: dict) -> bool:
    """Update an existing call row with AI compliance results.
    Returns True on success, False on failure."""
    algemeen_oordeel = report.get("algemeen_oordeel", "ONBEKEND")

    # Map any error/unknown value to a valid DB enum value
    VALID_RISK_LEVELS = {"GOEDGEKEURD", "AFGEKEURD", "ONBEKEND"}
    risk_level = algemeen_oordeel if algemeen_oordeel in VALID_RISK_LEVELS else "ONBEKEND"

    issues = {
        "productcombinatie": report.get("productcombinatie"),
        "prijs_en_voorwaarden": report.get("prijs_en_voorwaarden"),
        "akkoord_klant": report.get("akkoord_klant"),
        "verboden_claims": report.get("verboden_claims"),
        "rode_vlaggen": report.get("rode_vlaggen"),
    }

    update = {
        "compliant": algemeen_oordeel == "GOEDGEKEURD",
        "risk_level": risk_level,
        "summary": report.get("samenvatting"),
        "issues": issues,
        "compliance_report": report,
    }

    try:
        _client().table(TABLE).update(update).eq("id", call_id).execute()
        logger.info("Updated compliance for call id=%s → %s", call_id, algemeen_oordeel)
        return True

    except Exception:
        logger.exception("Failed to update compliance for call id=%s", call_id)
        return False
