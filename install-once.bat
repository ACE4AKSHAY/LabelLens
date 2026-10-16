@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found. Install Node.js LTS, then reopen this window.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python was not found as the "python" command.
    echo Install Python 3.12, enable Add Python to PATH, then reopen this window.
    echo This file uses python.exe and does not use the py launcher.
    pause
    exit /b 1
  )
  python -m venv backend\.venv
  if errorlevel 1 goto :failed
)

echo Installing backend packages...
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 goto :failed

if not exist "frontend\node_modules" (
  echo Installing frontend packages...
  call npm --prefix frontend ci
  if errorlevel 1 goto :failed
) else (
  echo Frontend packages already exist; skipping npm install.
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  if errorlevel 1 goto :failed
  echo Created backend\.env from the placeholder template.
)
if not exist "frontend\.env" (
  copy "frontend\.env.example" "frontend\.env" >nul
  if errorlevel 1 goto :failed
)

echo.
echo Setup complete. Dependencies are installed for this clone.
echo Mock demo: run-mock.bat
echo Live mode: add your key to backend\.env, review the provider terms, then run run-live.bat
pause
exit /b 0

:failed
echo.
echo Setup failed. Read the error above, fix it, and run install-once.bat again.
pause
exit /b 1
