import json

from django.http import Http404, HttpResponseNotAllowed, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from .judge import run_tests
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
    status = 200 if result.get("ok", True) else 502
    return JsonResponse(result, status=status)


def room_run(request, room):
    return _judge(request, room, hidden=False)


def room_submit(request, room):
    return _judge(request, room, hidden=True)


def health(_request):
    return JsonResponse({"ok": True, "service": "code-adrift"})
