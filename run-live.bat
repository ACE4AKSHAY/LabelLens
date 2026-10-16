@echo off
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo Run install-once.bat first.
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo Run install-once.bat first.
  pause
  exit /b 1
)
if not exist "backend\.env" (
  echo backend\.env is missing. Run install-once.bat, then configure a vision provider key in backend\.env.
  pause
  exit /b 1
)

echo Live mode sends uploaded label photos to the configured vision provider.
echo Review that provider's current terms and LabelLens provider-policy status before using real photos.
echo Check backend\.env has the key for VISION_PROVIDER. Never commit or share that file.
echo.

set "EXTRACT_MODE=live"
set "VITE_EXTRACT_MODE=live"

start "LabelLens Backend - Live" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "LabelLens Frontend - Live" /D "%~dp0frontend" cmd /k "npm run dev -- --host 127.0.0.1"

echo Live mode is running in two new windows.
echo Open http://localhost:5173
pause
