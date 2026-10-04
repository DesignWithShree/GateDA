"""GATE DA Companion API. Run from the project root:  python -m uvicorn backend.main:app --port 8765"""
import datetime as dt
import json
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import base64
import os

from . import backup, core, llm, rag, scheduler, srs, study
from .core import LIB, conn, safe_path
from .syllabus import SECTION_BOOKS, SECTION_RESOURCES, SUBJECT_BOOKS, SUBJECT_CODE, SUBJECT_ORDER, SUBJECT_RESOURCES

core.init_db()
app = FastAPI(title="GATE DA Companion")
app.include_router(study.router)
app.include_router(backup.router)
backup.start_auto_backup()

# Optional password for public deployments: set APP_PASSWORD (any username works in the browser prompt).
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")


@app.middleware("http")
async def password_gate(request, call_next):
    if APP_PASSWORD and request.url.path != "/healthz":
        ok = False
        h = request.headers.get("authorization", "")
        if h.lower().startswith("basic "):
            try:
                ok = base64.b64decode(h[6:]).decode().split(":", 1)[1] == APP_PASSWORD
            except Exception:
                ok = False
        if not ok:
            return JSONResponse(status_code=401, content={"detail": "Password required"},
                                headers={"WWW-Authenticate": 'Basic realm="GATE DA Companion"'})
    return await call_next(request)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

# ----------------------------------------------------------------------------- prompts
TUTOR_SYSTEM = """You are a personal GATE DA (Data Science & AI) tutor. Be precise, compact and exam-oriented.
No greetings, no filler, no motivational talk, no extra examples outside the sections below.
Use Markdown with LaTeX ($...$ inline, $$...$$ block). Never invent URLs, book pages or citations.
Follow the FORMAT named in the request exactly.

FORMAT lesson - use exactly these headings in this order:
## 1. Definition
## 2. Why it exists
(the problem it solves and what breaks or was painful without it)
## 3. Core idea
(2-4 lines of intuition, then key formulas/properties)
## 4. Comparison
(a table against 2-3 closely related concepts the student may confuse it with)
## 5. GATE angle
(how questions are usually framed, standard shortcuts, common traps)
## 6. Worked example
(exactly one, step by step)
## 7. Your turn
(exactly ONE GATE-style question: MCQ, MSQ or NAT. No answer, no hint. End with: "Send your answer and I'll check it.")

FORMAT doubt: **Short answer** (1-3 lines) -> **Explanation** -> **When it works / when it fails** -> **Quick check** (one tiny question, no answer).

FORMAT check: **Verdict** (Correct / Partially correct / Incorrect) -> **What you got right / wrong** -> **Correct solution** (step by step) -> **Revise this** (the exact sub-concept) -> **Next question** (slightly different, no answer).

FORMAT practice: exactly one new GATE-style question (MCQ/MSQ/NAT). No answer. End with "Send your answer and I'll check it."

FORMAT quiz: the requested number of numbered GATE-style questions with options where relevant. No answers. Tell the student to reply with all answers.

FORMAT revise: cheat-sheet only: key definitions, formulas, 3 common traps.

Stay within GATE DA syllabus depth. If the student's confidence is low, go slower in the core-idea part but keep the same structure."""

THINK_ANALYSE = """You are the private reasoning stage of a GATE DA tutor. Write concise working notes (max ~250 words) that the tutor
will use to answer accurately. Cover: what is REALLY being asked, the exact definitions/formulas needed, a verified step-by-step
derivation or calculation, and the most likely misconception. Do not address the student."""

THINK_AUTHOR = """You are the private authoring stage of a GATE DA tutor. Design the practice material the tutor will present, and VERIFY it.
Output exactly:
DEFINITION: one-line precise definition
KEY FORMULAS: bullets
WORKED EXAMPLE: a small example with fully verified numbers
QUESTIONS: the question(s) to ask the student (GATE style), each followed by 'ANSWER KEY:' with the verified answer and a 2-line solution
Double-check every calculation. Concise. Do not address the student."""

THINK_CHECK = """You are the private grading stage of a GATE DA tutor. First solve the practice question independently, step by step,
and compute the correct answer (use the answer key if provided but re-verify it). Then compare with the student's answer:
state exactly which steps are right or wrong, and the underlying misconception if wrong. Concise working notes only (max ~250 words)."""

RAG_ADDENDUM = """

You are answering with the student's OWN study material. Excerpts below are tagged [file | p.N].
- Ground the answer in them and cite inline like [file p.N] when you use an excerpt.
- Coverage of the excerpts for this question: {coverage}. If partial/none, say in one short line what is missing, and fill the gap from general knowledge marked "(not from your material)".
- Never fabricate citations. Ignore excerpts that are not relevant.

EXCERPTS:
{context}"""

FLASHCARD_SYS = """You write GATE DA (Data Science & AI) flashcards. Compact, exam-focused, unambiguous.
Front: a short question, term, or "fill in the blank" (max ~15 words).
Back: the precise answer, max 2 short sentences, formula-first when relevant. No filler.
Cover distinct sub-points of the topic, not restatements of the same fact.
Write every formula as LaTeX between dollar signs, e.g. $\\forall x \\in W$ or $A^{-1}$; inside the JSON, escape each backslash by doubling it."""

COACH_SYSTEM = """You are a GATE DA study coach. Given the student's syllabus progress, exam date and weekly hours,
produce a realistic plan. Output exactly:
## Where you stand (3 lines max)
## This week's focus (max 3 subjects/topics, with reasons)
## Day-by-day plan (table: Day | Topics | Hours | Task type [learn/practice/revise])
## Practice targets (concrete numbers: PYQs, quizzes, mock tests)
## Watch out (2-3 risks based on the data)
Prioritise: unfinished high-scoring subjects, low-confidence topics, and revision of old topics. No fluff."""


def sse(d):
    return f"data: {json.dumps(d)}\n\n"


# ----------------------------------------------------------------------------- state / progress
@app.get("/api/state")
def state():
    prog = core.get_progress()
    s = core.get_settings()
    subs = core.subtopics_by_topic()
    topics = []
    for t in core.all_topics():
        ss = subs.get(t["id"], [])
        topics.append({**t, **prog[t["id"]], "subs": ss, "subtopics": [x["name"] for x in ss],
                       "subs_done": sum(1 for x in ss if x["done"])})
    return {
        "topics": topics,
        "subjects": SUBJECT_ORDER,
        "subject_resources": SUBJECT_RESOURCES,
        "subject_books": SUBJECT_BOOKS,
        "subject_codes": SUBJECT_CODE,
        "section_resources": SECTION_RESOURCES,
        "section_books": SECTION_BOOKS,
        "settings": {"exam_date": s["exam_date"], "weekly_hours": s["weekly_hours"], "provider": s["provider"],
                     "has_key": bool(s["anthropic_key"] if s["provider"] == "Anthropic" else s["gemini_key"])},
        "rag": rag.status(),
    }


class ProgressIn(BaseModel):
    status: Optional[str] = None
    confidence: Optional[int] = None
    notes: Optional[str] = None


@app.put("/api/progress/{tid}")
def put_progress(tid: str, body: ProgressIn):
    if tid not in core.topic_by_id():
        raise HTTPException(404, "Unknown topic")
    if body.status is not None and body.status not in core.STATUSES:
        raise HTTPException(400, "Bad status")
    return core.upsert_progress(tid, status=body.status, confidence=body.confidence, notes=body.notes)


@app.get("/api/topic/{tid}")
def topic_detail(tid: str):
    with conn() as c:
        links = [dict(r) for r in c.execute("SELECT id,title,url FROM links WHERE topic_id=? ORDER BY id", (tid,))]
        files = [r["rel_path"] for r in c.execute("SELECT rel_path FROM topic_files WHERE topic_id=?", (tid,))]
    existing = {f["path"] for f in core.all_files()}
    return {"links": links, "files": [f for f in files if f in existing]}


class LinkIn(BaseModel):
    title: str = ""
    url: str


@app.post("/api/topic/{tid}/links")
def add_link(tid: str, body: LinkIn):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    with conn() as c:
        c.execute("INSERT INTO links(topic_id,title,url) VALUES(?,?,?)", (tid, body.title.strip(), url))
    return {"ok": True}


@app.delete("/api/links/{lid}")
def del_link(lid: int):
    with conn() as c:
        c.execute("DELETE FROM links WHERE id=?", (lid,))
    return {"ok": True}


class FilesIn(BaseModel):
    paths: List[str]


@app.put("/api/topic/{tid}/files")
def set_topic_files(tid: str, body: FilesIn):
    with conn() as c:
        c.execute("DELETE FROM topic_files WHERE topic_id=?", (tid,))
        for p in body.paths:
            c.execute("INSERT OR IGNORE INTO topic_files(topic_id,rel_path) VALUES(?,?)", (tid, p))
    return {"ok": True}


# ----------------------------------------------------------------------------- library
@app.get("/api/library")
def library():
    return {"folders": core.all_folders(), "files": core.all_files()}


class PathIn(BaseModel):
    path: str


@app.post("/api/library/folder")
def make_folder(body: PathIn):
    try:
        safe_path(body.path.strip("/")).mkdir(parents=True, exist_ok=True)
    except ValueError:
        raise HTTPException(400, "Invalid path")
    return {"ok": True}


@app.delete("/api/library/folder")
def delete_folder(path: str):
    p = safe_path(path)
    if p == LIB.resolve() or not p.is_dir():
        raise HTTPException(400, "Can't delete this folder")
    shutil.rmtree(p)
    with conn() as c:
        c.execute("DELETE FROM topic_files WHERE rel_path LIKE ?", (path + "/%",))
    return {"ok": True}


@app.post("/api/library/upload")
async def upload(folder: str = Form(""), files: List[UploadFile] = File(...)):
    dest = safe_path(folder)
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in files:
        (dest / Path(f.filename).name).write_bytes(await f.read())
        n += 1
    return {"uploaded": n}


@app.get("/api/library/file")
def get_file(path: str, download: bool = False):
    p = safe_path(path)
    if not p.is_file():
        raise HTTPException(404, "Not found")
    disp = "attachment" if download else "inline"
    return FileResponse(p, filename=p.name, content_disposition_type=disp)


@app.delete("/api/library/file")
def delete_file(path: str):
    p = safe_path(path)
    p.unlink(missing_ok=True)
    with conn() as c:
        c.execute("DELETE FROM topic_files WHERE rel_path=?", (path,))
    return {"ok": True}


class MoveIn(BaseModel):
    path: str
    dest_folder: str


@app.post("/api/library/move")
def move_file(body: MoveIn):
    src = safe_path(body.path)
    target = safe_path((Path(body.dest_folder) / src.name).as_posix())
    if target.exists():
        raise HTTPException(400, "A file with that name already exists there")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(target))
    with conn() as c:
        c.execute("UPDATE OR IGNORE topic_files SET rel_path=? WHERE rel_path=?",
                  (target.relative_to(LIB.resolve()).as_posix(), body.path))
    return {"ok": True}


@app.post("/api/library/open")
def open_local(body: PathIn):
    p = safe_path(body.path)
    if not p.is_file():
        raise HTTPException(404, "Not found")
    core.open_file(p)
    return {"ok": True}


class ImportIn(BaseModel):
    src: str
    folder: str = ""


@app.post("/api/library/import")
def import_path(body: ImportIn):
    sp = Path(body.src.strip()).expanduser()
    dest = safe_path(body.folder)
    if sp.is_dir():
        shutil.copytree(sp, dest / sp.name, dirs_exist_ok=True)
    elif sp.is_file():
        shutil.copy2(sp, dest / sp.name)
    else:
        raise HTTPException(404, "Path not found on this computer")
    return {"ok": True}


# ----------------------------------------------------------------------------- RAG
@app.get("/api/rag/status")
def rag_status():
    return rag.status()


@app.post("/api/rag/index")
def rag_index():
    return rag.index_library()


# ----------------------------------------------------------------------------- chat
class ChatIn(BaseModel):
    message: str
    topic_id: Optional[str] = None
    chat_key: Optional[str] = None
    mode: str = "doubt"  # lesson | doubt | check | practice | quiz | revise
    use_rag: bool = False
    deep: bool = True
    folder: str = ""


def _key(topic_id, chat_key):
    return chat_key or topic_id or "general"


@app.get("/api/chat/{key}")
def get_chat(key: str):
    return load_history(key)


def load_history(key):
    return core.load_msgs(key, with_meta=True)


@app.delete("/api/chat/{key}")
def del_chat(key: str):
    core.clear_msgs(key)
    return {"ok": True}


@app.post("/api/chat")
def chat(body: ChatIn):
    key = _key(body.topic_id, body.chat_key)
    topic = core.topic_by_id().get(body.topic_id) if body.topic_id else None

    def gen():
        steps, sources = [], []
        system = TUTOR_SYSTEM
        topic_hint = ""
        if topic:
            p = core.get_progress()[topic["id"]]
            topic_hint = f"{topic['subject']} > {topic['name']} ({topic['scope']})"
            system += (f"\n\nCurrent topic: {topic_hint}."
                       f"\nStudent status on this topic: {p['status']}, confidence {p['confidence']}/5.")
        system += f"\n\nThe FORMAT for this reply is: {body.mode}."

        core.add_msg(key, "user", body.message)
        history = core.load_msgs(key)
        full = ""
        try:
            # 1) RAG: plan -> retrieve -> grade
            if body.use_rag:
                ctx = {"hits": [], "coverage": "none"}
                for e in rag.pipeline(body.message, topic_hint, body.folder, body.deep):
                    if e["type"] == "step":
                        steps.append(e["text"])
                        yield sse(e)
                    else:
                        ctx = e
                if ctx["hits"]:
                    sources = [{"file": h["rel"], "page": h["page"], "text": h["text"][:700]} for h in ctx["hits"]]
                    yield sse({"type": "sources", "data": sources})
                    system += RAG_ADDENDUM.format(coverage=ctx["coverage"], context=rag.format_context(ctx["hits"]))

            # 2) Private reasoning pass (verified working notes)
            if body.deep:
                prev_assistant = next((m["content"] for m in reversed(history[:-1]) if m["role"] == "assistant"), "")
                stored_key = core.kv_get(f"key:{key}")
                if body.mode in ("lesson", "practice", "quiz"):
                    steps.append("Designing and verifying the worked example and practice question")
                    yield sse({"type": "step", "text": steps[-1]})
                    notes = llm.complete(THINK_AUTHOR + (f"\n\nContext excerpts available:\n{system[-3000:]}" if body.use_rag else ""),
                                         f"Topic: {topic_hint or body.message}\nRequest: {body.message}", 1400)
                    core.kv_set(f"key:{key}", (stored_key + "\n\n" if stored_key else "")[-3000:] + notes)
                    system += ("\n\nPRIVATE PLAN (verified). Use its exact worked example and its exact question(s); "
                               "NEVER reveal the ANSWER KEY:\n" + notes)
                elif body.mode == "check":
                    steps.append("Solving the question independently and grading your answer")
                    yield sse({"type": "step", "text": steps[-1]})
                    notes = llm.complete(THINK_CHECK,
                                         f"Answer key notes from earlier (may be empty):\n{stored_key}\n\n"
                                         f"Tutor's last message (contains the question):\n{prev_assistant}\n\n"
                                         f"Student's answer:\n{body.message}", 1400)
                    system += "\n\nPRIVATE GRADING NOTES (verified, use for accuracy):\n" + notes
                else:
                    steps.append("Working through the problem step by step")
                    yield sse({"type": "step", "text": steps[-1]})
                    notes = llm.complete(THINK_ANALYSE,
                                         f"Topic: {topic_hint or 'general GATE DA'}\nStudent message: {body.message}", 1200)
                    system += "\n\nPRIVATE WORKING NOTES (verified, use for accuracy):\n" + notes

            yield sse({"type": "step", "text": "Writing the answer"})
            for tok in llm.stream(system, history, 3200):
                full += tok
                yield sse({"type": "token", "text": tok})
            core.add_msg(key, "assistant", full, {"steps": steps, "sources": sources})
        except llm.LLMError as e:
            with conn() as c:  # drop the unanswered user message
                c.execute("DELETE FROM messages WHERE id=(SELECT MAX(id) FROM messages WHERE chat_key=? AND role='user')", (key,))
            yield sse({"type": "error", "text": str(e)})
        except Exception as e:  # noqa
            yield sse({"type": "error", "text": f"Unexpected error: {e}"})
        yield sse({"type": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ----------------------------------------------------------------------------- coach
def _progress_text():
    prog = core.get_progress()
    lines = []
    for subj in SUBJECT_ORDER:
        ts = [t for t in core.all_topics() if t["subject"] == subj]
        cnt = {s: sum(prog[t["id"]]["status"] == s for t in ts) for s in core.STATUSES}
        weak = [t["name"] for t in ts if prog[t["id"]]["status"] != "Not started" and 0 < prog[t["id"]]["confidence"] <= 2]
        left = [t["name"] for t in ts if prog[t["id"]]["status"] == "Not started"]
        lines.append(f"- {subj}: {cnt['Done']}/{len(ts)} done, {cnt['Learning']} learning, {cnt['Revise']} revise."
                     f" Weak: {', '.join(weak) or 'none'}. Not started: {', '.join(left) or 'none'}.")
    return "\n".join(lines)


@app.get("/api/coach/last")
def coach_last():
    return {"plan": core.kv_get("last_plan"), "date": core.kv_get("last_plan_date")}


@app.post("/api/coach")
def coach():
    s = core.get_settings()
    try:
        days_left = (dt.date.fromisoformat(s["exam_date"]) - dt.date.today()).days
    except Exception:
        days_left = "unknown"
    prompt = (f"Exam date: {s['exam_date']} ({days_left} days left). Weekly study hours: {s['weekly_hours']}.\n"
              f"Today: {dt.date.today().isoformat()}.\nProgress by subject:\n{_progress_text()}")

    def gen():
        full = ""
        try:
            for tok in llm.stream(COACH_SYSTEM, [{"role": "user", "content": prompt}], 2500):
                full += tok
                yield sse({"type": "token", "text": tok})
            core.kv_set("last_plan", full)
            core.kv_set("last_plan_date", dt.date.today().isoformat())
        except llm.LLMError as e:
            yield sse({"type": "error", "text": str(e)})
        yield sse({"type": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


# ----------------------------------------------------------------------------- priority plan
WEIGHT = {"Not started": 0.0, "Learning": 0.4, "Revise": 0.7, "Done": 1.0}


def _block_hours(blocks):
    total = 0.0
    for b in blocks:
        try:
            sh, sm = map(int, b["start"].split(":")); eh, em = map(int, b["end"].split(":"))
            total += max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60
        except Exception:
            continue
    return total


@app.get("/api/priority")
def priority_plan():
    prog = core.get_progress()
    s = core.get_settings()
    today = dt.date.today()
    try:
        days_left = max((dt.date.fromisoformat(s["exam_date"]) - today).days, 0)
    except Exception:
        days_left = 0

    remaining = []
    for t in core.all_topics():  # covers every topic, basic through advanced, in every subject
        p = prog[t["id"]]
        left_frac = 1 - WEIGHT[p["status"]]
        if left_frac <= 0 and p["status"] != "Revise":
            continue
        remaining.append({**t, **p, "left_frac": left_frac,
                          "hours_left": round(t["hours"] * max(left_frac, 0.15), 1)})
    # Basic -> Medium -> Hard first (build a stable footing before harder material),
    # highest importance within each tier, least-confident-first as the final tiebreak.
    remaining.sort(key=scheduler.sort_key)

    total_hours_left = round(sum(r["hours_left"] for r in remaining), 1)
    daily_budget = _block_hours(s["study_blocks"]) or (s["weekly_hours"] / 7 if s["weekly_hours"] else 0)
    available_hours = round(daily_budget * days_left, 1) if days_left else None
    on_track = available_hours is not None and available_hours >= total_hours_left

    horizon = min(days_left, 30) if days_left else 21
    pool = [dict(r) for r in remaining]
    calendar_days, _ = scheduler.build_calendar(
        pool, s["study_blocks"], horizon, s["session_min_hours"], s["session_max_hours"], s["break_minutes"]
    )

    not_started = [t for t in core.all_topics() if prog[t["id"]]["status"] == "Not started"]
    last_remaining = [{"id": t["id"], "name": t["name"], "subject": t["subject"], "importance": t["importance"],
                       "difficulty": t["difficulty"]}
                       for t in sorted(not_started, key=lambda x: (scheduler.DIFF_RANK[x["difficulty"]], -x["importance"]))]

    return {
        "days_left": days_left, "total_hours_left": total_hours_left, "available_hours": available_hours,
        "on_track": on_track, "daily_budget": round(daily_budget, 2),
        "ranked": remaining, "calendar": calendar_days, "not_started": last_remaining,
    }


# ----------------------------------------------------------------------------- activity heatmap
@app.get("/api/activity")
def activity(days: int = 140):
    return {"days": days, "counts": core.get_activity(days)}


# ----------------------------------------------------------------------------- mock tests
class MockTestIn(BaseModel):
    name: str
    date: str
    total_marks: float
    obtained_marks: float
    breakdown: dict = {}
    notes: str = ""


@app.get("/api/mocktests")
def list_mock_tests():
    with conn() as c:
        rows = c.execute("SELECT * FROM mock_tests ORDER BY date").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["breakdown"] = json.loads(d["breakdown"]) if d["breakdown"] else {}
        except Exception:
            d["breakdown"] = {}
        out.append(d)
    return out


@app.post("/api/mocktests")
def add_mock_test(body: MockTestIn):
    with conn() as c:
        cur = c.execute(
            "INSERT INTO mock_tests(name,date,total_marks,obtained_marks,breakdown,notes) VALUES(?,?,?,?,?,?)",
            (body.name.strip() or "Mock test", body.date, body.total_marks, body.obtained_marks,
             json.dumps(body.breakdown), body.notes),
        )
        rid = cur.lastrowid
    return {"id": rid}


@app.delete("/api/mocktests/{tid}")
def del_mock_test(tid: int):
    with conn() as c:
        c.execute("DELETE FROM mock_tests WHERE id=?", (tid,))
    return {"ok": True}


# ----------------------------------------------------------------------------- flashcards (SRS)
def _card_row(r):
    return {"id": r["id"], "topic_id": r["topic_id"], "front": core.fix_latex(r["front"]), "back": core.fix_latex(r["back"]),
            "ease": r["ease"], "interval": r["interval"], "reps": r["reps"], "due_date": r["due_date"],
            "topic_name": core.topic_by_id().get(r["topic_id"], {}).get("name", r["topic_id"] or "General")}


@app.get("/api/flashcards")
def list_flashcards(topic_id: Optional[str] = None, due_only: bool = False):
    q = "SELECT * FROM flashcards"
    conds, params = [], []
    if topic_id:
        conds.append("topic_id=?"); params.append(topic_id)
    if due_only:
        conds.append("due_date<=?"); params.append(dt.date.today().isoformat())
    if conds:
        q += " WHERE " + " AND ".join(conds)
    q += " ORDER BY due_date"
    with conn() as c:
        rows = c.execute(q, params).fetchall()
    return [_card_row(r) for r in rows]


@app.get("/api/flashcards/stats")
def flashcard_stats():
    today = dt.date.today().isoformat()
    with conn() as c:
        total = c.execute("SELECT COUNT(*) n FROM flashcards").fetchone()["n"]
        due = c.execute("SELECT COUNT(*) n FROM flashcards WHERE due_date<=?", (today,)).fetchone()["n"]
        new = c.execute("SELECT COUNT(*) n FROM flashcards WHERE reps=0").fetchone()["n"]
        mature = c.execute("SELECT COUNT(*) n FROM flashcards WHERE interval>=21").fetchone()["n"]
    return {"total": total, "due": due, "new": new, "mature": mature}


class GenCardsIn(BaseModel):
    topic_id: str
    count: int = 8


@app.post("/api/flashcards/generate")
def generate_flashcards(body: GenCardsIn):
    topic = core.topic_by_id().get(body.topic_id)
    if not topic:
        raise HTTPException(404, "Unknown topic")
    n = max(3, min(15, body.count))
    try:
        data = llm.complete_json(
            FLASHCARD_SYS,
            f"Topic: {topic['subject']} > {topic['name']}\nSyllabus scope: {topic['scope']}\n"
            f'Generate exactly {n} flashcards. Return {{"cards": [{{"front": "...", "back": "..."}}, ...]}}',
            1800,
        )
    except llm.LLMError as e:
        raise HTTPException(400, str(e))
    cards = (data or {}).get("cards") or []
    if not cards:
        raise HTTPException(502, "Couldn't generate flashcards - try again")
    today = dt.date.today().isoformat()
    now = dt.datetime.now().isoformat(timespec="seconds")
    with conn() as c:
        for card in cards:
            f, b = core.fix_latex(str(card.get("front", "")).strip()), core.fix_latex(str(card.get("back", "")).strip())
            if f and b:
                c.execute(
                    "INSERT INTO flashcards(topic_id,front,back,ease,interval,reps,due_date,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    (body.topic_id, f, b, 2.5, 0, 0, today, now),
                )
    return {"created": len(cards)}


class ReviewIn(BaseModel):
    grade: str  # again | hard | good | easy


@app.post("/api/flashcards/{cid}/review")
def review_flashcard(cid: int, body: ReviewIn):
    if body.grade not in ("again", "hard", "good", "easy"):
        raise HTTPException(400, "Bad grade")
    with conn() as c:
        r = c.execute("SELECT * FROM flashcards WHERE id=?", (cid,)).fetchone()
        if not r:
            raise HTTPException(404, "Not found")
        ease, interval, reps, due = srs.schedule(r["ease"], r["interval"], r["reps"], body.grade)
        c.execute("UPDATE flashcards SET ease=?, interval=?, reps=?, due_date=? WHERE id=?",
                  (ease, interval, reps, due, cid))
    if r["topic_id"]:
        core.log_activity(r["topic_id"])
    return {"ease": ease, "interval": interval, "reps": reps, "due_date": due}


@app.delete("/api/flashcards/{cid}")
def delete_flashcard(cid: int):
    with conn() as c:
        c.execute("DELETE FROM flashcards WHERE id=?", (cid,))
    return {"ok": True}


# ----------------------------------------------------------------------------- settings
@app.get("/api/settings")
def get_settings():
    s = core.get_settings()
    return {"provider": s["provider"], "anthropic_model": s["anthropic_model"], "gemini_model": s["gemini_model"],
            "exam_date": s["exam_date"], "weekly_hours": s["weekly_hours"],
            "study_blocks": s["study_blocks"], "session_min_hours": s["session_min_hours"],
            "session_max_hours": s["session_max_hours"], "break_minutes": s["break_minutes"],
            "has_anthropic_key": bool(s["anthropic_key"]), "has_gemini_key": bool(s["gemini_key"])}


class StudyBlockIn(BaseModel):
    start: str
    end: str


class SettingsIn(BaseModel):
    provider: str = "Gemini"
    anthropic_key: str = ""
    gemini_key: str = ""
    anthropic_model: str = ""
    gemini_model: str = ""
    exam_date: str = ""
    weekly_hours: int = 20
    study_blocks: Optional[List[StudyBlockIn]] = None
    session_min_hours: Optional[float] = None
    session_max_hours: Optional[float] = None
    break_minutes: Optional[int] = None


@app.put("/api/settings")
def put_settings(body: SettingsIn):
    new = {"provider": body.provider, "weekly_hours": body.weekly_hours}
    if body.exam_date:
        new["exam_date"] = body.exam_date
    if body.anthropic_model.strip():
        new["anthropic_model"] = body.anthropic_model.strip()
    if body.gemini_model.strip():
        new["gemini_model"] = body.gemini_model.strip()
    if body.anthropic_key.strip():
        new["anthropic_key"] = body.anthropic_key.strip()
    if body.gemini_key.strip():
        new["gemini_key"] = body.gemini_key.strip()
    if body.study_blocks is not None:
        clean = []
        for b in body.study_blocks:
            try:
                sh, sm = map(int, b.start.split(":")); eh, em = map(int, b.end.split(":"))
                if 0 <= sh < 24 and 0 <= eh < 24 and (eh * 60 + em) > (sh * 60 + sm):
                    clean.append({"start": f"{sh:02d}:{sm:02d}", "end": f"{eh:02d}:{em:02d}"})
            except Exception:
                continue
        new["study_blocks"] = clean
    if body.session_min_hours is not None:
        new["session_min_hours"] = max(0.25, body.session_min_hours)
    if body.session_max_hours is not None:
        new["session_max_hours"] = max(new.get("session_min_hours", 0.25), body.session_max_hours)
    if body.break_minutes is not None:
        new["break_minutes"] = max(0, body.break_minutes)
    core.save_settings(new)
    return {"ok": True}


@app.post("/api/settings/test")
def test_llm():
    try:
        out = llm.complete("Reply with the single word OK.", "ping", 20)
        return {"ok": True, "reply": out[:100]}
    except llm.LLMError as e:
        return {"ok": False, "error": str(e)}


# ----------------------------------------------------------------------------- frontend (built React app)
WEB = core.ROOT / "web"
if WEB.exists():
    app.mount("/", StaticFiles(directory=str(WEB), html=True), name="web")
