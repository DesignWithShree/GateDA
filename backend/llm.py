"""LLM layer with automatic fallback.

Providers are tried in order. If one is out of quota / rate-limited / down, the next one is used
automatically (and the failing one is skipped for a while), so a single free quota running out never
blocks you.  Keys come from Settings (Gemini / Anthropic) or environment variables:
    GROQ_API_KEY        free, no card  -> console.groq.com        (recommended first choice)
    GEMINI_API_KEY      free tier      -> aistudio.google.com/apikey
    OPENROUTER_API_KEY  free models    -> openrouter.ai           (optional extra backup)
    ANTHROPIC_API_KEY   paid           -> console.anthropic.com
"""
import json
import os
import re
import time

import requests

from .core import get_settings


class LLMError(RuntimeError):
    pass


class _ProviderError(Exception):
    def __init__(self, status, text):
        super().__init__(text)
        self.status, self.text = status, text


# (provider, model, extra payload). Groq limits are per model, so several Groq models = several quotas.
GROQ_MODELS = [
    ("llama-3.3-70b-versatile", {}),
    ("openai/gpt-oss-120b", {"reasoning_effort": "low"}),
    ("llama-3.1-8b-instant", {}),
]
GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]   # separate quotas per model
OPENROUTER_MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "openai/gpt-oss-120b:free"]

_cool = {}   # "provider/model" -> unix time until which we skip it


def _clean_history(messages, limit=16):
    msgs = [{"role": m["role"], "content": m["content"]} for m in messages][-limit:]
    while msgs and msgs[0]["role"] != "user":
        msgs = msgs[1:]
    return msgs


def _cooldown_seconds(status, text):
    """How long to skip a provider after it failed."""
    t = text or ""
    m = re.search(r"try again in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?", t)
    if m and any(m.groups()):
        h, mi, s = (float(x) if x else 0 for x in m.groups())
        return max(20, min(h * 3600 + mi * 60 + s + 5, 6 * 3600))
    if status in (401, 403):
        return 3600
    if status == 404:
        return 6 * 3600
    if re.search(r"per ?day|daily|TPD|RPD|quota", t, re.I):
        return 3600
    return 120


def _short(text, n=140):
    t = re.sub(r"\s+", " ", text or "").strip()
    return t[:n] + ("..." if len(t) > n else "")


# ----------------------------------------------------------------------------- provider calls
def _openai_compatible(base, key, model, system, messages, max_tokens, extra=None, headers=None):
    payload = {"model": model, "stream": True, "max_tokens": min(max_tokens, 5000),
               "messages": [{"role": "system", "content": system}] + messages}
    h = {"Authorization": f"Bearer {key}", **(headers or {})}
    for attempt in (0, 1):
        body = dict(payload, **(extra or {})) if attempt == 0 else payload
        with requests.post(f"{base}/chat/completions", headers=h, json=body, stream=True, timeout=180) as r:
            r.encoding = "utf-8"
            if r.status_code == 400 and attempt == 0 and extra:
                continue                      # an optional parameter was rejected: retry without it
            if r.status_code != 200:
                raise _ProviderError(r.status_code, r.text[:400])
            for line in r.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    return
                try:
                    d = json.loads(data)
                except Exception:
                    continue
                for ch in d.get("choices", []):
                    c = (ch.get("delta") or {}).get("content")
                    if c:
                        yield c
            return


def _gemini(key, model, system, messages, max_tokens):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "model" if m["role"] == "assistant" else "user",
                      "parts": [{"text": m["content"]}]} for m in messages],
        "generationConfig": {"maxOutputTokens": max_tokens + 2000},
    }
    with requests.post(url, params={"alt": "sse"}, headers={"x-goog-api-key": key},
                       json=payload, stream=True, timeout=180) as r:
        r.encoding = "utf-8"
        if r.status_code != 200:
            raise _ProviderError(r.status_code, r.text[:400])
        for line in r.iter_lines(decode_unicode=True):
            if line and line.startswith("data:"):
                try:
                    d = json.loads(line[5:].strip())
                except Exception:
                    continue
                for cand in d.get("candidates", []):
                    for part in cand.get("content", {}).get("parts", []):
                        if part.get("text"):
                            yield part["text"]


def _anthropic(key, model, system, messages, max_tokens):
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        with client.messages.stream(model=model, max_tokens=max_tokens, system=system, messages=messages) as st:
            for t in st.text_stream:
                yield t
    except Exception as e:
        code = getattr(e, "status_code", 500)
        raise _ProviderError(code if isinstance(code, int) else 500, str(e))


def _plan(s):
    """Ordered list of (label, callable(system, messages, max_tokens)) for every provider that has a key."""
    groq = s.get("groq_key") or os.environ.get("GROQ_API_KEY", "")
    orkey = s.get("openrouter_key") or os.environ.get("OPENROUTER_API_KEY", "")
    plan = {"groq": [], "gemini": [], "openrouter": [], "anthropic": []}
    if groq:
        for m, extra in GROQ_MODELS:
            plan["groq"].append((f"Groq {m}", lambda sy, ms, mt, m=m, extra=extra:
                                 _openai_compatible("https://api.groq.com/openai/v1", groq, m, sy, ms, mt, extra)))
    if s.get("gemini_key"):
        for m in ([s["gemini_model"]] if s.get("gemini_model") else []) + GEMINI_MODELS:
            if not any(m in lbl for lbl, _ in plan["gemini"]):
                plan["gemini"].append((f"Gemini {m}", lambda sy, ms, mt, m=m: _gemini(s["gemini_key"], m, sy, ms, mt)))
    if orkey:
        for m in OPENROUTER_MODELS:
            plan["openrouter"].append((f"OpenRouter {m}", lambda sy, ms, mt, m=m: _openai_compatible(
                "https://openrouter.ai/api/v1", orkey, m, sy, ms, mt,
                headers={"HTTP-Referer": "https://localhost", "X-Title": "GATE DA Companion"})))
    if s.get("anthropic_key"):
        plan["anthropic"].append((f"Claude {s['anthropic_model']}", lambda sy, ms, mt:
                                  _anthropic(s["anthropic_key"], s["anthropic_model"], sy, ms, mt)))
    # Your chosen provider in Settings wins only if it is Anthropic (paid, no quota trouble);
    # otherwise the free providers with the most generous limits go first.
    order = ["anthropic", "groq", "gemini", "openrouter"] if s.get("provider") == "Anthropic" \
        else ["groq", "gemini", "openrouter", "anthropic"]
    return [item for p in order for item in plan[p]]


def stream(system: str, messages: list, max_tokens: int = 2500):
    """Yield text chunks, falling back to the next provider on quota / rate-limit / outage errors."""
    s = get_settings()
    messages = _clean_history(messages)
    if not messages:
        raise LLMError("Nothing to send.")
    plan = _plan(s)
    if not plan:
        raise LLMError("No AI key found. Add a free Groq key (env var GROQ_API_KEY, from console.groq.com) "
                       "or a Gemini key in Settings.")
    now = time.time()
    ready = [p for p in plan if _cool.get(p[0], 0) <= now]
    tried_cooling = False
    if not ready:                      # everything is cooling down: try them all again anyway
        ready, tried_cooling = plan, True
    failures = []
    for label, call in ready:
        started = False
        try:
            for chunk in call(system, messages, max_tokens):
                started = True
                yield chunk
            if started:
                return
            failures.append((label, "empty reply"))
            _cool[label] = time.time() + 60
        except _ProviderError as e:
            if started:
                raise LLMError(f"{label} stopped midway: {_short(e.text)}")
            _cool[label] = time.time() + _cooldown_seconds(e.status, e.text)
            failures.append((label, f"{e.status}: {_short(e.text)}"))
        except LLMError:
            raise
        except Exception as e:
            if started:
                raise LLMError(f"{label} stopped midway: {e}")
            _cool[label] = time.time() + 60
            failures.append((label, _short(str(e))))
    detail = "; ".join(f"{l} -> {m}" for l, m in failures[:4])
    raise LLMError("Every AI provider is out of free quota or busy right now"
                   + (" (retried after cooldown)" if tried_cooling else "")
                   + f". Try again in a few minutes, or add another free key (Groq: console.groq.com). Details: {detail}")


def complete(system: str, prompt: str, max_tokens: int = 1200) -> str:
    return "".join(stream(system, [{"role": "user", "content": prompt}], max_tokens)).strip()


# LaTeX commands that start with b/f/n/r/t/u, i.e. look like JSON escapes (\b \f \n \r \t \u)
_AMBIG = set("""beta bar begin binom boldsymbol big bigg bigcup bigcap bigoplus forall frac flat neq nu nabla not notin ne
nleq ngeq nmid ncong newline nsubseteq rho rightarrow right rangle rceil rfloor rm theta tau times text to top tilde triangle
textbf textit underline upsilon uparrow underbrace uplus""".split())
_ESC = re.compile(r'\\\\|\\([a-zA-Z]+)|\\(?![\\"/bfnrtu])')


def repair_json_latex(raw: str) -> str:
    """LLMs write LaTeX like \\forall / \\beta / \\theta inside JSON strings, where \\f, \\b, \\t are control
    escapes (so \\forall silently becomes a form-feed + 'orall'). Double those backslashes so they survive,
    while real JSON escapes (\\n, \\", \\\\ ...) are left alone."""
    def fix(m):
        if m.group(0) == "\\\\":
            return m.group(0)
        w = m.group(1)
        if w is None:                      # backslash + non-letter that JSON doesn't allow, e.g. \{ or \,
            return "\\\\"
        if w[0] in "bfnrtu":               # ambiguous: only LaTeX if it is a known command
            return "\\\\" + w if w in _AMBIG else m.group(0)
        return "\\\\" + w                  # \alpha, \in, \sum, \pi ...
    return _ESC.sub(fix, raw)


def loads_lenient(raw: str):
    for cand in (repair_json_latex(raw), raw):
        try:
            return json.loads(cand)
        except Exception:
            continue
    return None


def complete_json(system: str, prompt: str, max_tokens: int = 800):
    """Ask for JSON and parse the first {...} block. Returns None if it can't be parsed."""
    try:
        txt = complete(system + "\nReturn ONLY valid JSON, no prose, no code fences.", prompt, max_tokens)
    except LLMError:
        raise
    a, b = txt.find("{"), txt.rfind("}")
    if a == -1 or b == -1:
        return None
    return loads_lenient(txt[a:b + 1])
