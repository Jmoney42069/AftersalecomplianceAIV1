import logging
from pathlib import Path

from faster_whisper import WhisperModel

from config import WHISPER_MODEL, WHISPER_LANGUAGE

logger = logging.getLogger(__name__)

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info("Loading Whisper model '%s' (CPU, int8)...", WHISPER_MODEL)
        _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        logger.info("Whisper model loaded.")
    return _model


def transcribe(wav_path: str | Path) -> str:
    """Transcribe a .wav file. Returns full transcript or empty string on failure."""
    try:
        model = _get_model()
        segments, info = model.transcribe(
            str(wav_path),
            language=WHISPER_LANGUAGE,
            vad_filter=True,
        )
        transcript = " ".join(seg.text.strip() for seg in segments)

        logger.info(
            "Detected language '%s' with confidence %.2f",
            info.language,
            info.language_probability,
        )
        logger.info("Transcription complete: %d characters", len(transcript))
        return transcript

    except Exception:
        logger.exception("Transcription failed for %s", wav_path)
        return ""
