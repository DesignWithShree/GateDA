"""Minimal SM-2 spaced-repetition scheduler for flashcards."""
import datetime as dt

GRADE_QUALITY = {"again": 1, "hard": 3, "good": 4, "easy": 5}


def schedule(ease: float, interval: int, reps: int, grade: str):
    """Return (new_ease, new_interval_days, new_reps, new_due_date_iso)."""
    q = GRADE_QUALITY.get(grade, 3)
    if q < 3:
        reps = 0
        interval = 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = max(1, round(interval * ease))
        reps += 1
    ease = max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    due = (dt.date.today() + dt.timedelta(days=interval)).isoformat()
    return round(ease, 3), interval, reps, due
