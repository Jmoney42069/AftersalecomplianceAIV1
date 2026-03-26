"""
backup.py — Creates a clean distributable zip of the Voltera Compliance Checker.
Excludes .env, recordings/, transcripts/, compliance.log, __pycache__, .git
"""

import zipfile
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent

INCLUDE_EXTENSIONS = {".py", ".txt", ".ps1", ".sql", ".md", ".mjs", ".ts", ".tsx", ".js", ".json", ".css"}

EXCLUDE_NAMES = {
    ".env",
    "compliance.log",
}

EXCLUDE_DIRS = {
    "recordings",
    "transcripts",
    "__pycache__",
    ".git",
    ".venv",
    "node_modules",
    ".next",
}

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
zip_name = f"VolteraCompliance_backup_{timestamp}.zip"
zip_path = BASE_DIR / zip_name

file_count = 0

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for path in sorted(BASE_DIR.rglob("*")):
        # Skip directories themselves
        if path.is_dir():
            continue

        # Skip the zip file itself
        if path == zip_path:
            continue

        # Skip excluded filenames
        if path.name in EXCLUDE_NAMES:
            continue

        # Skip anything inside excluded directories
        relative = path.relative_to(BASE_DIR)
        parts = relative.parts
        if any(part in EXCLUDE_DIRS for part in parts):
            continue

        # Only include known extensions
        if path.suffix.lower() not in INCLUDE_EXTENSIONS:
            continue

        print(f"  + {relative}")
        zf.write(path, relative)
        file_count += 1

print()
print(f"✅ Backup klaar: {zip_path}")
print(f"   {file_count} bestanden toegevoegd")
print()
print("   Stuur deze zip door — ontvanger vult alleen een nieuw .env in en kan direct draaien.")
