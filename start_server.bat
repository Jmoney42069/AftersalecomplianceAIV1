@echo off
setlocal enabledelayedexpansion
title Voltera Compliance Server

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "PYTHON=%DIR%\.venv\Scripts\python.exe"

:: ── Python check ──────────────────────────────────────────────
if not exist "%PYTHON%" (
    echo [FOUT] .venv niet gevonden. Voer eerst install_server.bat uit.
    pause
    exit /b 1
)

:: ── Lees NGROK_DOMAIN uit .env ───────────────────────────────
set "NGROK_CMD=ngrok http 5000"
if exist "%DIR%\.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%DIR%\.env") do (
        if "%%A"=="NGROK_DOMAIN" set "NGROK_CMD=ngrok http --url=%%B 5000"
    )
)

:: ── Server starten ────────────────────────────────────────────
echo  Voltera Compliance Server starten...
start "Voltera Server" /min cmd /k "cd /d "%DIR%" && "%PYTHON%" server.py"

:: ── Ngrok starten (als beschikbaar) ──────────────────────────
timeout /t 3 /nobreak >nul
where ngrok >nul 2>&1
if %errorlevel% equ 0 (
    echo  ngrok starten...
    start "Voltera ngrok" /min cmd /k "!NGROK_CMD!"
    echo  [OK] ngrok gestart.
) else (
    echo  [SKIP] ngrok niet gevonden, overgeslagen.
)

echo.
echo  Server draait. Dit venster kan worden gesloten.
timeout /t 5 /nobreak >nul
exit
