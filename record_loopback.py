"""
record_loopback.py — Neemt audio op van wat je PC AFSPEELT (geen mic nodig).

Gebruik:
    python record_loopback.py            # start opname, stop met Ctrl+C
    python record_loopback.py --agent TestAgent
    python record_loopback.py --list     # toon beschikbare loopback-apparaten
    python record_loopback.py --device 5 # specifiek apparaat (zie --list)

Vereisten:
    pip install pyaudiowpatch requests python-dotenv
"""

import argparse
import os
import subprocess
import sys
import wave
import tempfile
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:5000")

CHUNK = 1024


def get_pyaudio():
    try:
        import pyaudiowpatch as pyaudio
        return pyaudio
    except ImportError:
        print("[FOUT] pyaudiowpatch niet geïnstalleerd.")
        print("  Installeer met: pip install pyaudiowpatch")
        sys.exit(1)


def list_loopback_devices():
    pyaudio = get_pyaudio()
    p = pyaudio.PyAudio()
    print("\nBeschikbare loopback-apparaten:\n")
    try:
        found = False
        for device in p.get_loopback_device_info_generator():
            print(f"  [{device['index']}] {device['name']}  ({int(device['defaultSampleRate'])} Hz)")
            found = True
        if not found:
            print("  Geen loopback-apparaten gevonden.")
    finally:
        p.terminate()
    print()


def find_default_loopback(pyaudio):
    """Zoek het loopback-apparaat dat overeenkomt met de standaard speakers."""
    p = pyaudio.PyAudio()
    try:
        wasapi_info = p.get_host_api_info_by_type(pyaudio.paWASAPI)
        default_speakers = p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
        # Als het al een loopback-apparaat is, gebruik het direct
        if default_speakers.get("isLoopbackDevice"):
            return p, default_speakers
        # Zoek het bijpassende loopback-apparaat
        for loopback in p.get_loopback_device_info_generator():
            if default_speakers["name"] in loopback["name"]:
                return p, loopback
        # Fallback: gebruik het eerste beschikbare loopback-apparaat
        for loopback in p.get_loopback_device_info_generator():
            return p, loopback
        raise RuntimeError("Geen loopback-apparaat gevonden.")
    except Exception:
        p.terminate()
        raise


def record_loopback(device_index: int | None = None) -> tuple[Path, float]:
    """
    Neemt PC-audio op via WASAPI loopback totdat Ctrl+C wordt ingedrukt.
    Geeft (wav_path, duration_seconds) terug.
    """
    pyaudio = get_pyaudio()

    if device_index is not None:
        p = pyaudio.PyAudio()
        device = p.get_device_info_by_index(device_index)
    else:
        p, device = find_default_loopback(pyaudio)

    sample_rate = int(device["defaultSampleRate"])
    channels = min(int(device["maxInputChannels"]), 2)

    print(f"\nOpname via loopback: [{device['index']}] {device['name']}")
    print("Speel nu het filmpje af in je browser...")
    print("Druk op Ctrl+C om de opname te stoppen en te uploaden.\n")

    frames = []
    stream = p.open(
        format=pyaudio.paInt16,
        channels=channels,
        rate=sample_rate,
        frames_per_buffer=CHUNK,
        input=True,
        input_device_index=device["index"],
    )

    try:
        while True:
            data = stream.read(CHUNK, exception_on_overflow=False)
            frames.append(data)
    except KeyboardInterrupt:
        pass
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

    if not frames:
        print("[FOUT] Geen audio opgenomen.")
        sys.exit(1)

    # Schrijf eerst naar tijdelijk WAV (originele samplerate/kanalen)
    raw_tmp = tempfile.NamedTemporaryFile(suffix="_raw.wav", delete=False)
    raw_tmp.close()
    raw_path = Path(raw_tmp.name)

    with wave.open(str(raw_path), "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"".join(frames))

    # Converteer naar 16kHz mono als nodig
    if sample_rate != 16000 or channels != 1:
        out_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        out_tmp.close()
        wav_path = Path(out_tmp.name)
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw_path), "-ar", "16000", "-ac", "1", str(wav_path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        raw_path.unlink(missing_ok=True)
        if result.returncode != 0:
            print("[FOUT] ffmpeg conversie mislukt.")
            sys.exit(1)
    else:
        wav_path = raw_path

    with wave.open(str(wav_path), "rb") as wf:
        duration = wf.getnframes() / wf.getframerate()

    return wav_path, duration


def upload(wav_path: Path, duration: float, agent_id: str):
    """Stuur de opname naar de compliance server."""
    print(f"\nOpname klaar: {duration:.1f} seconden")
    print(f"Uploaden naar {SERVER_URL} ...")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"loopback_{timestamp}.wav"

    with open(wav_path, "rb") as f:
        resp = requests.post(
            f"{SERVER_URL}/upload",
            files={"file": (filename, f, "audio/wav")},
            data={"agent_id": agent_id, "duration": str(int(duration))},
            timeout=120,
        )

    if resp.ok:
        print(f"[OK] Geüpload! Status: {resp.status_code}")
        try:
            print(f"     Reactie: {resp.json()}")
        except Exception:
            print(f"     Reactie: {resp.text[:200]}")
    else:
        print(f"[FOUT] Server gaf status {resp.status_code}: {resp.text[:300]}")


def main():
    parser = argparse.ArgumentParser(description="Neem PC-audio op via WASAPI loopback")
    parser.add_argument("--list", action="store_true", help="Toon beschikbare loopback-apparaten")
    parser.add_argument("--device", type=int, default=None, help="Apparaat-index (zie --list)")
    parser.add_argument("--agent", default="TestAgent", help="Agent naam voor de database")
    args = parser.parse_args()

    if args.list:
        list_loopback_devices()
        return

    wav_path, duration = record_loopback(device_index=args.device)

    try:
        upload(wav_path, duration, agent_id=args.agent)
    finally:
        wav_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        # Ctrl+C tijdens opname → val door naar upload
        pass
