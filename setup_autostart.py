"""
setup_autostart.py — Voltera Compliance Checker autostart installer
Run once on each agent PC: python setup_autostart.py
Registers a Windows Task Scheduler task that starts main.py silently
on every Windows login, with automatic restart on failure (3x, 1 min).
"""

import subprocess
import sys
import tempfile
import os
from pathlib import Path

TASK_NAME = "Voltera Compliance Checker"


def find_pythonw() -> Path:
    """Derive pythonw.exe path from the running interpreter."""
    exe = Path(sys.executable)
    pythonw = exe.parent / "pythonw.exe"
    if not pythonw.exists():
        raise FileNotFoundError(
            f"pythonw.exe not found at {pythonw}\n"
            "Make sure Python was installed with the standard Windows installer "
            "(not the Microsoft Store version, which does not ship pythonw.exe)."
        )
    return pythonw


def build_task_xml(pythonw_path: Path, main_path: Path, work_dir: Path) -> str:
    """
    Build the Task Scheduler XML definition.
    UTF-16 LE is required by schtasks — written by the caller.
    Key settings:
      - LogonTrigger with 1-minute startup delay
      - RestartOnFailure: every 1 min, up to 3 attempts
      - ExecutionTimeLimit PT0S = no timeout (runs indefinitely)
      - DisallowStartIfOnBatteries = false (laptops must still run)
    """
    # Escape XML special characters in paths
    def xe(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    return f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Voltera AI compliance checker — starts silently on login</Description>
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
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{xe(str(pythonw_path))}</Command>
      <Arguments>{xe(str(main_path))}</Arguments>
      <WorkingDirectory>{xe(str(work_dir))}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""


def register_task(xml_content: str) -> None:
    """Write XML to a temp file and register via schtasks."""
    # schtasks requires UTF-16 LE with BOM
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".xml",
        delete=False,
        encoding="utf-16",
    ) as f:
        f.write(xml_content)
        tmp_path = f.name

    try:
        result = subprocess.run(
            [
                "schtasks",
                "/create",
                "/tn", TASK_NAME,
                "/xml", tmp_path,
                "/f",   # overwrite if already exists
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"schtasks failed (exit {result.returncode}):\n"
                f"stdout: {result.stdout.strip()}\n"
                f"stderr: {result.stderr.strip()}"
            )
    finally:
        os.unlink(tmp_path)


def verify_task() -> bool:
    """Return True if the task now exists in Task Scheduler."""
    result = subprocess.run(
        ["schtasks", "/query", "/tn", TASK_NAME],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> None:
    print(f"Registering task: {TASK_NAME!r}")

    # 1. Locate pythonw.exe
    try:
        pythonw_path = find_pythonw()
    except FileNotFoundError as e:
        print(f"\n❌ {e}")
        sys.exit(1)

    print(f"   Python (windowed): {pythonw_path}")

    # 2. Locate main.py relative to this script
    work_dir = Path(__file__).parent.resolve()
    main_path = work_dir / "main.py"

    if not main_path.exists():
        print(f"\n❌ main.py not found at {main_path}")
        print("   Make sure setup_autostart.py is in the same folder as main.py.")
        sys.exit(1)

    print(f"   Working directory: {work_dir}")
    print(f"   Entry point:       {main_path}")

    # 3. Build XML and register
    xml = build_task_xml(pythonw_path, main_path, work_dir)
    try:
        register_task(xml)
    except RuntimeError as e:
        print(f"\n❌ Registration failed:\n{e}")
        print("\nIf you see 'Access is denied', try running this script as Administrator.")
        sys.exit(1)

    # 4. Verify
    if verify_task():
        print("\n✅ Autostart registered successfully.")
        print(f"   The compliance checker will start silently 1 minute after every login.")
        print(f"   Crash recovery: up to 3 automatic restarts, 1 minute apart.")
        print(f"\n   To uninstall: python remove_autostart.py")
    else:
        print("\n⚠️  schtasks reported success but the task was not found on verify.")
        print("   Open Task Scheduler and check manually.")
        sys.exit(1)


if __name__ == "__main__":
    main()
