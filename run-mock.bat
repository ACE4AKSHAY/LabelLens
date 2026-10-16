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

set "EXTRACT_MODE=mock"
set "VITE_EXTRACT_MODE=mock"

start "LabelLens Backend - Mock" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
start "LabelLens Frontend - Mock" /D "%~dp0frontend" cmd /k "npm run dev -- --host 127.0.0.1"

echo Mock mode is running in two new windows.
echo Open http://localhost:5173
pause
