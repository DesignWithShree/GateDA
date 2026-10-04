@echo off
REM One-click launcher for Windows. Double-click this file.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.10+ from https://www.python.org/downloads/
  echo IMPORTANT: tick "Add python.exe to PATH" in the installer, then run this file again.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo First run: creating a virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
if errorlevel 1 (
  echo Could not install packages. Check your internet connection.
  pause
  exit /b 1
)
echo Starting GATE DA Companion at http://localhost:8765  (close this window to stop)
start "" http://localhost:8765
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765
pause
