@echo off
setlocal enabledelayedexpansion
title Voltera Server — Installer

:: ══════════════════════════════════════════════════════════════
::  Voltera Compliance Server — Installer
::  Voer 1x uit op de server-PC (als Administrator)
::  Daarna start de server automatisch bij elke Windows-boot.
:: ══════════════════════════════════════════════════════════════

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "VENV=%DIR%\.venv"
set "PYTHON=%VENV%\Scripts\python.exe"
set "PIP=%VENV%\Scripts\pip.exe"
set "START_BAT=%DIR%\start_server.bat"
set "TASK_NAME=VolteraServer"

:: ── Admin check ───────────────────────────────────────────────
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Beheerdersrechten vereist. Opnieuw starten als admin...
    powershell -Command "Start-Process '%~f0' -Verb RunAs -WorkingDirectory '%DIR%'"
    exit /b
)

echo.
echo  ██╗   ██╗ ██████╗ ██╗  ████████╗███████╗██████╗  █████╗
echo  ██║   ██║██╔═══██╗██║  ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗
echo  ██║   ██║██║   ██║██║     ██║   █████╗  ██████╔╝███████║
echo  ╚██╗ ██╔╝██║   ██║██║     ██║   ██╔══╝  ██╔══██╗██╔══██║
echo   ╚████╔╝ ╚██████╔╝███████╗██║   ███████╗██║  ██║██║  ██║
echo    ╚═══╝   ╚═════╝ ╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
echo.
echo  Compliance Server Installer
echo  Installatiemap: %DIR%
echo.
echo  ──────────────────────────────────────────────────────────
pause

:: ── Stap 1: Python check ──────────────────────────────────────
echo.
echo [1/5] Python controleren...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [FOUT] Python niet gevonden!
    echo.
    echo  Installeer Python 3.11 via:
    echo    https://www.python.org/downloads/
    echo.
    echo  LET OP: Zet een vinkje bij "Add Python to PATH" tijdens installatie!
    echo  Start dit script daarna opnieuw.
    echo.
    pause
    exit /b 1
)
for /f "tokens=2" %%V in ('python --version 2^>^&1') do set "PYVER=%%V"
echo  [OK] Python %PYVER% gevonden.

:: ── Stap 2: Virtuele omgeving ─────────────────────────────────
echo.
echo [2/5] Virtuele Python-omgeving aanmaken...
if exist "%PYTHON%" (
    echo  [OK] .venv bestaat al, overslaan.
) else (
    python -m venv "%VENV%"
    if %errorlevel% neq 0 (
        echo  [FOUT] .venv aanmaken mislukt.
        pause
        exit /b 1
    )
    echo  [OK] .venv aangemaakt.
)

:: ── Stap 3: Packages installeren ─────────────────────────────
echo.
echo [3/5] Packages installeren (dit duurt 2-5 minuten)...
echo  pip upgraden...
"%PIP%" install --upgrade pip --quiet
echo  Requirements installeren...
"%PIP%" install -r "%DIR%\requirements_server.txt"
if %errorlevel% neq 0 (
    echo  [FOUT] pip install mislukt. Controleer internetverbinding.
    pause
    exit /b 1
)
echo  [OK] Alle packages geinstalleerd.

:: ── Stap 4: .env check ───────────────────────────────────────
echo.
echo [4/5] Configuratiebestand controleren...
if not exist "%DIR%\.env" (
    if exist "%DIR%\.env.example" (
        copy "%DIR%\.env.example" "%DIR%\.env" >nul
        echo  [LET OP] .env aangemaakt vanuit .env.example
        echo           Vul de API-sleutels in in: %DIR%\.env
    ) else (
        echo  [WAARSCHUWING] Geen .env gevonden. Maak handmatig aan.
    )
) else (
    echo  [OK] .env gevonden.
)

:: ── Stap 5: Autostart via Taakplanner ────────────────────────
echo.
echo [5/5] Autostart instellen in Windows Taakplanner...

:: Verwijder eventuele oude taak
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorlevel% equ 0 (
    schtasks /delete /tn "%TASK_NAME%" /f >nul
    echo  Oude taak verwijderd.
)

:: Maak nieuwe taak aan — start bij inloggen, 30 sec vertraging
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "\"%START_BAT%\"" ^
  /sc onlogon ^
  /delay 0000:30 ^
  /rl HIGHEST ^
  /f >nul

if %errorlevel% equ 0 (
    echo  [OK] Taak '%TASK_NAME%' aangemaakt — start 30s na inloggen.
) else (
    echo  [FOUT] Taakplanner mislukt. Voeg handmatig toe:
    echo         %START_BAT%
)

:: ── Ngrok check ──────────────────────────────────────────────
echo.
echo  Ngrok controleren...
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WAARSCHUWING] ngrok niet gevonden in PATH.
    echo.
    echo  Doe het volgende om ngrok te installeren:
    echo   1. Ga naar https://ngrok.com/download
    echo   2. Download de Windows x64 versie
    echo   3. Pak ngrok.exe uit naar C:\ngrok\  of C:\Windows\System32\
    echo   4. Open PowerShell als admin en voer uit:
    echo      ngrok config add-authtoken ^<jouw-token^>
    echo   5. Herstart de PC — ngrok start dan automatisch mee.
    echo.
) else (
    for /f "delims=" %%P in ('where ngrok') do set "NGROK_EXE=%%P"

    :: Verwijder eventuele oude ngrok-taak
    schtasks /query /tn "VolteraNgrok" >nul 2>&1
    if %errorlevel% equ 0 (
        schtasks /delete /tn "VolteraNgrok" /f >nul
    )

    :: Lees NGROK_DOMAIN uit .env indien aanwezig
    set "NGROK_CMD=ngrok http 5000"
    if exist "%DIR%\.env" (
        for /f "usebackq tokens=1,* delims==" %%A in ("%DIR%\.env") do (
            if "%%A"=="NGROK_DOMAIN" set "NGROK_CMD=ngrok http --url=%%B 5000"
        )
    )

    schtasks /create ^
      /tn "VolteraNgrok" ^
      /tr "!NGROK_CMD!" ^
      /sc onlogon ^
      /delay 0001:00 ^
      /rl HIGHEST ^
      /f >nul

    if %errorlevel% equ 0 (
        echo  [OK] Taak 'VolteraNgrok' aangemaakt — start 60s na inloggen.
    ) else (
        echo  [FOUT] Ngrok taak aanmaken mislukt.
    )
)

:: ── Klaar ────────────────────────────────────────────────────
echo.
echo  ══════════════════════════════════════════════════════════
echo   Installatie voltooid!
echo.
echo   De server start voortaan automatisch 30 seconden na
echo   het inloggen op Windows.
echo.
echo   Wil je nu direct starten zonder reboot?
echo   Dubbelklik op:  start_server.bat
echo  ══════════════════════════════════════════════════════════
echo.
pause
