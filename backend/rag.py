"""RAG engine.

Index: PDFs/TXT/MD in the library are split into overlapping passages (SQLite).
Search: local BM25 (no embeddings/API needed), multi-query with Reciprocal Rank Fusion.
Pipeline ("thinking" RAG): plan queries -> retrieve -> LLM relevance grading -> answer with citations.
"""
import datetime as dt
import math
import re
from collections import Counter

from . import llm
from .core import INDEXABLE, all_files, conn, kv_get, kv_set, safe_path

_STOP = set("the a an of and or to in is are for on with as by at from that this it be was were what why how does do".split())
_CACHE = {"version": None, "ix": None}


def _tok(text):
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 1 and w not in _STOP]


def _chunk(text, size=1000, overlap=160):
    text = re.sub(r"\s+", " ", text).strip()
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i + size])
        i += size - overlap
    return out


# ----------------------------------------------------------------------------- indexing
def status():
    with conn() as c:
        chunks = c.execute("SELECT COUNT(*) n FROM chunks").fetchone()["n"]
        files = c.execute("SELECT COUNT(*) n FROM indexed_files").fetchone()["n"]
    indexable = [f for f in all_files() if f["path"].lower().endswith(INDEXABLE)]
    with conn() as c:
        known = {r["rel_path"]: (r["mtime"], r["size"]) for r in c.execute("SELECT rel_path,mtime,size FROM indexed_files")}
    pending = sum(1 for f in indexable if known.get(f["path"]) != (f["mtime"], f["size"]))
    return {"indexed_files": files, "chunks": chunks, "indexable_files": len(indexable), "pending": pending}


def index_library():
    from pypdf import PdfReader

    files = [f["path"] for f in all_files() if f["path"].lower().endswith(INDEXABLE)]
    with conn() as c:
        known = {r["rel_path"]: (r["mtime"], r["size"]) for r in c.execute("SELECT rel_path,mtime,size FROM indexed_files")}
        for gone in set(known) - set(files):
            c.execute("DELETE FROM chunks WHERE rel_path=?", (gone,))
            c.execute("DELETE FROM indexed_files WHERE rel_path=?", (gone,))
    stats = {"files": 0, "chunks": 0, "empty": [], "failed": []}
    for rel in files:
        p = safe_path(rel)
        stt = p.stat()
        if known.get(rel) == (stt.st_mtime, stt.st_size):
            continue
        try:
            if rel.lower().endswith(".pdf"):
                pages = [(i, pg.extract_text() or "") for i, pg in enumerate(PdfReader(str(p)).pages, 1)]
            else:
                pages = [(1, p.read_text(errors="ignore"))]
        except Exception:
            stats["failed"].append(rel)
            continue
        rows = [(rel, pg, ch) for pg, tx in pages for ch in _chunk(tx) if len(ch) > 40]
        with conn() as c:
            c.execute("DELETE FROM chunks WHERE rel_path=?", (rel,))
            c.executemany("INSERT INTO chunks(rel_path,page,text) VALUES(?,?,?)", rows)
            c.execute("INSERT OR REPLACE INTO indexed_files(rel_path,mtime,size) VALUES(?,?,?)",
                      (rel, stt.st_mtime, stt.st_size))
        if not rows:
            stats["empty"].append(rel)
        stats["files"] += 1
        stats["chunks"] += len(rows)
    kv_set("index_version", str(dt.datetime.now().timestamp()))
    return stats


def _load_index():
    ver = kv_get("index_version", "0")
    if _CACHE["version"] == ver and _CACHE["ix"] is not None:
        return _CACHE["ix"]
    with conn() as c:
        rows = c.execute("SELECT rel_path, page, text FROM chunks ORDER BY id").fetchall()
    tfs = [Counter(_tok(r["text"])) for r in rows]
    df = Counter()
    for tf in tfs:
        df.update(tf.keys())
    lens = [sum(tf.values()) for tf in tfs]
    ix = {"meta": [(r["rel_path"], r["page"], r["text"]) for r in rows], "tfs": tfs, "lens": lens, "df": df,
          "avgdl": (sum(lens) / len(lens)) if lens else 1.0, "N": len(rows)}
    _CACHE.update(version=ver, ix=ix)
    return ix


# ----------------------------------------------------------------------------- search
def bm25(query, k=12, folder=""):
    ix = _load_index()
    q = _tok(query)
    if not q or not ix["N"]:
        return []
    k1, b, N = 1.5, 0.75, ix["N"]
    scored = []
    for i, (tf, L) in enumerate(zip(ix["tfs"], ix["lens"])):
        rel = ix["meta"][i][0]
        if folder and not rel.startswith(folder + "/"):
            continue
        sc = 0.0
        for w in q:
            f = tf.get(w, 0)
            if f:
                idf = math.log(1 + (N - ix["df"][w] + 0.5) / (ix["df"][w] + 0.5))
                sc += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * L / ix["avgdl"]))
        if sc > 0:
            scored.append((sc, i))
    scored.sort(reverse=True)
    return [(i, sc) for sc, i in scored[:k]]


def multi_search(queries, k=10, folder=""):
    """Reciprocal Rank Fusion across several queries."""
    ix = _load_index()
    fused = Counter()
    for q in queries:
        for rank, (i, _) in enumerate(bm25(q, 14, folder)):
            fused[i] += 1.0 / (60 + rank)
    out = []
    for i, sc in fused.most_common(k):
        rel, page, text = ix["meta"][i]
        out.append({"id": i, "rel": rel, "page": page, "text": text, "score": round(sc * 60, 3)})
    return out


def format_context(hits):
    return "\n\n".join(f"[{h['rel']} | p.{h['page']}]\n{h['text']}" for h in hits)


# ----------------------------------------------------------------------------- pipeline
PLAN_SYS = "You plan document retrieval for a GATE DA (Data Science & AI) study assistant."
GRADE_SYS = "You are a strict relevance judge for a GATE DA study assistant."


def pipeline(question, topic_hint="", folder="", deep=True):
    """Generator of events: {'type':'step','text'} ... then one {'type':'context','hits','coverage'}."""
    st = status()
    if st["chunks"] == 0:
        yield {"type": "step", "text": "Library isn't indexed yet, so I'll answer from general knowledge. Index your PDFs in 'Ask Library'."}
        yield {"type": "context", "hits": [], "coverage": "none"}
        return

    queries = [question]
    if deep:
        yield {"type": "step", "text": "Understanding the question and planning searches"}
        try:
            plan = llm.complete_json(
                PLAN_SYS,
                f"Topic context: {topic_hint or 'none'}\nStudent message: {question}\n\n"
                'Return {"intent": "<one line>", "queries": ["<2-4 keyword-style search queries that would match textbook wording, '
                'including synonyms and the formal name of the concept>"]}',
                500,
            )
        except llm.LLMError:
            raise
        if plan and isinstance(plan.get("queries"), list) and plan["queries"]:
            queries = [str(q) for q in plan["queries"][:4]] + [question]
            yield {"type": "step", "text": f"Intent: {plan.get('intent', '—')} · searching {len(queries)} angles"}

    hits = multi_search(queries, 10, folder)
    if not hits:
        yield {"type": "step", "text": "No matching passages in your library for this question"}
        yield {"type": "context", "hits": [], "coverage": "none"}
        return
    files = sorted({h["rel"] for h in hits})
    yield {"type": "step", "text": f"Retrieved {len(hits)} candidate passages from {len(files)} file(s)"}

    coverage = "partial"
    if deep and len(hits) > 1:
        yield {"type": "step", "text": "Judging which passages actually answer the question"}
        listing = "\n\n".join(f"#{n} [{h['rel']} p.{h['page']}]\n{h['text'][:450]}" for n, h in enumerate(hits))
        g = llm.complete_json(
            GRADE_SYS,
            f"Question: {question}\n\nCandidate passages:\n{listing}\n\n"
            'Return {"relevant": [<indices of passages that genuinely help answer, best first, max 6>], '
            '"coverage": "full|partial|none", "gap": "<what is missing from the passages, or empty>"}',
            400,
        )
        if g and isinstance(g.get("relevant"), list):
            keep = [hits[i] for i in g["relevant"] if isinstance(i, int) and 0 <= i < len(hits)]
            coverage = g.get("coverage", "partial") if g.get("coverage") in ("full", "partial", "none") else "partial"
            if keep:
                hits = keep[:6]
            elif coverage == "none":
                hits = []
            yield {"type": "step", "text": f"Kept {len(hits)} relevant passage(s) · coverage: {coverage}"
                   + (f" · gap: {g['gap']}" if g.get("gap") else "")}
        else:
            hits = hits[:6]
    else:
        hits = hits[:6]
    yield {"type": "context", "hits": hits, "coverage": coverage}
