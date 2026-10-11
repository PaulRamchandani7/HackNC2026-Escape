import json

from django.http import Http404, HttpResponseNotAllowed, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from .judge import run_tests
from .models import LeaderboardEntry
from .progress import can_save_score, finish_seconds, mark_score_saved, mark_solved, start_timer
from .voyage import assigned_room, current_voyage, public_room


def index(request):
    return render(request, "landing.html")


def ship(request):
    return render(
        request,
        "ship.html",
        {"assigned_notice": request.GET.get("notice") == "assigned"},
    )


@require_POST
def ship_restart(request):
    current_voyage(request, redraw=True)
    return redirect("/ship/?notice=assigned")


def room(request, room):
    assigned = assigned_room(request, room)
    if assigned is None:
        raise Http404
    if not assigned["locked"]:
        start_timer(request)
    plan = public_room(assigned)
    samples = [
        {
            "label": sample["label"],
            "args_json": json.dumps(sample["args"], separators=(",", ":")),
            "expected_json": json.dumps(sample["expected"], separators=(",", ":")),
        }
        for sample in plan["samples"]
    ]
    payload = {
        "room": plan["room"],
        "slug": plan["slug"],
        "starterCode": plan["starter_code"],
        "hintCount": len(plan["hints"]),
        "locked": plan["locked"],
        "csrfToken": get_token(request),
        "success": plan["success"],
    }
    return render(
        request,
        "terminal.html",
        {"plan": plan, "locked": plan["locked"], "samples": samples, "payload": payload},
    )


def room_hint(request, room):
    assigned = assigned_room(request, room)
    if assigned is None:
        raise Http404
    try:
        index = int(request.GET.get("index", "0"))
    except ValueError:
        return JsonResponse({"error": "Hint failed"}, status=400)
    if index < 0 or index >= len(assigned["hints"]):
        return JsonResponse({"error": "Hint failed"}, status=400)
    return JsonResponse({"hint": assigned["hints"][index], "hintsUsed": index + 1})


def _read_code(request):
    try:
        body = json.loads(request.body.decode() or "{}")
    except json.JSONDecodeError:
        return None, JsonResponse({"error": "Invalid submit request"}, status=400)
    code = body.get("code", "")
    if not isinstance(code, str):
        return None, JsonResponse({"error": "Invalid submit request"}, status=400)
    if len(code) > 40_000:
        return None, JsonResponse({"error": "Source too large"}, status=400)
    return code, None


def _judge(request, room, *, hidden):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    assigned = assigned_room(request, room)
    if assigned is None:
        raise Http404
    if assigned["locked"]:
        return JsonResponse({"error": "Previous room is still locked"}, status=403)
    code, error = _read_code(request)
    if error:
        return error
    tests = assigned["hidden_tests"] if hidden else assigned["samples"]
    try:
        result = run_tests(
            code=code,
            function_name=assigned["function_name"],
            tests=tests,
            compare=assigned["compare"],
            reveal_expected=not hidden,
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc) or "Judging failed"}, status=502)
    result["hidden"] = hidden
    result["unlockedNext"] = None
    result["completed"] = False
    if hidden and result.get("passedAll"):
        result["success"] = assigned["success"]
        unlocked_next, completed = mark_solved(request, room)
        result["unlockedNext"] = unlocked_next
        result["completed"] = completed
    status = 200 if result.get("ok", True) else 502
    return JsonResponse(result, status=status)


def room_run(request, room):
    return _judge(request, room, hidden=False)


def room_submit(request, room):
    return _judge(request, room, hidden=True)


def _format_seconds(seconds):
    total = int(seconds)
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    face = f"{minutes:02d}:{secs:02d}"
    return f"{hours}:{face}" if hours else face


def leaderboard(request):
    error = None
    my_entry_id = request.session.get("adrift_entry_id")
    if request.method == "POST":
        name = (request.POST.get("name") or "").strip()
        if not can_save_score(request):
            error = "Finish all rooms to post a time."
        elif not name or len(name) > 30:
            error = "Enter a name between 1 and 30 characters."
        else:
            entry = LeaderboardEntry.objects.create(name=name, seconds=finish_seconds(request))
            mark_score_saved(request)
            request.session["adrift_entry_id"] = entry.id
            return redirect("/leaderboard/")
    top = list(LeaderboardEntry.objects.all()[:10])
    rows = [
        {"rank": i + 1, "name": e.name, "time": _format_seconds(e.seconds), "mine": e.id == my_entry_id}
        for i, e in enumerate(top)
    ]
    seconds = finish_seconds(request)
    return render(
        request,
        "leaderboard.html",
        {
            "rows": rows,
            "can_save": can_save_score(request),
            "my_time": _format_seconds(seconds) if seconds is not None else None,
            "error": error,
        },
    )


def health(_request):
    return JsonResponse({"ok": True, "service": "code-adrift"})
