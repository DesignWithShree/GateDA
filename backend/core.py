"""Core: paths, settings, SQLite storage, library filesystem helpers."""
import datetime as dt
import json
import os
import re
import sqlite3
import sys
import subprocess
from contextlib import contextmanager
from pathlib import Path

from .syllabus import ALL_TOPICS as BUILTIN_TOPICS, SUBJECT_ORDER, SUBJECT_CODE

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
LIB = DATA / "library"
DB_PATH = DATA / "gate.db"
SETTINGS_PATH = DATA / "settings.json"

STATUSES = ["Not started", "Learning", "Done", "Revise"]
INDEXABLE = (".pdf", ".txt", ".md")

DEFAULT_SETTINGS = {
    "provider": "Gemini",
    "anthropic_key": "",
    "gemini_key": "",
    "anthropic_model": "claude-sonnet-5-5",
    "gemini_model": "gemini-2.5-flash",
    "exam_date": "2027-02-15",
    "weekly_hours": 20,
    # Daily free-time blocks for the study calendar. Evening is intentionally left out
    # by default (reserved for personal project work) - add it back in Settings if needed.
    "study_blocks": [
        {"start": "05:00", "end": "07:00"},
        {"start": "10:00", "end": "13:15"},
        {"start": "14:45", "end": "17:25"},
    ],
    "session_min_hours": 1.0,
    "session_max_hours": 2.5,
    "break_minutes": 10,
}


# ----------------------------------------------------------------------------- latex repair
_CTRL = {"\x0c": "\\f", "\x08": "\\b", "\x07": "\\a", "\x0b": "\\v"}


def fix_latex(t: str) -> str:
    """Repair text where a JSON parser ate the backslash of a LaTeX command (\\forall -> form-feed + 'orall')."""
    if not t:
        return t
    for k, v in _CTRL.items():
        t = t.replace(k, v)
    t = re.sub(r"[\t\r](?=(heta|au|imes|ilde|ext|o\b|riangle|op\b))", lambda m: "\\" + ("t" if m.group(0) == "\t" else "r"), t)
    t = re.sub(r"\r(?=(ho|ightarrow|angle|ceil|floor)\b)", r"\\r", t)
    return t


# ----------------------------------------------------------------------------- settings
def get_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    if SETTINGS_PATH.exists():
        try:
            s.update(json.loads(SETTINGS_PATH.read_text()))
        except Exception:
            pass
    s["anthropic_key"] = s["anthropic_key"] or os.environ.get("ANTHROPIC_API_KEY", "")
    s["gemini_key"] = s["gemini_key"] or os.environ.get("GEMINI_API_KEY", "")
    return s


def save_settings(new: dict):
    cur = {}
    if SETTINGS_PATH.exists():
        try:
            cur = json.loads(SETTINGS_PATH.read_text())
        except Exception:
            pass
    cur.update(new)
    SETTINGS_PATH.write_text(json.dumps(cur, indent=2))
    try:
        os.chmod(SETTINGS_PATH, 0o600)
    except Exception:
        pass


# ----------------------------------------------------------------------------- database
@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db():
    DATA.mkdir(exist_ok=True)
    LIB.mkdir(exist_ok=True)
    with conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS progress(
                topic_id TEXT PRIMARY KEY, status TEXT DEFAULT 'Not started',
                confidence INTEGER DEFAULT 0, notes TEXT DEFAULT '', last_studied TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS messages(
                id INTEGER PRIMARY KEY AUTOINCREMENT, chat_key TEXT, role TEXT, content TEXT, ts TEXT);
            CREATE TABLE IF NOT EXISTS links(
                id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT, title TEXT, url TEXT);
            CREATE TABLE IF NOT EXISTS topic_files(
                topic_id TEXT, rel_path TEXT, PRIMARY KEY(topic_id, rel_path));
            CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
            CREATE TABLE IF NOT EXISTS chunks(
                id INTEGER PRIMARY KEY AUTOINCREMENT, rel_path TEXT, page INTEGER, text TEXT);
            CREATE TABLE IF NOT EXISTS indexed_files(
                rel_path TEXT PRIMARY KEY, mtime REAL, size INTEGER);
            CREATE TABLE IF NOT EXISTS activity(
                date TEXT, topic_id TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(date, topic_id));
            CREATE TABLE IF NOT EXISTS mock_tests(
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT,
                total_marks REAL, obtained_marks REAL, breakdown TEXT DEFAULT '', notes TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS flashcards(
                id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT, front TEXT, back TEXT,
                ease REAL DEFAULT 2.5, interval INTEGER DEFAULT 0, reps INTEGER DEFAULT 0,
                due_date TEXT, created_at TEXT);
            CREATE TABLE IF NOT EXISTS custom_topics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT, name TEXT, section TEXT DEFAULT '',
                difficulty TEXT DEFAULT 'Medium', importance INTEGER DEFAULT 3, hours REAL DEFAULT 4);
            CREATE TABLE IF NOT EXISTS subtopics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT, name TEXT, pos INTEGER DEFAULT 0,
                done INTEGER DEFAULT 0, notes TEXT DEFAULT '', ai_notes TEXT DEFAULT '', short TEXT DEFAULT '',
                updated TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS study_sessions(
                id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id TEXT DEFAULT '', subject TEXT DEFAULT '',
                seconds INTEGER, date TEXT, started TEXT, note TEXT DEFAULT '');
            CREATE TABLE IF NOT EXISTS practice_results(
                id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT, topic_id TEXT DEFAULT '', kind TEXT,
                score REAL, total INTEGER, date TEXT);
            """
        )
        cols = [r["name"] for r in c.execute("PRAGMA table_info(messages)")]
        if "meta" not in cols:
            c.execute("ALTER TABLE messages ADD COLUMN meta TEXT DEFAULT ''")
    for subj in SUBJECT_ORDER:
        (LIB / subj).mkdir(exist_ok=True)
    seed_subtopics()
    with conn() as c:  # one-off repair of flashcards saved before the LaTeX fix
        for r in c.execute("SELECT id,front,back FROM flashcards").fetchall():
            f, b = fix_latex(r["front"]), fix_latex(r["back"])
            if f != r["front"] or b != r["back"]:
                c.execute("UPDATE flashcards SET front=?, back=? WHERE id=?", (f, b, r["id"]))


def kv_get(k, default=""):
    with conn() as c:
        r = c.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return r["v"] if r else default


def kv_set(k, v):
    with conn() as c:
        c.execute("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))


# ----------------------------------------------------------------------------- topics (built-in + yours)
def seed_subtopics():
    """Copy each built-in topic's subtopics into the DB once, so you can tick/edit/delete them."""
    with conn() as c:
        seeded = {r["k"] for r in c.execute("SELECT k FROM kv WHERE k LIKE 'seeded:%'")}
        for t in BUILTIN_TOPICS:
            if f"seeded:{t['id']}" in seeded:
                continue
            for i, name in enumerate(t["subtopics"]):
                c.execute("INSERT INTO subtopics(topic_id,name,pos) VALUES(?,?,?)", (t["id"], name, i))
            c.execute("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)", (f"seeded:{t['id']}", "1"))


def custom_tid(n) -> str:
    return f"CU-{int(n):03d}"


def all_topics() -> list:
    out = [dict(t) for t in BUILTIN_TOPICS]
    with conn() as c:
        for r in c.execute("SELECT * FROM custom_topics ORDER BY id"):
            tid = custom_tid(r["id"])
            out.append({"id": tid, "subject": r["subject"], "name": r["name"], "scope": "Added by you",
                        "importance": r["importance"], "difficulty": r["difficulty"], "hours": r["hours"],
                        "subtopics": [], "section": r["section"] or "", "rank": 1000 + r["id"],
                        "order": 1000 + r["id"], "custom": True})
    return out


def topic_by_id() -> dict:
    return {t["id"]: t for t in all_topics()}


def subtopics_by_topic() -> dict:
    out = {}
    with conn() as c:
        for r in c.execute("SELECT id,topic_id,name,pos,done,(notes!='') has_notes,(ai_notes!='') has_lesson "
                           "FROM subtopics ORDER BY topic_id,pos,id"):
            out.setdefault(r["topic_id"], []).append(
                {"id": r["id"], "name": r["name"], "done": bool(r["done"]),
                 "has_notes": bool(r["has_notes"]), "has_lesson": bool(r["has_lesson"])})
    return out


def sync_topic_status(tid: str):
    """Keep topic status in step with its subtopic ticks (Not started -> Learning -> Done)."""
    with conn() as c:
        rows = c.execute("SELECT done FROM subtopics WHERE topic_id=?", (tid,)).fetchall()
    if not rows or tid not in get_progress():
        return
    done = sum(r["done"] for r in rows)
    cur = get_progress()[tid]["status"]
    if done == len(rows) and cur != "Done":
        upsert_progress(tid, status="Done")
    elif 0 < done < len(rows) and cur in ("Not started", "Done"):
        upsert_progress(tid, status="Learning")
    elif done == 0 and cur == "Done":
        upsert_progress(tid, status="Learning")


# ----------------------------------------------------------------------------- study time & practice
def study_summary() -> dict:
    today = dt.date.today()
    week_start = (today - dt.timedelta(days=6)).isoformat()
    with conn() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM study_sessions ORDER BY id DESC")]
        pr = [dict(r) for r in c.execute("SELECT * FROM practice_results ORDER BY id DESC")]
    by_subject, by_topic, by_day = {}, {}, {}
    for r in rows:
        by_subject[r["subject"]] = by_subject.get(r["subject"], 0) + r["seconds"]
        if r["topic_id"]:
            by_topic[r["topic_id"]] = by_topic.get(r["topic_id"], 0) + r["seconds"]
        by_day[r["date"]] = by_day.get(r["date"], 0) + r["seconds"]
    streak, d = 0, today
    if by_day.get(d.isoformat(), 0) == 0:
        d -= dt.timedelta(days=1)
    while by_day.get(d.isoformat(), 0) > 0:
        streak += 1
        d -= dt.timedelta(days=1)
    practice = {}
    for r in pr:
        p = practice.setdefault(r["subject"], {"pyq": 0, "practice": 0, "mock": 0, "last_mock": "", "best_mock": 0,
                                               "last_pyq": "", "correct": 0, "attempted": 0})
        p[r["kind"]] = p.get(r["kind"], 0) + 1
        p["correct"] += r["score"]
        p["attempted"] += r["total"]
        pct = round(100 * r["score"] / r["total"]) if r["total"] else 0
        if r["kind"] == "mock":
            p["last_mock"] = max(p["last_mock"], r["date"])
            p["best_mock"] = max(p["best_mock"], pct)
        if r["kind"] == "pyq":
            p["last_pyq"] = max(p["last_pyq"], r["date"])
    return {
        "today_sec": by_day.get(today.isoformat(), 0),
        "week_sec": sum(v for k, v in by_day.items() if k >= week_start),
        "total_sec": sum(by_day.values()),
        "streak": streak, "by_subject": by_subject, "by_topic": by_topic,
        "by_day": {k: v for k, v in by_day.items() if k >= (today - dt.timedelta(days=140)).isoformat()},
        "recent": rows[:12], "practice": practice,
        "recent_practice": pr[:12],
    }


def get_progress() -> dict:
    prog = {t["id"]: {"status": "Not started", "confidence": 0, "notes": "", "last_studied": ""} for t in all_topics()}
    with conn() as c:
        for r in c.execute("SELECT * FROM progress"):
            if r["topic_id"] in prog:
                prog[r["topic_id"]] = {
                    "status": r["status"] or "Not started",
                    "confidence": r["confidence"] or 0,
                    "notes": r["notes"] or "",
                    "last_studied": r["last_studied"] or "",
                }
    return prog


def upsert_progress(tid: str, **fields):
    cur = get_progress()[tid]
    fields = {k: v for k, v in fields.items() if v is not None}
    new = {**cur, **fields}
    touched = any(k in fields and fields[k] != cur[k] for k in ("status", "confidence"))
    if touched and new["status"] != "Not started":
        new["last_studied"] = dt.date.today().isoformat()
    with conn() as c:
        c.execute(
            """INSERT INTO progress(topic_id,status,confidence,notes,last_studied) VALUES(?,?,?,?,?)
               ON CONFLICT(topic_id) DO UPDATE SET status=excluded.status, confidence=excluded.confidence,
               notes=excluded.notes, last_studied=excluded.last_studied""",
            (tid, new["status"], int(new["confidence"]), new["notes"], new["last_studied"]),
        )
        if touched:
            today = dt.date.today().isoformat()
            c.execute(
                """INSERT INTO activity(date,topic_id,count) VALUES(?,?,1)
                   ON CONFLICT(date,topic_id) DO UPDATE SET count=count+1""",
                (today, tid),
            )
    return new


def log_activity(tid: str):
    today = dt.date.today().isoformat()
    with conn() as c:
        c.execute(
            """INSERT INTO activity(date,topic_id,count) VALUES(?,?,1)
               ON CONFLICT(date,topic_id) DO UPDATE SET count=count+1""",
            (today, tid),
        )


def get_activity(days=140):
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    with conn() as c:
        rows = c.execute(
            "SELECT date, SUM(count) n FROM activity WHERE date>=? GROUP BY date", (since,)
        ).fetchall()
    return {r["date"]: r["n"] for r in rows}


# ----------------------------------------------------------------------------- chat storage
def load_msgs(key, with_meta=False):
    with conn() as c:
        rows = c.execute("SELECT role, content, meta FROM messages WHERE chat_key=? ORDER BY id", (key,)).fetchall()
    out = []
    for r in rows:
        m = {"role": r["role"], "content": r["content"]}
        if with_meta:
            try:
                m["meta"] = json.loads(r["meta"]) if r["meta"] else {}
            except Exception:
                m["meta"] = {}
        out.append(m)
    return out


def add_msg(key, role, content, meta=None):
    with conn() as c:
        c.execute("INSERT INTO messages(chat_key,role,content,ts,meta) VALUES(?,?,?,?,?)",
                  (key, role, content, dt.datetime.now().isoformat(timespec="seconds"),
                   json.dumps(meta) if meta else ""))


def clear_msgs(key):
    with conn() as c:
        c.execute("DELETE FROM messages WHERE chat_key=?", (key,))
    kv_set(f"key:{key}", "")


# ----------------------------------------------------------------------------- library fs
def safe_path(rel: str) -> Path:
    root = LIB.resolve()
    p = (LIB / rel).resolve()
    if p != root and root not in p.parents:
        raise ValueError("Path outside library")
    return p


def _hidden(rel: Path) -> bool:
    return any(part.startswith(".") for part in rel.parts)


def all_folders():
    out = [""]
    for p in sorted(LIB.rglob("*")):
        if p.is_dir() and not _hidden(p.relative_to(LIB)):
            out.append(p.relative_to(LIB).as_posix())
    return out


def all_files():
    out = []
    for p in sorted(LIB.rglob("*")):
        if p.is_file() and not _hidden(p.relative_to(LIB)):
            st = p.stat()
            rel = p.relative_to(LIB).as_posix()
            out.append({"path": rel, "name": p.name, "folder": Path(rel).parent.as_posix().replace(".", ""),
                        "size": st.st_size, "mtime": st.st_mtime})
    return out


def open_file(p: Path):
    if sys.platform == "darwin":
        subprocess.Popen(["open", str(p)])
    elif sys.platform.startswith("win"):
        os.startfile(str(p))  # type: ignore[attr-defined]
    else:
        subprocess.Popen(["xdg-open", str(p)])
