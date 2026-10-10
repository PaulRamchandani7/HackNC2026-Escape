import json

from django.http import Http404, JsonResponse
from django.shortcuts import render

from .rooms import room_by_number


def index(request):
    return render(request, "landing.html")


def ship(request):
    return render(request, "ship.html")


def room(request, room):
    plan = room_by_number(room)
    if plan is None:
        raise Http404
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
        "locked": room > 1,
    }
    return render(
        request,
        "terminal.html",
        {"plan": plan, "locked": room > 1, "samples": samples, "payload": payload},
    )


def room_hint(request, room):
    plan = room_by_number(room)
    if plan is None:
        raise Http404
    try:
        index = int(request.GET.get("index", "0"))
    except ValueError:
        return JsonResponse({"error": "Hint failed"}, status=400)
    if index < 0 or index >= len(plan["hints"]):
        return JsonResponse({"error": "Hint failed"}, status=400)
    return JsonResponse({"hint": plan["hints"][index], "hintsUsed": index + 1})


def health(_request):
    return JsonResponse({"ok": True, "service": "code-adrift"})
