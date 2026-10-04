"""LLM layer: streaming + blocking calls for Anthropic and Gemini."""
import json
import re

import requests

from .core import get_settings


class LLMError(RuntimeError):
    pass


def _clean_history(messages, limit=16):
    msgs = [{"role": m["role"], "content": m["content"]} for m in messages][-limit:]
    while msgs and msgs[0]["role"] != "user":
        msgs = msgs[1:]
    return msgs


def stream(system: str, messages: list, max_tokens: int = 2500):
    """Yield text chunks. Raises LLMError on configuration/API problems."""
    s = get_settings()
    messages = _clean_history(messages)
    if not messages:
        raise LLMError("Nothing to send.")
    if s["provider"] == "Anthropic":
        if not s["anthropic_key"]:
            raise LLMError("No Anthropic API key. Add it in Settings (or set ANTHROPIC_API_KEY).")
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=s["anthropic_key"])
            with client.messages.stream(model=s["anthropic_model"], max_tokens=max_tokens,
                                        system=system, messages=messages) as st:
                for t in st.text_stream:
                    yield t
        except LLMError:
            raise
        except Exception as e:
            raise LLMError(f"Anthropic error: {e}")
    else:
        if not s["gemini_key"]:
            raise LLMError("No Gemini API key. Add it in Settings (or set GEMINI_API_KEY).")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{s['gemini_model']}:streamGenerateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "model" if m["role"] == "assistant" else "user",
                          "parts": [{"text": m["content"]}]} for m in messages],
            "generationConfig": {"maxOutputTokens": max_tokens + 2000},
        }
        try:
            with requests.post(url, params={"alt": "sse"}, headers={"x-goog-api-key": s["gemini_key"]},
                               json=payload, stream=True, timeout=180) as r:
                r.encoding = "utf-8"
                if r.status_code != 200:
                    raise LLMError(f"Gemini error {r.status_code}: {r.text[:300]}")
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
        except LLMError:
            raise
        except Exception as e:
            raise LLMError(f"Gemini error: {e}")


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
