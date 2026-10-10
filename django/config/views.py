import json

from django.http import Http404, HttpResponseNotAllowed, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from .judge import run_tests
from .progress import (
    accept_solution,
    assigned_room,
    current_mission,
    deck,
    elapsed_ms,
    format_duration,
    public_room,
    record_submission,
    reveal_hint,
    start_mission,
)


def index(request):
    return render(request, "landing.html", {"mission": current_mission(request)})


def intro(request):
    return render(request, "intro.html", {"csrf_token": get_token(request)})


@require_POST
def intro_start(request):
    try:
        start_mission(request)
    except Exception as exc:
        return render(request, "intro.html", {"error": str(exc) or "The terminal failed to boot", "csrf_token": get_token(request)})
    return redirect("/ship/")


def ship(request):
    mission = current_mission(request)
    if mission is None:
        return redirect("/")
    if mission.status == "completed":
        return redirect("/finale/")
    state = deck(mission)
    classes = {}
    for number in range(1, 6):
        if number in state["solved"]:
            classes[str(number)] = "is-open is-solved"
        elif number == state["current"]:
            classes[str(number)] = "is-open is-current"
        elif number in state["open"]:
            classes[str(number)] = "is-open"
        else:
            classes[str(number)] = ""
    return render(
        request,
        "ship.html",
        {
            "assigned_notice": request.GET.get("notice") == "assigned",
            "state": state,
            "classes": classes,
            "elapsed_label": format_duration(elapsed_ms(mission)),
            "voyage": {
                "solved": state["solved"],
                "startedAt": state["started_at"],
                "escapeMs": None,
            },
        },
    )


@require_POST
def ship_restart(request):
    if current_mission(request) is None and request.session.get("adrift_player_id") is None:
        return redirect("/")
    try:
        start_mission(request, redraw=True)
    except Exception:
        return redirect("/ship/")
    return redirect("/ship/?notice=assigned")


def room(request, room):
    mission = current_mission(request)
    if mission is None:
        return redirect("/")
    assigned = assigned_room(mission, room)
    if assigned is None:
        raise Http404
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
        "revealedHints": plan["revealed_hints"],
        "locked": plan["locked"],
        "solved": plan["solved"],
        "csrfToken": get_token(request),
        "success": plan["success"],
        "startedAt": plan["started_at"],
        "escapeMs": plan["escape_ms"],
    }
    return render(
        request,
        "terminal.html",
        {
            "plan": plan,
            "locked": plan["locked"],
            "samples": samples,
            "payload": payload,
            "elapsed_label": format_duration(elapsed_ms(mission)),
        },
    )


def room_hint(request, room):
    mission = current_mission(request)
    if mission is None:
        return JsonResponse({"error": "Hint failed"}, status=404)
    assigned = assigned_room(mission, room)
    if assigned is None:
        raise Http404
    if mission.status != "active":
        return JsonResponse({"error": "Hints are only available during an active mission"}, status=409)
    try:
        index = int(request.GET.get("index", "0"))
    except ValueError:
        return JsonResponse({"error": "Hint failed"}, status=400)
    hint = reveal_hint(mission, assigned["slug"], index, assigned["hints"])
    if hint is None:
        return JsonResponse({"error": "Hint failed"}, status=400)
    mission.refresh_from_db()
    return JsonResponse({"hint": hint, "hintsUsed": mission.hints_used})


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
    mission = current_mission(request)
    if mission is None:
        return JsonResponse({"error": "Invalid submit request"}, status=400)
    if mission.status != "active":
        return JsonResponse({"error": "Mission is not active"}, status=409)
    assigned = assigned_room(mission, room)
    if assigned is None:
        raise Http404
    if assigned["locked"]:
        return JsonResponse({"error": "Previous room is still locked"}, status=403)
    if hidden and assigned["solved"]:
        return JsonResponse({"error": "This system is already restored."}, status=409)
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
    if hidden and result.get("ok"):
        record_submission(mission, assigned["slug"], bool(result.get("passedAll")))
        if result.get("passedAll"):
            outcome = accept_solution(mission, assigned["slug"], assigned["room"])
            result["unlockedNext"] = outcome["unlockedNext"]
            result["completed"] = outcome["completed"]
            result["success"] = assigned["success"]
    status = 200 if result.get("ok", True) else 502
    return JsonResponse(result, status=status)


def room_run(request, room):
    return _judge(request, room, hidden=False)


def room_submit(request, room):
    return _judge(request, room, hidden=True)


def finale(request):
    mission = current_mission(request)
    if mission is None:
        return redirect("/")
    state = deck(mission)
    if not state["all_solved"]:
        return redirect("/ship/")
    difficulties = []
    for row in mission.rooms.order_by("room"):
        if row.difficulty not in difficulties:
            difficulties.append(row.difficulty)
    elapsed = elapsed_ms(mission)
    card = "\n".join(
        [
            "CODE: ADRIFT",
            "YOU MADE IT HOME",
            f"Problems solved: {len(state['solved'])}",
            f"Escape time: {format_duration(elapsed)}",
            f"Hints used: {mission.hints_used}",
            f"Submission attempts: {state['attempts']}",
            f"Difficulty: {', '.join(difficulties)}",
        ]
    )
    return render(
        request,
        "finale.html",
        {
            "solved": len(state["solved"]),
            "elapsed_label": format_duration(elapsed),
            "hints_used": mission.hints_used,
            "attempts": state["attempts"],
            "difficulties": ", ".join(difficulties),
            "card": card,
        },
    )


@require_POST
def finale_again(request):
    if current_mission(request) is None and request.session.get("adrift_player_id") is None:
        return redirect("/intro/")
    try:
        start_mission(request, redraw=True)
    except Exception:
        return redirect("/intro/")
    return redirect("/ship/")


def health(_request):
    return JsonResponse({"ok": True, "service": "code-adrift"})
