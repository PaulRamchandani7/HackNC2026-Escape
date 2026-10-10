"""Remember which LeetCode problem each compartment was assigned."""

from .leetcode import select_mission_rooms
from .rooms import BY_SLUG, room_plan

SESSION_KEY = "adrift_voyage"


def current_voyage(request, *, redraw=False):
    stored = None if redraw else request.session.get(SESSION_KEY)
    if stored:
        return stored
    selected = select_mission_rooms([])
    payload = {
        "source": selected["source"],
        "error": selected["error"],
        "rooms": [
            {
                "room": room["room"],
                "slug": room["problemSlug"],
                "source": room["source"],
                "questionId": room["meta"]["questionId"],
                "title": room["meta"]["title"],
                "difficulty": room["meta"]["difficulty"],
                "url": room["meta"]["url"],
                "category": room["category"],
                "repeated": room["repeated"],
            }
            for room in selected["rooms"]
        ],
    }
    request.session[SESSION_KEY] = payload
    request.session.modified = True
    return payload


def assigned_room(request, number):
    voyage = current_voyage(request)
    chosen = next((room for room in voyage["rooms"] if room["room"] == number), None)
    plan = room_plan(number)
    if not chosen or not plan:
        return None
    problem = BY_SLUG.get(chosen["slug"])
    if not problem:
        return None
    return {
        "room": number,
        "name": plan["name"],
        "chapter": plan["chapter"],
        "story": plan["story"],
        "success": plan["success"],
        "slug": problem["slug"],
        "question_id": chosen["questionId"],
        "title": chosen["title"],
        "difficulty": chosen["difficulty"],
        "category": chosen["category"],
        "metadata_source": chosen["source"],
        "leetcode_url": chosen["url"],
        "statement": problem["statement"],
        "starter_code": problem["starterCode"],
        "samples": problem["sampleTests"],
        "hints": problem["hints"],
        "function_name": problem["functionName"],
        "compare": problem["compare"],
        "hidden_tests": problem["hiddenTests"],
        "locked": number > 1,
    }


def public_room(assigned):
    hidden = {"hidden_tests", "function_name", "compare"}
    return {key: value for key, value in assigned.items() if key not in hidden}
