"""
install.py — Voltera Agent auto-installer
Double-click in Windows Explorer to install.

If opened from a terminal (python.exe), immediately re-launches
with pythonw.exe so no console window appears.
"""

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

# ── No-console relaunch trick ──────────────────────────────────────────────────
# When double-clicked, Windows may open this with python.exe (shows a console).
# Re-launch with pythonw.exe immediately so the console disappears.

def _relaunch_windowless():
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        pythonw = exe.parent / "pythonw.exe"
        if pythonw.exists():
            subprocess.Popen([str(pythonw)] + sys.argv)
            sys.exit()

_relaunch_windowless()

# ── Tkinter imports (after relaunch guard) ─────────────────────────────────────

import tkinter as tk
from tkinter import messagebox

# ── Constants ──────────────────────────────────────────────────────────────────

TASK_NAME   = "Voltera Agent"
SOURCE_DIR  = Path(__file__).parent
INSTALL_DIR = Path(os.environ["LOCALAPPDATA"]) / "VolteraAgent"

FILES_TO_COPY = [
    "recorder.py",
    "uploader.py",
    "config.py",
    "agent_main.py",
    "requirements_agent.txt",
]

# ── Helper: find Python executables ───────────────────────────────────────────

def _find_pythonw() -> Path | None:
    exe = Path(sys.executable)
    if exe.name.lower() == "pythonw.exe":
        return exe
    candidate = exe.parent / "pythonw.exe"
    if candidate.exists():
        return candidate
    return None


def _find_python_for_pip() -> Path:
    """pip must run under python.exe (not pythonw) so we can capture output."""
    exe = Path(sys.executable)
    if exe.name.lower() == "python.exe":
        return exe
    candidate = exe.parent / "python.exe"
    if candidate.exists():
        return candidate
    return exe  # last resort


# ── Task Scheduler XML ─────────────────────────────────────────────────────────

def _build_task_xml(pythonw: Path, work_dir: Path) -> str:
    def xe(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    return f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Voltera AI compliance agent — starts silently on login</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT1M</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{xe(str(pythonw))}</Command>
      <Arguments>agent_main.py</Arguments>
      <WorkingDirectory>{xe(str(work_dir))}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""


# ── Install logic (runs in background thread) ──────────────────────────────────

def _do_install(server_url: str, status_var: tk.StringVar, progress_win: tk.Tk) -> None:
    total = 4
    autostart_ok = False
    error_step = None
    error_msg = None

    def step(n: int, msg: str) -> None:
        status_var.set(f"Stap {n}/{total} — {msg}")
        progress_win.update()

    try:
        # ── Step 1: pip install ────────────────────────────────────────────────
        step(1, "Packages installeren...")
        python = _find_python_for_pip()
        req = SOURCE_DIR / "requirements_agent.txt"
        result = subprocess.run(
            [str(python), "-m", "pip", "install", "-r", str(req), "--quiet"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"pip install mislukt:\n{result.stderr[:600]}")

        # ── Step 2: Copy files ─────────────────────────────────────────────────
        step(2, "Bestanden kopiëren...")
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        for fname in FILES_TO_COPY:
            src = SOURCE_DIR / fname
            if src.exists():
                shutil.copy2(str(src), str(INSTALL_DIR / fname))
            else:
                raise RuntimeError(f"Bestand niet gevonden in installatiemap: {fname}\nZorg dat install.py in dezelfde map staat als de andere bestanden.")

        # ── Step 3: Write .env ─────────────────────────────────────────────────
        step(3, "Configuratie aanmaken...")
        agent_id = socket.gethostname()
        env_content = f"SERVER_URL={server_url}\nAGENT_ID={agent_id}\n"
        (INSTALL_DIR / ".env").write_text(env_content, encoding="utf-8")

        # ── Step 4: Autostart via Task Scheduler ───────────────────────────────
        step(4, "Autostart instellen...")
        pythonw = _find_pythonw()
        if pythonw is None:
            raise RuntimeError(
                "pythonw.exe niet gevonden.\n\n"
                "Installeer Python via python.org (niet de Microsoft Store versie).\n"
                "Zet tijdens installatie het vinkje aan bij 'Add Python to PATH'."
            )

        xml_content = _build_task_xml(pythonw, INSTALL_DIR)
        tmp = Path(tempfile.mktemp(suffix=".xml"))
        tmp.write_text(xml_content, encoding="utf-16")

        sched = subprocess.run(
            ["schtasks", "/create", "/tn", TASK_NAME, "/xml", str(tmp), "/f"],
            capture_output=True,
            text=True,
        )
        tmp.unlink(missing_ok=True)
        autostart_ok = sched.returncode == 0

        # ── Start agent immediately (zichtbaar CMD venster voor testdoeleinden) ──
        agent_main = INSTALL_DIR / "agent_main.py"
        python_exe = Path(sys.executable)
        if python_exe.name.lower() == "pythonw.exe":
            python_exe = python_exe.parent / "python.exe"
        subprocess.Popen(
            [str(python_exe), str(agent_main)],
            cwd=str(INSTALL_DIR),
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )

    except Exception as e:
        error_msg = str(e)

    # ── Show result ────────────────────────────────────────────────────────────
    progress_win.destroy()

    if error_msg:
        messagebox.showerror(
            "Installatie mislukt",
            f"Er is een fout opgetreden:\n\n{error_msg}\n\n"
            "Neem contact op met de beheerder en stuur deze foutmelding mee.",
        )
        return

    extra = ""
    if not autostart_ok:
        extra = (
            "\n\n⚠️ Autostart kon niet worden ingesteld.\n"
            "De agent draait nu wél, maar start niet automatisch bij de volgende login.\n"
            "Voer install.py opnieuw uit als administrator als dit een probleem is."
        )

    messagebox.showinfo(
        "Installatie geslaagd",
        f"✅ Installatie geslaagd!\n\n"
        f"De agent draait nu op de achtergrond en stuurt opnames naar:\n{server_url}{extra}",
    )


# ── GUI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    root = tk.Tk()
    root.title("Voltera Agent Setup")
    root.geometry("400x180")
    root.resizable(False, False)
    root.eval("tk::PlaceWindow . center")

    tk.Label(
        root, text="Voltera Compliance Agent",
        font=("Segoe UI", 12, "bold"),
    ).pack(pady=(16, 2))

    tk.Label(root, text="Vul het serveradres in (ontvangen van beheerder):").pack()

    url_var = tk.StringVar(value="https://")
    entry = tk.Entry(root, textvariable=url_var, width=46, font=("Segoe UI", 9))
    entry.pack(pady=6)
    entry.focus_set()
    entry.icursor(tk.END)

    def on_install() -> None:
        server_url = url_var.get().strip()
        if not server_url.startswith("http"):
            messagebox.showwarning(
                "Ongeldig adres",
                "Vul een geldig serveradres in.\nHet adres moet beginnen met https://",
            )
            return

        root.destroy()

        # Progress window
        prog = tk.Tk()
        prog.title("Installeren...")
        prog.geometry("380x90")
        prog.resizable(False, False)
        prog.eval("tk::PlaceWindow . center")
        prog.protocol("WM_DELETE_WINDOW", lambda: None)  # prevent closing mid-install

        status_var = tk.StringVar(value="Installatie starten...")
        tk.Label(
            prog, textvariable=status_var,
            font=("Segoe UI", 10), wraplength=360, justify="left",
        ).pack(expand=True, padx=16, pady=20)
        prog.update()

        # Run in background so tkinter event loop stays responsive
        t = threading.Thread(
            target=_do_install,
            args=(server_url, status_var, prog),
            daemon=True,
        )
        t.start()
        prog.mainloop()

    tk.Button(
        root, text="  Installeren  ",
        command=on_install,
        bg="#0078D4", fg="white",
        font=("Segoe UI", 10),
        relief="flat", pady=5,
    ).pack(pady=10)

    root.mainloop()


if __name__ == "__main__":
    main()
