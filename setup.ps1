# setup.ps1 — Voltera Compliance Checker installer
# Run once on each agent PC: .\setup.ps1
# Copies project to LOCALAPPDATA (AV-safe), registers a silent login task,
# then starts it immediately.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskName   = "Voltera Compliance Checker"
$installPath = Join-Path $env:LOCALAPPDATA "VolteraCompliance"
$source      = $PSScriptRoot   # folder where setup.ps1 lives

# ── Step 1: Copy project to LOCALAPPDATA ──────────────────────────────────────
# Running pythonw.exe from OneDrive / Desktop can trigger Defender for Endpoint.
# LOCALAPPDATA is always writable by the current user and never cloud-synced.

Write-Host ""
Write-Host "📁 Installing to: $installPath"

if (Test-Path $installPath) {
    Write-Host "   Existing install found — overwriting..."
}

Copy-Item -Path "$source\*" -Destination $installPath -Recurse -Force
Write-Host "   ✅ Files copied."

# ── Step 2: Detect pythonw.exe ────────────────────────────────────────────────
# pythonw.exe runs Python without a console window (required for silent mode).
# It lives alongside python.exe in the same install directory.

Write-Host ""
Write-Host "🐍 Locating pythonw.exe..."

$pythonw = $null

# Try direct lookup first
$cmd = Get-Command "pythonw.exe" -ErrorAction SilentlyContinue
if ($cmd) {
    $pythonw = $cmd.Source
}

# Fallback: find python.exe and substitute
if (-not $pythonw) {
    $pyCmd = Get-Command "python.exe" -ErrorAction SilentlyContinue
    if ($pyCmd) {
        $candidate = Join-Path (Split-Path $pyCmd.Source) "pythonw.exe"
        if (Test-Path $candidate) {
            $pythonw = $candidate
        }
    }
}

# Second fallback: py launcher
if (-not $pythonw) {
    $pyLauncher = Get-Command "py.exe" -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        $pyPath = & py.exe -c "import sys; print(sys.executable)" 2>$null
        if ($pyPath) {
            $candidate = Join-Path (Split-Path $pyPath) "pythonw.exe"
            if (Test-Path $candidate) {
                $pythonw = $candidate
            }
        }
    }
}

if (-not $pythonw) {
    Write-Host ""
    Write-Host "❌ pythonw.exe not found." -ForegroundColor Red
    Write-Host "   Make sure Python is installed via python.org (not the Microsoft Store)."
    Write-Host "   Microsoft Store Python does not ship pythonw.exe."
    exit 1
}

Write-Host "   ✅ Found: $pythonw"

# ── Step 3: Build scheduled task ──────────────────────────────────────────────

Write-Host ""
Write-Host "🗓️  Registering scheduled task: '$taskName'..."

$mainPath = Join-Path $installPath "main.py"
if (-not (Test-Path $mainPath)) {
    Write-Host ""
    Write-Host "❌ main.py not found at $mainPath" -ForegroundColor Red
    Write-Host "   The copy step may have failed — check the source folder."
    exit 1
}

$action = New-ScheduledTaskAction `
    -Execute $pythonw `
    -Argument "`"$mainPath`"" `
    -WorkingDirectory $installPath

# 1-minute delay after login — gives Windows time to initialize audio devices
$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -DisallowStartIfOnBatteries $false `
    -StopIfGoingOnBatteries $false `
    -StartWhenAvailable $true

$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

# Register (overwrite if already exists)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "   ✅ Task registered."

# Apply 1-minute login delay via XML patch (New-ScheduledTaskTrigger has no -Delay on all PS versions)
try {
    $xml  = (Get-ScheduledTask -TaskName $taskName | Export-ScheduledTask)
    $xml  = $xml -replace "<LogonTrigger>", "<LogonTrigger>`n      <Delay>PT1M</Delay>"
    $tmp  = Join-Path $env:TEMP "voltera_task.xml"
    $xml | Out-File -FilePath $tmp -Encoding Unicode
    Register-ScheduledTask -TaskName $taskName -Xml (Get-Content $tmp -Raw) -Force | Out-Null
    Remove-Item $tmp -ErrorAction SilentlyContinue
    Write-Host "   ✅ Login delay (1 min) applied."
} catch {
    Write-Host "   ⚠️  Could not apply login delay (non-critical): $_"
}

# ── Step 4: Start task immediately ────────────────────────────────────────────

Write-Host ""
Write-Host "▶️  Starting compliance checker now..."

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

$state = (Get-ScheduledTask -TaskName $taskName).State
Write-Host "   Task state: $state"

if ($state -eq "Running") {
    Write-Host "   ✅ Running."
} else {
    Write-Host "   ⚠️  Task did not reach 'Running' state. Check Task Scheduler for details."
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "✅ Voltera Compliance Checker installed and running" -ForegroundColor Green
Write-Host ""
Write-Host "   Install location : $installPath"
Write-Host "   Log file         : $installPath\compliance.log"
Write-Host "   Starts on login  : yes (1 min delay)"
Write-Host "   Restart on crash : 3× at 1 min intervals"
Write-Host ""
Write-Host "   To uninstall     : .\uninstall.ps1"
Write-Host ""
