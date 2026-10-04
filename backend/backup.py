"""Backup & restore of your study data (progress, notes, timers, flashcards, test results)."""
import datetime as dt
import io
import json
import sqlite3
import tempfile
import threading
import time
import zipfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from . import core

router = APIRouter(prefix="/api")
BACKUPS = core.DATA / "backups"
KEEP = 14


def _snapshot(dest: Path):
    """Consistent copy of the live database (safe while the app is running)."""
    src = sqlite3.connect(core.DB_PATH)
    dst = sqlite3.connect(dest)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def auto_backup_once():
    BACKUPS.mkdir(parents=True, exist_ok=True)
    today = BACKUPS / f"gate-{dt.date.today().isoformat()}.db"
    if not today.exists() and core.DB_PATH.exists():
        _snapshot(today)
    for old in sorted(BACKUPS.glob("gate-*.db"))[:-KEEP]:
        old.unlink(missing_ok=True)


def start_auto_backup():
    def loop():
        while True:
            try:
                auto_backup_once()
            except Exception:
                pass
            time.sleep(6 * 3600)
    threading.Thread(target=loop, daemon=True).start()


@router.get("/backup")
def download_backup():
    with tempfile.TemporaryDirectory() as d:
        db = Path(d) / "gate.db"
        _snapshot(db)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(db, "gate.db")
            # settings without API keys, so a backup file is safe to keep in cloud storage
            s = {k: v for k, v in core.get_settings().items() if not k.endswith("_key")}
            z.writestr("settings.json", json.dumps(s, indent=2))
    name = f"gate-da-backup-{dt.date.today().isoformat()}.zip"
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...)):
    data = await file.read()
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        raw_db = z.read("gate.db")
        settings = json.loads(z.read("settings.json")) if "settings.json" in z.namelist() else {}
    except Exception:
        raise HTTPException(400, "That file is not a GATE DA backup (.zip made by the Download backup button).")
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d) / "restore.db"
        tmp.write_bytes(raw_db)
        try:
            chk = sqlite3.connect(tmp)
            ok = chk.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            chk.execute("SELECT COUNT(*) FROM progress")
            chk.close()
        except Exception:
            ok = False
        if not ok:
            raise HTTPException(400, "The database inside this backup is damaged or not a GATE DA database.")
        if core.DB_PATH.exists():  # safety copy of what is there now
            BACKUPS.mkdir(parents=True, exist_ok=True)
            _snapshot(BACKUPS / f"before-restore-{dt.datetime.now():%Y%m%d-%H%M%S}.db")
        src = sqlite3.connect(tmp)
        dst = sqlite3.connect(core.DB_PATH)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
    keep = {k: settings[k] for k in ("exam_date", "weekly_hours", "study_blocks", "session_min_hours",
                                     "session_max_hours", "break_minutes") if k in settings}
    if keep:
        core.save_settings(keep)
    core.init_db()
    return {"ok": True}


@router.get("/backup/status")
def backup_status():
    files = sorted(BACKUPS.glob("gate-*.db")) if BACKUPS.exists() else []
    return {"count": len(files), "latest": files[-1].name if files else "", "data_dir": str(core.DATA)}
