"""Server-side escape progress: which rooms are solved and the run timer.

Times live in the session so the browser cannot fake a finishing time.
"""

import time

from .rooms import FINAL_ROOM

PROGRESS_KEY = "adrift_progress"


def _progress(request):
    data = request.session.get(PROGRESS_KEY)
    if not data:
        data = {"started_at": None, "solved": [], "finished_at": None, "saved": False}
        request.session[PROGRESS_KEY] = data
    return data


def _save(request, data):
    request.session[PROGRESS_KEY] = data
    request.session.modified = True


def reset_progress(request):
    request.session.pop(PROGRESS_KEY, None)
    request.session.modified = True


def start_timer(request):
    data = _progress(request)
    if data["started_at"] is None:
        data["started_at"] = time.time()
        _save(request, data)


def is_unlocked(request, number):
    if number <= 1:
        return True
    return (number - 1) in _progress(request)["solved"]


def mark_solved(request, number):
    """Record a solved room. Returns (unlocked_next, completed)."""
    data = _progress(request)
    if number not in data["solved"]:
        data["solved"].append(number)
    completed = number >= FINAL_ROOM
    if completed and data["finished_at"] is None:
        data["finished_at"] = time.time()
    _save(request, data)
    return (None if completed else number + 1), completed


def finish_seconds(request):
    data = _progress(request)
    if data["started_at"] is None or data["finished_at"] is None:
        return None
    return round(data["finished_at"] - data["started_at"], 1)


def can_save_score(request):
    return finish_seconds(request) is not None and not _progress(request)["saved"]


def mark_score_saved(request):
    data = _progress(request)
    data["saved"] = True
    _save(request, data)
