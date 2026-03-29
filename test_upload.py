"""
test_upload.py — Stuur een video/audio bestand direct naar de compliance server.

Gebruik:
    python test_upload.py pad/naar/bestand.mp4
    python test_upload.py pad/naar/bestand.wav
    python test_upload.py pad/naar/bestand.mp4 --agent TestAgent

Vereisten:
    - ffmpeg in PATH  (voor mp4/mp3/etc omzetten naar wav)
    - WAV bestanden worden direct doorgestuurd zonder conversie
"""

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import requests
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent / ".env")
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:5000")


def to_wav(input_path: Path, tmp_dir: str) -> Path:
    """Convert any audio/video to 16kHz mono WAV using ffmpeg."""
    out = Path(tmp_dir) / "converted.wav"
    print(f"  Omzetten naar WAV via ffmpeg...")
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-ar", "16000",
            "-ac", "1",
            "-f", "wav",
            str(out),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        print("  [FOUT] ffmpeg mislukt:")
        print(result.stderr.decode(errors="replace"))
        sys.exit(1)
    return out


def get_duration(wav_path: Path) -> float:
    """Get duration in seconds from WAV header."""
    import wave
    with wave.open(str(wav_path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def main():
    parser = argparse.ArgumentParser(description="Upload een bestand naar de compliance server")
    parser.add_argument("bestand", help="Pad naar video of audio bestand")
    parser.add_argument("--agent", default="TestUpload", help="Agent naam (default: TestUpload)")
    args = parser.parse_args()

    input_path = Path(args.bestand)
    if not input_path.exists():
        print(f"[FOUT] Bestand niet gevonden: {input_path}")
        sys.exit(1)

    print(f"\nVoltera Compliance — Test Upload")
    print(f"  Bestand : {input_path.name}")
    print(f"  Agent   : {args.agent}")
    print(f"  Server  : {SERVER_URL}")
    print()

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Converteer naar WAV als nodig
        if input_path.suffix.lower() == ".wav":
            wav_path = input_path
            print(f"  WAV bestand — geen conversie nodig.")
        else:
            # Check ffmpeg
            if subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0:
                print("[FOUT] ffmpeg niet gevonden. Installeer via: https://ffmpeg.org/download.html")
                print("       Of converteer het bestand handmatig naar WAV (16kHz mono) en stuur dat in.")
                sys.exit(1)
            wav_path = to_wav(input_path, tmp_dir)

        duration = get_duration(wav_path)
        print(f"  Duur    : {int(duration//60)}:{int(duration%60):02d} ({duration:.0f}s)")

        # Upload naar server
        print(f"\n  Uploaden naar {SERVER_URL}/upload ...")
        with open(wav_path, "rb") as f:
            resp = requests.post(
                f"{SERVER_URL}/upload",
                files={"file": ("call.wav", f, "audio/wav")},
                data={"agent_id": args.agent, "duration": str(duration)},
                timeout=60,
            )

        if resp.status_code == 200:
            print(f"\n  [OK] Upload geslaagd!")
            print(f"       De server verwerkt het gesprek nu.")
            print(f"       Resultaat verschijnt automatisch in het dashboard.")
        elif resp.status_code == 400 and "too short" in resp.text.lower():
            print(f"\n  [SKIP] Server heeft het bestand geweigerd — te kort.")
            print(f"         MIN_CALL_DURATION_SEC in config.py is waarschijnlijk 300s.")
            print(f"         Zet tijdelijk op 10 voor testen.")
        else:
            print(f"\n  [FOUT] Server antwoordde: {resp.status_code}")
            print(f"         {resp.text}")


if __name__ == "__main__":
    main()
