"""Courses, subtopics, AI notes, study timer, practice tests (all the 'study' features)."""
import datetime as dt
import json
import re
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import core, llm
from .core import conn
from .syllabus import SUBJECT_ORDER

router = APIRouter(prefix="/api")


def sse(d):
    return f"data: {json.dumps(d)}\n\n"


def _now():
    return dt.datetime.now().isoformat(timespec="seconds")


# ----------------------------------------------------------------------------- prompts
LESSON_SYSTEM = """You are a patient tutor writing study notes for a GATE DA (Data Science & AI) student.
Write clear, compact, exam-relevant notes in Markdown (LaTeX allowed: $...$ inline, $$...$$ block).
Never invent URLs, book pages or citations. Use EXACTLY these headings, in this order:
## What is it?
(2-4 sentences in plain words)
## Why it matters
(1-3 lines: where it is used and how GATE / real projects use it)
## Syntax / Formula
(For programming: the general form in a fenced ```python block, with a one-line comment per part.
 For maths/theory: the key definitions and formulas.)
## Worked example
(ONE fully worked example, step by step. For code: show the code, then its exact output.)
## Common mistakes
(2-3 short bullets)
## Try it yourself
(Exactly ONE question: MCQ, NAT or a short coding task. Do NOT give the answer or a hint.
 End with: "Write your answer below and I'll check it.")
Double-check every calculation and every code output before writing it."""

CHECK_SYSTEM = """You are checking a GATE DA student's answer to the practice question at the end of the notes below.
First solve the question yourself, step by step, then compare. Reply in Markdown, compact:
**Verdict:** Correct / Partially correct / Incorrect
**What you got right / wrong**
**Correct solution** (step by step)
**Revise this** (the single sub-concept to review)
No greetings, no filler."""

SHORT_SYSTEM = """Condense the material into SHORT revision notes for a GATE DA student: at most 8 bullets,
formulas/syntax first, then 1-2 traps. Markdown. No filler, no headings longer than 3 words."""

PRACTICE_SYSTEM = """You write GATE DA (Data Science & AI) exam questions as strict JSON.
Return ONLY this JSON object (no prose, no code fences):
{"questions":[{"type":"mcq","q":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."},
              {"type":"nat","q":"...","answer":3.5,"explanation":"..."}]}
Rules:
- mcq: exactly 4 options, "answer" is the 0-based index of the single correct option.
- nat: numerical answer type, "answer" is a number (no units, no text).
- Write maths in plain text/unicode (x^2, sqrt(x), λ, Σ, ≤). Do NOT use LaTeX or backslashes anywhere.
- If a question contains code, write it on a single line with ';' between statements (no line breaks).
- Every question must be unambiguous and its answer verified. explanation: max 3 short lines.
- Include a mix of 1-mark (easy) and 2-mark (harder) style questions, about 30% NAT."""

KIND_NOTES = {
    "pyq": "Write questions in the style, depth and phrasing of GATE DA previous-year papers. They are PYQ-STYLE questions - never claim a question is from a specific year.",
    "practice": "Write practice questions that start easy and end at GATE level, focused on the scope given.",
    "mock": "Write a balanced weekly mock test across ALL the topics listed (spread questions over them), mixing easy, medium and hard, in GATE style.",
}


# ----------------------------------------------------------------------------- topics & subtopics
class TopicIn(BaseModel):
    subject: str
    name: str
    section: str = ""
    difficulty: str = "Medium"
    importance: int = 3
    hours: float = 4
    subtopics: List[str] = []


@router.post("/topics")
def add_topic(b: TopicIn):
    if b.subject not in SUBJECT_ORDER:
        raise HTTPException(400, "Unknown subject")
    if not b.name.strip():
        raise HTTPException(400, "Topic name is required")
    diff = b.difficulty if b.difficulty in ("Easy", "Medium", "Hard") else "Medium"
    with conn() as c:
        cur = c.execute("INSERT INTO custom_topics(subject,name,section,difficulty,importance,hours) VALUES(?,?,?,?,?,?)",
                        (b.subject, b.name.strip(), b.section.strip(), diff, max(1, min(5, b.importance)), max(0.5, b.hours)))
        tid = core.custom_tid(cur.lastrowid)
        for i, n in enumerate([x.strip() for x in b.subtopics if x.strip()]):
            c.execute("INSERT INTO subtopics(topic_id,name,pos) VALUES(?,?,?)", (tid, n, i))
    return {"id": tid}


class TopicEdit(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    difficulty: Optional[str] = None
    hours: Optional[float] = None


def _custom_id(tid: str) -> int:
    if not tid.startswith("CU-"):
        raise HTTPException(400, "Only topics you added can be edited or deleted (built-in topics can have subtopics added/removed).")
    try:
        return int(tid[3:])
    except ValueError:
        raise HTTPException(404, "Unknown topic")


@router.put("/topics/{tid}")
def edit_topic(tid: str, b: TopicEdit):
    n = _custom_id(tid)
    with conn() as c:
        if b.name and b.name.strip():
            c.execute("UPDATE custom_topics SET name=? WHERE id=?", (b.name.strip(), n))
        if b.section is not None:
            c.execute("UPDATE custom_topics SET section=? WHERE id=?", (b.section.strip(), n))
        if b.difficulty in ("Easy", "Medium", "Hard"):
            c.execute("UPDATE custom_topics SET difficulty=? WHERE id=?", (b.difficulty, n))
        if b.hours:
            c.execute("UPDATE custom_topics SET hours=? WHERE id=?", (max(0.5, b.hours), n))
    return {"ok": True}


@router.delete("/topics/{tid}")
def delete_topic(tid: str):
    n = _custom_id(tid)
    with conn() as c:
        c.execute("DELETE FROM custom_topics WHERE id=?", (n,))
        for t in ("subtopics", "progress", "links", "topic_files", "flashcards", "study_sessions", "practice_results"):
            c.execute(f"DELETE FROM {t} WHERE topic_id=?", (tid,))
    return {"ok": True}


class SubIn(BaseModel):
    name: str


@router.post("/topics/{tid}/subtopics")
def add_subtopic(tid: str, b: SubIn):
    if tid not in core.topic_by_id():
        raise HTTPException(404, "Unknown topic")
    if not b.name.strip():
        raise HTTPException(400, "Name is required")
    with conn() as c:
        pos = (c.execute("SELECT COALESCE(MAX(pos),-1)+1 p FROM subtopics WHERE topic_id=?", (tid,)).fetchone()["p"])
        cur = c.execute("INSERT INTO subtopics(topic_id,name,pos) VALUES(?,?,?)", (tid, b.name.strip(), pos))
    core.sync_topic_status(tid)
    return {"id": cur.lastrowid}


class SubEdit(BaseModel):
    name: Optional[str] = None
    done: Optional[bool] = None
    notes: Optional[str] = None
    short: Optional[str] = None


def _sub(sid: int):
    with conn() as c:
        r = c.execute("SELECT * FROM subtopics WHERE id=?", (sid,)).fetchone()
    if not r:
        raise HTTPException(404, "Unknown subtopic")
    return dict(r)


@router.get("/subtopics/{sid}")
def get_subtopic(sid: int):
    r = _sub(sid)
    t = core.topic_by_id().get(r["topic_id"], {})
    return {**r, "done": bool(r["done"]), "topic": t.get("name", ""), "subject": t.get("subject", "")}


@router.put("/subtopics/{sid}")
def edit_subtopic(sid: int, b: SubEdit):
    r = _sub(sid)
    with conn() as c:
        if b.name and b.name.strip():
            c.execute("UPDATE subtopics SET name=? WHERE id=?", (b.name.strip(), sid))
        if b.done is not None:
            c.execute("UPDATE subtopics SET done=? WHERE id=?", (1 if b.done else 0, sid))
        if b.notes is not None:
            c.execute("UPDATE subtopics SET notes=?, updated=? WHERE id=?", (b.notes, _now(), sid))
        if b.short is not None:
            c.execute("UPDATE subtopics SET short=?, updated=? WHERE id=?", (b.short, _now(), sid))
    if b.done:
        core.log_activity(r["topic_id"])
    if b.done is not None:
        core.sync_topic_status(r["topic_id"])
    return {"ok": True}


@router.delete("/subtopics/{sid}")
def delete_subtopic(sid: int):
    r = _sub(sid)
    with conn() as c:
        c.execute("DELETE FROM subtopics WHERE id=?", (sid,))
    core.sync_topic_status(r["topic_id"])
    return {"ok": True}


@router.get("/notes")
def all_notes():
    topics = core.topic_by_id()
    with conn() as c:
        rows = c.execute("SELECT * FROM subtopics WHERE notes!='' OR short!='' ORDER BY updated DESC").fetchall()
    out = []
    for r in rows:
        t = topics.get(r["topic_id"], {})
        out.append({"id": r["id"], "topic_id": r["topic_id"], "topic": t.get("name", ""), "subject": t.get("subject", ""),
                    "subtopic": r["name"], "notes": r["notes"], "short": r["short"], "updated": r["updated"],
                    "has_lesson": bool(r["ai_notes"])})
    return out


# ----------------------------------------------------------------------------- AI lesson / check / short notes
class LessonIn(BaseModel):
    regenerate: bool = False


def _context(r):
    t = core.topic_by_id().get(r["topic_id"], {})
    with conn() as c:
        sibs = [x["name"] for x in c.execute("SELECT name FROM subtopics WHERE topic_id=? ORDER BY pos,id", (r["topic_id"],))]
    prog = core.get_progress().get(r["topic_id"], {})
    ctx = (f"Subject: {t.get('subject','')}\nTopic: {t.get('name','')} ({t.get('scope','')})\n"
           f"Section: {t.get('section') or '-'}\nSUBTOPIC TO TEACH NOW: {r['name']}\n"
           f"Other subtopics in this topic (do not teach these now): {', '.join(s for s in sibs if s != r['name']) or '-'}\n"
           f"Student's confidence on the topic: {prog.get('confidence', 0)}/5")
    return t, ctx


@router.post("/subtopics/{sid}/lesson")
def make_lesson(sid: int, b: LessonIn):
    r = _sub(sid)
    if r["ai_notes"] and not b.regenerate:
        return StreamingResponse(iter([sse({"type": "token", "text": r["ai_notes"]}), sse({"type": "done"})]),
                                 media_type="text/event-stream")
    t, ctx = _context(r)
    code_hint = "\nThis is a Python programming topic: use Python 3 code blocks." if t.get("section") == "Python" else ""

    def gen():
        full = ""
        try:
            for tok in llm.stream(LESSON_SYSTEM + code_hint, [{"role": "user", "content": ctx}], 2600):
                full += tok
                yield sse({"type": "token", "text": tok})
            if full.strip():
                with conn() as c:
                    c.execute("UPDATE subtopics SET ai_notes=? WHERE id=?", (full, sid))
                core.log_activity(r["topic_id"])
        except llm.LLMError as e:
            yield sse({"type": "error", "text": str(e)})
        except Exception as e:  # noqa
            yield sse({"type": "error", "text": f"Unexpected error: {e}"})
        yield sse({"type": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class CheckIn(BaseModel):
    answer: str


@router.post("/subtopics/{sid}/check")
def check_answer(sid: int, b: CheckIn):
    r = _sub(sid)
    if not r["ai_notes"]:
        raise HTTPException(400, "Generate the notes first - the question is at the end of them.")
    msg = f"NOTES (the practice question is at the end):\n{r['ai_notes']}\n\nSTUDENT'S ANSWER:\n{b.answer}"

    def gen():
        try:
            for tok in llm.stream(CHECK_SYSTEM, [{"role": "user", "content": msg}], 1500):
                yield sse({"type": "token", "text": tok})
        except llm.LLMError as e:
            yield sse({"type": "error", "text": str(e)})
        except Exception as e:  # noqa
            yield sse({"type": "error", "text": f"Unexpected error: {e}"})
        yield sse({"type": "done"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/subtopics/{sid}/shortnotes")
def short_notes(sid: int):
    r = _sub(sid)
    src = "\n\n".join(x for x in (r["notes"], r["ai_notes"]) if x.strip())
    if not src:
        raise HTTPException(400, "Nothing to condense yet - generate the notes or write your own first.")
    try:
        out = llm.complete(SHORT_SYSTEM, f"Subtopic: {r['name']}\n\n{src[:9000]}", 700)
    except llm.LLMError as e:
        raise HTTPException(400, str(e))
    with conn() as c:
        c.execute("UPDATE subtopics SET short=?, updated=? WHERE id=?", (out, _now(), sid))
    return {"short": out}


# ----------------------------------------------------------------------------- study clock
class SessionIn(BaseModel):
    topic_id: str = ""
    subject: str = ""
    seconds: int
    started: str = ""
    note: str = ""


@router.post("/study/sessions")
def add_session(b: SessionIn):
    if b.seconds < 5:
        return {"ok": False, "skipped": "under 5 seconds"}
    subject = b.subject
    if b.topic_id:
        t = core.topic_by_id().get(b.topic_id)
        if t:
            subject = t["subject"]
    with conn() as c:
        c.execute("INSERT INTO study_sessions(topic_id,subject,seconds,date,started,note) VALUES(?,?,?,?,?,?)",
                  (b.topic_id, subject or "General", min(b.seconds, 12 * 3600), dt.date.today().isoformat(),
                   b.started or _now(), b.note))
    if b.topic_id:
        core.log_activity(b.topic_id)
    return {"ok": True}


@router.delete("/study/sessions/{sid}")
def del_session(sid: int):
    with conn() as c:
        c.execute("DELETE FROM study_sessions WHERE id=?", (sid,))
    return {"ok": True}


@router.get("/study/summary")
def study_summary():
    s = core.study_summary()
    names = {k: v["name"] for k, v in core.topic_by_id().items()}
    for r in s["recent"]:
        r["topic_name"] = names.get(r["topic_id"], "")
    return s


# ----------------------------------------------------------------------------- practice / PYQ-style / weekly mock
class PracticeIn(BaseModel):
    subject: str
    topic_id: str = ""
    kind: str = "practice"  # pyq | practice | mock
    n: int = 5


def _parse_questions(txt: str):
    a, b = txt.find("{"), txt.rfind("}")
    if a == -1 or b == -1:
        return []
    data = llm.loads_lenient(txt[a:b + 1])
    if not data:
        return []
    out = []
    for q in data.get("questions", []):
        try:
            text = str(q["q"]).strip()
            typ = q.get("type", "mcq")
            if typ == "nat":
                out.append({"type": "nat", "q": text, "answer": float(q["answer"]), "explanation": str(q.get("explanation", ""))})
            else:
                opts = [str(o) for o in q["options"]][:4]
                ans = int(q["answer"])
                if len(opts) >= 2 and 0 <= ans < len(opts) and text:
                    out.append({"type": "mcq", "q": text, "options": opts, "answer": ans,
                                "explanation": str(q.get("explanation", ""))})
        except Exception:
            continue
    return out


@router.post("/practice/generate")
def generate_practice(b: PracticeIn):
    if b.subject not in SUBJECT_ORDER:
        raise HTTPException(400, "Unknown subject")
    kind = b.kind if b.kind in KIND_NOTES else "practice"
    n = max(3, min(20, b.n))
    topics = [t for t in core.all_topics() if t["subject"] == b.subject]
    prog = core.get_progress()
    if b.topic_id:
        t = core.topic_by_id().get(b.topic_id)
        if not t:
            raise HTTPException(404, "Unknown topic")
        scope = f"Topic: {t['name']} - {t['scope']}"
    else:
        studied = [t for t in topics if prog[t["id"]]["status"] != "Not started"]
        pool = studied if (kind == "mock" and len(studied) >= 3) else topics
        scope = "Topics: " + "; ".join(f"{t['name']} ({t['scope']})" for t in pool)
    prompt = (f"Subject: {b.subject}\n{scope}\nNumber of questions: {n}\n{KIND_NOTES[kind]}")
    try:
        txt = llm.complete(PRACTICE_SYSTEM, prompt, 450 * n + 1000)
    except llm.LLMError as e:
        raise HTTPException(400, str(e))
    qs = _parse_questions(txt)
    if not qs:
        raise HTTPException(502, "The AI's reply couldn't be read as questions. Please try again.")
    return {"questions": qs[:n], "kind": kind}


class ResultIn(BaseModel):
    subject: str
    topic_id: str = ""
    kind: str
    score: float
    total: int


@router.post("/practice/result")
def save_result(b: ResultIn):
    with conn() as c:
        c.execute("INSERT INTO practice_results(subject,topic_id,kind,score,total,date) VALUES(?,?,?,?,?,?)",
                  (b.subject, b.topic_id, b.kind if b.kind in KIND_NOTES else "practice", b.score, b.total,
                   dt.date.today().isoformat()))
    if b.topic_id:
        core.log_activity(b.topic_id)
    return {"ok": True}
