# GATE DA Companion (v3)

Study app for GATE DA 2027: **courses with topics and subtopics, AI-written notes, a study clock,
practice / PYQ-style / weekly mock tests, your own notes, a priority plan, flashcards, and an AI tutor.**

## 1. Run it on your computer (2 minutes)

You need **Python 3.10+** (python.org). Nothing else: the app is already built.

- **Windows:** double-click `run.bat`
- **Mac / Linux:** open a terminal in this folder and run `./run.sh`
  (if it says "Permission denied": `chmod +x run.sh` once)

The first run installs the packages, then opens **http://localhost:8765**. Next time, run the same file again.

## 2. Add your API key (needed for AI notes, tests, tutor)

1. Open the app, click **Settings & API key** (bottom of the left menu, or *More* on a phone).
2. Choose **Gemini** (free) or **Anthropic** (paid, Claude).
   - Gemini key: https://aistudio.google.com/apikey  -> *Create API key* (starts with `AIza`)
   - Claude key: https://console.anthropic.com/ -> *API keys* (starts with `sk-ant-`)
3. Paste it in the matching box, press **Save settings**, then **Test AI connection**.

Everything except AI generation (courses, tracking, clock, your notes) works without a key.

## 3. How to use it

- **Courses**: one card per subject. *Start course* -> topics in order, basics first. *Programming & DSA* is
  split into **Part 1: Python** and **Part 2: DSA**. Tick subtopics as you finish them; topic status updates itself.
- **Open a topic**: course/book links, your saved links, subtopic list, status and confidence.
- **Open a subtopic**: **Generate notes** -> what it is, why it matters, syntax/formula, worked example,
  common mistakes, then **one question to solve yourself**. Type your answer and the AI checks it.
  The **My notes** tab autosaves your own notes; **Short notes** are your quick-revision bullets
  (write them or press *Condense with AI*). Everything is collected on the **Notes** page (searchable, exportable).
- **Practice / PYQ-style test / Weekly mock test**: buttons at the top of every course (and per topic).
  Results are saved per course; the mock test shows "due" if you haven't taken one in 7 days.
  *PYQ-style* means written in the style of past papers, not copies of real ones (a link to real PYQs is provided).
- **Study clock**: header on every page. Stopwatch or 25/45/60/90 min countdown, tied to a topic.
  Stop saves the time to that topic and subject; it survives a page refresh. Hours show on each course card.
- **Add / edit content**: *Add a topic* at the bottom of any course; *Add a subtopic* inside any topic;
  trash icons remove subtopics (and your own topics). Built-in topics can't be deleted, only their subtopics.

## 4. Deploy it online (use it from phone/laptop anywhere)

Read **DEPLOY.md** for step-by-step instructions (Render at about $7/month, or a free Oracle VM). In short:
you need a host with a **persistent disk** for `data/`, and you should set **`APP_PASSWORD`** so only you can open it.

## 5. Back up your data

Settings > **Your data & backup** > *Download backup* gives you a zip (no API key inside); *Restore* loads one back (use it to move servers).
A snapshot is also saved daily in `data/backups`. The whole `data/` folder is your data; don't share it (it holds your API key).

## 6. Changing things

- Syllabus topics: `backend/syllabus.py` (or just use the in-app Add buttons).
- Your daily study windows and exam date: **Settings**.
- UI source is in `frontend/src`. After editing: `./rebuild_frontend.sh` (needs Node.js 18+).
