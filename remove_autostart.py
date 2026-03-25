"""
remove_autostart.py — Voltera Compliance Checker autostart uninstaller
Run once to remove the scheduled task: python remove_autostart.py
"""

import subprocess
import sys

TASK_NAME = "Voltera Compliance Checker"


def task_exists() -> bool:
    result = subprocess.run(
        ["schtasks", "/query", "/tn", TASK_NAME],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> None:
    print(f"Removing task: {TASK_NAME!r}")

    if not task_exists():
        print("⚠️  Task not found — nothing to remove.")
        sys.exit(0)

    result = subprocess.run(
        ["schtasks", "/delete", "/tn", TASK_NAME, "/f"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        print(
            f"\n❌ Removal failed (exit {result.returncode}):\n"
            f"stdout: {result.stdout.strip()}\n"
            f"stderr: {result.stderr.strip()}"
        )
        print("\nIf you see 'Access is denied', try running as Administrator.")
        sys.exit(1)

    # Verify it's gone
    if task_exists():
        print("⚠️  Delete reported success but task still present. Remove manually via Task Scheduler.")
        sys.exit(1)

    print("✅ Autostart removed. The compliance checker will no longer start on login.")


if __name__ == "__main__":
    main()
