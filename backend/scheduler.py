"""Builds a real, time-of-day study calendar from configurable daily time blocks.

Topics are consumed in priority order (passed in already sorted) and sliced into
sessions of session_min..session_max hours, fitted into the user's actual free time
blocks, with short breaks inserted between sessions so a long block doesn't become
one unbroken slog.
"""
import datetime as dt

DIFF_RANK = {"Easy": 0, "Medium": 1, "Hard": 2}


def sort_key(topic_and_progress):
    """Basic -> Medium -> Hard first (builds stable footing before harder material),
    then highest importance, then lowest confidence (needs more attention) within that."""
    r = topic_and_progress
    conf = r.get("confidence", 0) if r.get("status") != "Not started" else -1
    return (DIFF_RANK.get(r["difficulty"], 1), -r["importance"], conf)


def _to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _to_hhmm(mins: int) -> str:
    mins = max(0, int(round(mins)))
    return f"{mins // 60:02d}:{mins % 60:02d}"


def _label(start_min: int) -> str:
    if start_min < 12 * 60:
        return "Morning"
    if start_min < 17 * 60:
        return "Afternoon"
    return "Evening"


def build_calendar(ranked_pool, blocks, days, session_min_h, session_max_h, break_min):
    """ranked_pool: list of dicts with id/name/subject/hours_left (mutated in place).
    blocks: list of {"start": "HH:MM", "end": "HH:MM"}.
    Returns (calendar_days, pool_exhausted_bool)."""
    today = dt.date.today()
    session_min = max(0.25, session_min_h) * 60
    session_max = max(session_min, session_max_h * 60)
    pi = 0
    out_days = []

    valid_blocks = []
    for b in blocks:
        try:
            s, e = _to_minutes(b["start"]), _to_minutes(b["end"])
            if e > s:
                valid_blocks.append((s, e))
        except Exception:
            continue
    valid_blocks.sort()

    for d in range(days):
        if pi >= len(ranked_pool):
            break
        date = (today + dt.timedelta(days=d)).isoformat()
        day_blocks = []
        for (bstart, bend) in valid_blocks:
            cursor = bstart
            items = []
            while pi < len(ranked_pool):
                remaining_block = bend - cursor
                if remaining_block < min(session_min, 30):
                    break
                item = ranked_pool[pi]
                hours_left_min = item["hours_left"] * 60
                take = min(session_max, remaining_block, max(hours_left_min, session_min))
                take = min(take, remaining_block)
                if take <= 0:
                    pi += 1
                    continue
                items.append({"type": "study", "start": _to_hhmm(cursor), "end": _to_hhmm(cursor + take),
                             "id": item["id"], "name": item["name"], "subject": item["subject"],
                             "difficulty": item["difficulty"]})
                item["hours_left"] = round(item["hours_left"] - take / 60, 2)
                cursor += take
                if item["hours_left"] <= 0.05:
                    pi += 1
                remaining_block = bend - cursor
                if pi < len(ranked_pool) and remaining_block > break_min + min(session_min, 30):
                    items.append({"type": "break", "start": _to_hhmm(cursor), "end": _to_hhmm(cursor + break_min)})
                    cursor += break_min
                else:
                    break
            if items:
                day_blocks.append({"start": _to_hhmm(bstart), "end": _to_hhmm(bend), "label": _label(bstart), "items": items})
        if day_blocks:
            out_days.append({"date": date, "blocks": day_blocks})

    return out_days, pi >= len(ranked_pool)
