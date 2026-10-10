"""Saved voyage: five rooms, locks, hints, timer, and the finale."""

import time
import uuid

from .leetcode import select_mission_rooms
from .models import CompletedProblem, HintReveal, Mission, MissionRoom, Player, Submission, Unlock
from .rooms import BY_SLUG, room_plan

MISSION_KEY = "code-adrift-01"
PLAYER_ID = "adrift_player_id"
MISSION_ID = "adrift_mission_id"


def now_ms():
    return int(time.time() * 1000)


def format_duration(ms):
    total = max(0, int(ms) // 1000)
    hours = total // 3600
    minutes = (total % 3600) // 60
    seconds = total % 60
    face = f"{minutes:02d}:{seconds:02d}"
    return f"{hours}:{face}" if hours else face


def elapsed_ms(mission, at=None):
    if mission.status == "completed" and mission.escape_ms is not None:
        return mission.escape_ms
    return max(0, (at if at is not None else now_ms()) - mission.started_at)


def ensure_player(request):
    player_id = request.session.get(PLAYER_ID)
    player = Player.objects.filter(id=player_id).first() if player_id else None
    if player:
        return player
    player_id = str(uuid.uuid4())
    player = Player.objects.create(
        id=player_id,
        nickname=f"Castaway-{player_id[:4]}",
        created_at=now_ms(),
    )
    request.session[PLAYER_ID] = player.id
    return player


def current_mission(request):
    mission_id = request.session.get(MISSION_ID)
    if not mission_id:
        return None
    mission = Mission.objects.filter(id=mission_id).select_related("player").first()
    if not mission or mission.player_id != request.session.get(PLAYER_ID):
        request.session.pop(MISSION_ID, None)
        return None
    return mission


def completed_slugs(player):
    return list(CompletedProblem.objects.filter(player=player).values_list("slug", flat=True))


def start_mission(request, *, redraw=False):
    player = ensure_player(request)
    if redraw:
        Mission.objects.filter(player=player, mission_key=MISSION_KEY, status="active").update(
            status="abandoned",
            completed_at=now_ms(),
        )
    else:
        existing = (
            Mission.objects.filter(player=player, mission_key=MISSION_KEY, status="active")
            .order_by("-started_at")
            .first()
        )
        if existing:
            request.session[MISSION_ID] = existing.id
            return existing
    selected = select_mission_rooms(completed_slugs(player))
    mission = Mission.objects.create(
        id=str(uuid.uuid4()),
        player=player,
        mission_key=MISSION_KEY,
        started_at=now_ms(),
        hints_used=0,
        status="active",
    )
    MissionRoom.objects.bulk_create(
        [
            MissionRoom(
                mission=mission,
                room=room["room"],
                slug=room["problemSlug"],
                question_id=room["meta"]["questionId"],
                title=room["meta"]["title"],
                difficulty=room["meta"]["difficulty"],
                category=room["category"],
                leetcode_url=room["meta"]["url"],
                metadata_source=room["source"],
                repeated=room["repeated"],
            )
            for room in selected["rooms"]
        ]
    )
    request.session[MISSION_ID] = mission.id
    return mission


def solved_slugs(mission):
    return set(Unlock.objects.filter(mission=mission).values_list("slug", flat=True))


def room_rows(mission):
    return list(mission.rooms.order_by("room"))


def deck(mission):
    rows = room_rows(mission)
    solved = solved_slugs(mission)
    solved_numbers = [row.room for row in rows if row.slug in solved]
    open_numbers = []
    for index, row in enumerate(rows):
        previous = rows[index - 1] if index else None
        if index == 0 or (previous and previous.slug in solved):
            open_numbers.append(row.room)
    current = next((number for number in open_numbers if number not in solved_numbers), None)
    return {
        "solved": solved_numbers,
        "open": open_numbers,
        "current": current,
        "started_at": mission.started_at,
        "escape_ms": mission.escape_ms,
        "status": mission.status,
        "hints_used": mission.hints_used,
        "attempts": mission.submissions.count(),
        "all_solved": len(rows) == 5 and len(solved_numbers) == 5,
    }


def assigned_room(mission, number):
    row = mission.rooms.filter(room=number).first()
    plan = room_plan(number)
    problem = BY_SLUG.get(row.slug) if row else None
    if not row or not plan or not problem:
        return None
    state = deck(mission)
    revealed = list(
        HintReveal.objects.filter(mission=mission, slug=row.slug)
        .order_by("hint_index")
        .values_list("hint_index", flat=True)
    )
    return {
        "room": number,
        "name": plan["name"],
        "chapter": plan["chapter"],
        "story": plan["story"],
        "success": plan["success"],
        "slug": problem["slug"],
        "question_id": row.question_id,
        "title": row.title,
        "difficulty": row.difficulty,
        "category": row.category,
        "metadata_source": row.metadata_source,
        "leetcode_url": row.leetcode_url,
        "statement": problem["statement"],
        "starter_code": problem["starterCode"],
        "samples": problem["sampleTests"],
        "hints": problem["hints"],
        "revealed_hints": [problem["hints"][index] for index in revealed if index < len(problem["hints"])],
        "function_name": problem["functionName"],
        "compare": problem["compare"],
        "hidden_tests": problem["hiddenTests"],
        "locked": number not in state["open"],
        "solved": number in state["solved"],
        "started_at": mission.started_at,
        "escape_ms": elapsed_ms(mission) if mission.status == "completed" else None,
    }


def public_room(assigned):
    hidden = {"hidden_tests", "function_name", "compare"}
    return {key: value for key, value in assigned.items() if key not in hidden}


def record_submission(mission, slug, passed):
    Submission.objects.create(
        id=str(uuid.uuid4()),
        mission=mission,
        slug=slug,
        passed=passed,
        kind="hidden",
        created_at=now_ms(),
    )


def accept_solution(mission, slug, room_number):
    now = now_ms()
    Unlock.objects.get_or_create(mission=mission, slug=slug, defaults={"accepted_at": now})
    CompletedProblem.objects.update_or_create(
        player_id=mission.player_id,
        slug=slug,
        defaults={"completed_at": now},
    )
    rows = room_rows(mission)
    solved = solved_slugs(mission)
    completed = len(rows) == 5 and all(row.slug in solved for row in rows)
    unlocked_next = None
    if completed and mission.status == "active":
        mission.status = "completed"
        mission.completed_at = now
        mission.escape_ms = max(0, now - mission.started_at)
        mission.save(update_fields=["status", "completed_at", "escape_ms"])
    else:
        nxt = next((row.room for row in rows if row.room == room_number + 1), None)
        unlocked_next = nxt
    return {"completed": completed, "unlockedNext": unlocked_next}


def reveal_hint(mission, slug, index, hints):
    if index < 0 or index >= len(hints):
        return None
    _row, created = HintReveal.objects.get_or_create(
        mission=mission,
        slug=slug,
        hint_index=index,
    )
    if created and mission.status == "active":
        mission.hints_used += 1
        mission.save(update_fields=["hints_used"])
    return hints[index]
