# uninstall.ps1 — Voltera Compliance Checker uninstaller
# Run on the agent PC to fully remove the autostart and installed files:
#   .\uninstall.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"   # non-fatal: keep going if task already gone

$taskName    = "Voltera Compliance Checker"
$installPath = Join-Path $env:LOCALAPPDATA "VolteraCompliance"

Write-Host ""
Write-Host "🛑 Uninstalling: $taskName"

# ── Step 1: Stop the running task ─────────────────────────────────────────────

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    if ($task.State -eq "Running") {
        Write-Host "   Stopping running task..."
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "   ✅ Stopped."
    } else {
        Write-Host "   Task is not running (state: $($task.State)) — nothing to stop."
    }
} else {
    Write-Host "   Task '$taskName' not found in Task Scheduler — skipping stop."
}

# ── Step 2: Delete the scheduled task ─────────────────────────────────────────

Write-Host "   Removing scheduled task..."
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$still = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "   ⚠️  Task still present after delete — try removing manually via Task Scheduler." -ForegroundColor Yellow
} else {
    Write-Host "   ✅ Task removed."
}

# ── Step 3: Remove installed files ────────────────────────────────────────────

Write-Host "   Removing install folder: $installPath"

if (Test-Path $installPath) {
    Remove-Item -Path $installPath -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $installPath) {
        Write-Host "   ⚠️  Folder not fully removed — a file may still be in use (pythonw.exe running?)." -ForegroundColor Yellow
        Write-Host "   Wait a moment and run uninstall.ps1 again, or delete manually."
    } else {
        Write-Host "   ✅ Folder removed."
    }
} else {
    Write-Host "   Install folder not found — nothing to remove."
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "✅ Uninstalled cleanly" -ForegroundColor Green
Write-Host ""
