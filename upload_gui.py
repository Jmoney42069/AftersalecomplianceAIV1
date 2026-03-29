"""
upload_gui.py — Eenvoudige upload GUI voor Voltera Compliance Server
"""

import os
import socket
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
AGENT_ID = os.getenv("AGENT_ID") or socket.gethostname()


class UploadApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Voltera Upload")
        self.resizable(False, False)
        self.configure(bg="#1e1e2e", padx=20, pady=20)

        # ── Server URL ──────────────────────────────────────────
        tk.Label(self, text="Server URL", bg="#1e1e2e", fg="#cdd6f4",
                 font=("Segoe UI", 9)).grid(row=0, column=0, sticky="w")

        self.url_var = tk.StringVar(value="http://localhost:5000")
        url_entry = tk.Entry(self, textvariable=self.url_var, width=38,
                             bg="#313244", fg="#cdd6f4", insertbackground="#cdd6f4",
                             relief="flat", font=("Segoe UI", 9), bd=6)
        url_entry.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(2, 10))

        # ── Bestand ─────────────────────────────────────────────
        tk.Label(self, text="Bestand", bg="#1e1e2e", fg="#cdd6f4",
                 font=("Segoe UI", 9)).grid(row=2, column=0, sticky="w")

        self.file_var = tk.StringVar(value="Geen bestand geselecteerd")
        file_label = tk.Label(self, textvariable=self.file_var, bg="#313244",
                              fg="#a6adc8", font=("Segoe UI", 8), width=30,
                              anchor="w", padx=6, pady=4)
        file_label.grid(row=3, column=0, sticky="ew", pady=(2, 0))

        browse_btn = tk.Button(self, text="Bladeren", command=self._browse,
                               bg="#45475a", fg="#cdd6f4", relief="flat",
                               font=("Segoe UI", 9), cursor="hand2",
                               activebackground="#585b70", activeforeground="#cdd6f4",
                               padx=10)
        browse_btn.grid(row=3, column=1, padx=(6, 0), pady=(2, 0), sticky="ew")

        # ── Status ──────────────────────────────────────────────
        self.status_var = tk.StringVar(value="")
        self.status_label = tk.Label(self, textvariable=self.status_var,
                                     bg="#1e1e2e", fg="#a6e3a1",
                                     font=("Segoe UI", 8), anchor="w")
        self.status_label.grid(row=4, column=0, columnspan=2, sticky="w", pady=(10, 4))

        # ── Progress bar ────────────────────────────────────────
        self.progress = ttk.Progressbar(self, mode="indeterminate", length=300)
        self.progress.grid(row=5, column=0, columnspan=2, sticky="ew", pady=(0, 10))

        # ── Knoppen ─────────────────────────────────────────────
        test_btn = tk.Button(self, text="Test verbinding", command=self._test_connection,
                             bg="#89b4fa", fg="#1e1e2e", relief="flat",
                             font=("Segoe UI", 9, "bold"), cursor="hand2",
                             activebackground="#74c7ec", activeforeground="#1e1e2e",
                             padx=12, pady=6)
        test_btn.grid(row=6, column=0, sticky="ew", padx=(0, 3))

        upload_btn = tk.Button(self, text="Uploaden", command=self._upload,
                               bg="#a6e3a1", fg="#1e1e2e", relief="flat",
                               font=("Segoe UI", 9, "bold"), cursor="hand2",
                               activebackground="#94e2d5", activeforeground="#1e1e2e",
                               padx=12, pady=6)
        upload_btn.grid(row=6, column=1, sticky="ew", padx=(3, 0))

        self.selected_file: Path | None = None

    # ── Helpers ──────────────────────────────────────────────────

    def _set_status(self, msg: str, color: str = "#a6e3a1"):
        self.status_var.set(msg)
        self.status_label.configure(fg=color)

    def _browse(self):
        path = filedialog.askopenfilename(
            title="Selecteer een bestand",
            filetypes=[("WAV bestanden", "*.wav"), ("Alle bestanden", "*.*")]
        )
        if path:
            self.selected_file = Path(path)
            self.file_var.set(self.selected_file.name)

    # ── Test verbinding ──────────────────────────────────────────

    def _test_connection(self):
        self._set_status("Verbinding testen...", "#89b4fa")
        self.progress.start(10)

        def run():
            url = self.url_var.get().rstrip("/")
            try:
                resp = requests.get(f"{url}/status", timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    queue = data.get("queue_depth", "?")
                    self.after(0, lambda: self._set_status(
                        f"Verbonden! Queue: {queue}", "#a6e3a1"))
                else:
                    self.after(0, lambda: self._set_status(
                        f"Server antwoordde met HTTP {resp.status_code}", "#f38ba8"))
            except requests.exceptions.ConnectionError:
                self.after(0, lambda: self._set_status(
                    "Geen verbinding — controleer de URL", "#f38ba8"))
            except Exception as e:
                self.after(0, lambda: self._set_status(str(e), "#f38ba8"))
            finally:
                self.after(0, self.progress.stop)

        threading.Thread(target=run, daemon=True).start()

    # ── Upload ───────────────────────────────────────────────────

    def _upload(self):
        if not self.selected_file or not self.selected_file.exists():
            messagebox.showwarning("Geen bestand", "Selecteer eerst een bestand.")
            return

        self._set_status("Uploaden...", "#89b4fa")
        self.progress.start(10)

        def run():
            url = self.url_var.get().rstrip("/")
            try:
                with open(self.selected_file, "rb") as f:
                    resp = requests.post(
                        f"{url}/upload",
                        files={"file": (self.selected_file.name, f, "audio/wav")},
                        data={"agent_id": AGENT_ID, "duration": "0"},
                        timeout=120,
                    )
                if resp.status_code == 200:
                    self.after(0, lambda: self._set_status(
                        f"Upload geslaagd: {self.selected_file.name}", "#a6e3a1"))
                elif resp.status_code == 429:
                    self.after(0, lambda: self._set_status(
                        "Server is bezet (429), probeer later", "#fab387"))
                else:
                    self.after(0, lambda: self._set_status(
                        f"Upload mislukt: HTTP {resp.status_code}", "#f38ba8"))
            except requests.exceptions.ConnectionError:
                self.after(0, lambda: self._set_status(
                    "Geen verbinding — controleer de URL", "#f38ba8"))
            except Exception as e:
                self.after(0, lambda: self._set_status(str(e), "#f38ba8"))
            finally:
                self.after(0, self.progress.stop)

        threading.Thread(target=run, daemon=True).start()


if __name__ == "__main__":
    app = UploadApp()
    app.mainloop()
