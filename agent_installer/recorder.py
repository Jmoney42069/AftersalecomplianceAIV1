import logging
import threading
import wave
from datetime import datetime

import numpy as np
import sounddevice as sd
import webrtcvad

from config import (
    CHANNELS,
    FRAME_DURATION_MS,
    MAX_CALL_DURATION_SEC,
    MIN_CALL_DURATION_SEC,
    RECORDINGS_DIR,
    SAMPLE_RATE,
    SILENCE_TIMEOUT_SEC,
)

logger = logging.getLogger(__name__)

FRAME_SIZE = int(SAMPLE_RATE * FRAME_DURATION_MS / 1000)
SILENCE_FRAMES_THRESHOLD = SILENCE_TIMEOUT_SEC * (1000 // FRAME_DURATION_MS)
MAX_FRAMES = MAX_CALL_DURATION_SEC * (1000 // FRAME_DURATION_MS)


class CallRecorder:
    def __init__(self):
        self._vad = webrtcvad.Vad(2)
        self._reset()

    def _reset(self):
        self._in_call = False
        self._call_frames: list[bytes] = []
        self._silence_frames = 0
        self._timestamp: str | None = None

    def start(self, on_call_complete: callable) -> None:
        """Start blocking mic loop. Calls on_call_complete(wav_path, timestamp, duration)
        in a daemon thread when a valid call ends. Blocks until KeyboardInterrupt."""

        logger.info("Recorder started — listening for speech...")

        def audio_callback(indata, frames, time_info, status):
            if status:
                logger.debug("sounddevice status: %s", status)

            frame_bytes = (indata[:, 0] * 32767).astype(np.int16).tobytes()

            try:
                is_speech = self._vad.is_speech(frame_bytes, SAMPLE_RATE)
            except Exception:
                logger.debug("VAD error — skipping frame")
                return

            if not self._in_call:
                if is_speech:
                    self._in_call = True
                    self._timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    self._call_frames = [frame_bytes]
                    self._silence_frames = 0
                    logger.info("Call detected — recording started (%s)", self._timestamp)
            else:
                self._call_frames.append(frame_bytes)

                if is_speech:
                    self._silence_frames = 0
                else:
                    self._silence_frames += 1

                if self._silence_frames >= SILENCE_FRAMES_THRESHOLD:
                    self._finalize_call(on_call_complete)
                elif len(self._call_frames) >= MAX_FRAMES:
                    logger.warning(
                        "Call %s hit max duration (%ds) — force closing",
                        self._timestamp, MAX_CALL_DURATION_SEC,
                    )
                    self._finalize_call(on_call_complete)

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="float32",
            blocksize=FRAME_SIZE,
            callback=audio_callback,
        ):
            logger.info("Listening on mic. Press Ctrl+C to stop.")
            threading.Event().wait()

    def _finalize_call(self, on_call_complete: callable) -> None:
        """Called from the audio callback thread. Resets state immediately so
        recording can resume, then saves and dispatches in a daemon thread."""
        frames = self._call_frames
        timestamp = self._timestamp
        self._reset()

        duration = len(frames) * FRAME_DURATION_MS / 1000
        logger.info("Call ended (%s) — duration %.1fs", timestamp, duration)

        if duration < MIN_CALL_DURATION_SEC:
            logger.info(
                "Discarding call %s (%.1fs < %ds minimum)",
                timestamp, duration, MIN_CALL_DURATION_SEC,
            )
            return

        def save_and_dispatch():
            wav_path = RECORDINGS_DIR / f"call_{timestamp}.wav"
            try:
                with wave.open(str(wav_path), "wb") as wf:
                    wf.setnchannels(1)
                    wf.setsampwidth(2)
                    wf.setframerate(SAMPLE_RATE)
                    wf.writeframes(b"".join(frames))
                logger.info("Saved → %s (%.1fs)", wav_path.name, duration)
            except Exception:
                logger.exception("Failed to write .wav for call %s", timestamp)
                return

            on_call_complete(str(wav_path), timestamp, duration)

        threading.Thread(target=save_and_dispatch, daemon=True).start()
