#!/bin/bash
# One-command launcher for macOS / Linux.  Usage:  ./run.sh
cd "$(dirname "$0")"
if [ ! -d ".venv" ]; then
  echo "First run: creating a virtual environment..."
  python3 -m venv .venv || { echo "python3 not found. Install Python 3.10+ from python.org"; exit 1; }
fi
source .venv/bin/activate
pip install -q -r requirements.txt || { echo "Could not install packages. Check your internet connection."; exit 1; }
echo "Starting GATE DA Companion at http://localhost:8765  (press Ctrl+C to stop)"
( sleep 2; python3 -c "import webbrowser; webbrowser.open('http://localhost:8765')" ) &
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8765
