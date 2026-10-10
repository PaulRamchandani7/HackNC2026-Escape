from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from code_adrift.db import get_db
from code_adrift.judge import run_tests
from code_adrift.leetcode import list_problems, provider_status, select_mission_rooms
from code_adrift.problems import (
    get_judge_problem,
    mission_id,
    mission_title,
    room_count,
    room_plan,
    room_plan_list,
)

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES = Jinja2Templates(directory=str(ROOT / "templates"))

app = FastAPI(title="CODE: ADRIFT", version="0.1.0")
app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _row_to_dict(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    return dict(row)


def player_by_id(player_id: str) -> dict[str, Any] | None:
    return _row_to_dict(get_db().execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone())


def mission_by_id(mission_key: str) -> dict[str, Any] | None:
    return _row_to_dict(get_db().execute("SELECT * FROM missions WHERE id = ?", (mission_key,)).fetchone())


def rooms_for(mission_key: str) -> list[dict[str, Any]]:
    rows = get_db().execute(
        "SELECT * FROM mission_rooms WHERE mission_id = ? ORDER BY room ASC",
        (mission_key,),
    ).fetchall()
    return [dict(row) for row in rows]


def unlocked_ids(mission_key: str) -> set[str]:
    rows = get_db().execute(
        "SELECT challenge_id FROM unlocks WHERE mission_id = ?",
        (mission_key,),
    ).fetchall()
    return {row["challenge_id"] for row in rows}


def completed_slugs(player_id: str) -> list[str]:
    rows = get_db().execute(
        "SELECT slug FROM completed_problems WHERE player_id = ?",
        (player_id,),
    ).fetchall()
    return [row["slug"] for row in rows]


def public_room(row: dict[str, Any]) -> dict[str, Any]:
    problem = get_judge_problem(row["slug"])
    plan = room_plan(int(row["room"]))
    return {
        "id": row["slug"],
        "room": row["room"],
        "name": plan.name if plan else f"Room {row['room']}",
        "chapter": plan.chapter if plan else "",
        "success": plan.success if plan else "SYSTEM RESTORED.",
        "questionId": row["question_id"],
        "title": row["title"],
        "difficulty": row["difficulty"],
        "category": row["category"],
        "tags": json.loads(row["tags_json"]),
        "story": (plan.story if plan and plan.story else None) or (problem.story if problem else "") or "",
        "statement": problem.statement if problem else "",
        "functionName": problem.function_name if problem else "",
        "starterCode": problem.starter_code if problem else "",
        "sampleTests": [
            {"label": test.label, "args": test.args, "expected": test.expected}
            for test in (problem.sample_tests if problem else [])
        ],
        "hintCount": len(problem.hints) if problem else 0,
        "estimatedMinutes": problem.estimated_minutes if problem else 6,
        "leetcodeUrl": row["leetcode_url"],
        "metadataSource": row["metadata_source"],
        "repeated": bool(row["repeated"]),
        "contentPolicy": "original-brief",
    }


def mission_payload(mission: dict[str, Any]) -> dict[str, Any]:
    rooms = rooms_for(mission["id"])
    unlocked = unlocked_ids(mission["id"])
    unlocked_rooms: list[int] = []
    for index, room in enumerate(rooms):
        previous = rooms[index - 1] if index > 0 else None
        open_room = index == 0 or (previous is not None and previous["slug"] in unlocked)
        if open_room:
            unlocked_rooms.append(int(room["room"]))
    attempts = get_db().execute(
        "SELECT COUNT(*) as n FROM submissions WHERE mission_id = ?",
        (mission["id"],),
    ).fetchone()["n"]
    source: str
    if any(room["metadata_source"] == "live" for room in rooms):
        source = "live"
    elif any(room["metadata_source"] == "cache" for room in rooms):
        source = "cache"
    elif rooms:
        source = "seed"
    else:
        source = "idle"
    return {
        **mission,
        "elapsedMs": max(0, _now_ms() - int(mission["started_at"])),
        "attempts": attempts,
        "unlockedRooms": unlocked_rooms,
        "solvedChallengeIds": [room["slug"] for room in rooms if room["slug"] in unlocked],
        "allSolved": len(rooms) == room_count() and all(room["slug"] in unlocked for room in rooms),
        "rooms": [public_room(room) for room in rooms],
        "provider": provider_status(source),
    }


def assigned_room(mission_key: str, slug: str) -> dict[str, Any] | None:
    return _row_to_dict(
        get_db()
        .execute(
            "SELECT * FROM mission_rooms WHERE mission_id = ? AND slug = ?",
            (mission_key, slug),
        )
        .fetchone()
    )


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "code-adrift", "leetcode": provider_status()}


@app.get("/api/catalog")
def catalog() -> dict[str, Any]:
    return {
        "mission": {
            "id": mission_id(),
            "title": mission_title(),
            "tagline": "Lost at sea. Trapped aboard. Code your way home.",
            "rooms": room_count(),
        },
        "blueprint": [
            {
                "room": room.room,
                "name": room.name,
                "chapter": room.chapter,
                "difficulty": room.difficulty,
                "category": room.category,
                "topics": room.topics,
                "minutes": room.minutes,
                "story": room.story,
                "success": room.success,
            }
            for room in room_plan_list()
        ],
        "provider": provider_status(),
    }


@app.get("/api/problems")
def problems(difficulty: str = "Easy", topic: str = "") -> dict[str, Any]:
    if difficulty not in {"Easy", "Medium", "Hard"}:
        raise HTTPException(status_code=400, detail="difficulty must be Easy, Medium, or Hard")
    listed = list_problems(difficulty=difficulty, topic=topic or None, limit=24)  # type: ignore[arg-type]
    return {**listed, "contentPolicy": "metadata-only"}


@app.post("/api/players")
async def create_player(request: Request) -> dict[str, Any]:
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    nickname = body.get("nickname") if isinstance(body, dict) else None
    if isinstance(nickname, str) and nickname.strip():
        name = nickname.strip()[:32]
    else:
        name = f"Castaway-{uuid.uuid4().hex[:4]}"
    player_id = str(uuid.uuid4())
    get_db().execute(
        "INSERT INTO players (id, nickname, created_at) VALUES (?, ?, ?)",
        (player_id, name, _now_ms()),
    )
    get_db().commit()
    return {"id": player_id, "nickname": name}


@app.patch("/api/players/{player_id}")
async def patch_player(player_id: str, request: Request) -> dict[str, Any]:
    player = player_by_id(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    body = await request.json()
    nickname = body.get("nickname")
    wallet = body.get("wallet")
    next_name = nickname.strip()[:32] if isinstance(nickname, str) else player["nickname"]
    next_wallet = wallet if isinstance(wallet, str) else player["wallet"]
    get_db().execute(
        "UPDATE players SET nickname = ?, wallet = ? WHERE id = ?",
        (next_name or player["nickname"], next_wallet, player_id),
    )
    get_db().commit()
    updated = player_by_id(player_id)
    assert updated is not None
    return updated


@app.post("/api/missions")
async def create_mission(request: Request) -> dict[str, Any]:
    body = await request.json()
    player = player_by_id(body.get("playerId", ""))
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    existing = _row_to_dict(
        get_db()
        .execute(
            """
            SELECT * FROM missions
            WHERE player_id = ? AND mission_key = ? AND status = 'active'
            ORDER BY started_at DESC LIMIT 1
            """,
            (player["id"], mission_id()),
        )
        .fetchone()
    )
    if existing and not body.get("redraw"):
        return mission_payload(existing)
    if existing and body.get("redraw"):
        get_db().execute(
            "UPDATE missions SET status = 'abandoned', expired_at = ? WHERE id = ? AND status = 'active'",
            (_now_ms(), existing["id"]),
        )
        get_db().commit()

    try:
        selected = select_mission_rooms(completed_slugs(player["id"]))
        mission_uuid = str(uuid.uuid4())
        started = _now_ms()
        db = get_db()
        db.execute(
            """
            INSERT INTO missions (id, player_id, mission_key, started_at, hints_used, status)
            VALUES (?, ?, ?, ?, 0, 'active')
            """,
            (mission_uuid, player["id"], mission_id(), started),
        )
        for room in selected["rooms"]:
            db.execute(
                """
                INSERT INTO mission_rooms
                  (mission_id, room, slug, question_id, title, difficulty, category,
                   leetcode_url, tags_json, metadata_source, repeated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    mission_uuid,
                    room["room"],
                    room["problemSlug"],
                    room["meta"]["questionId"],
                    room["meta"]["title"],
                    room["meta"]["difficulty"],
                    room["category"],
                    room["meta"]["url"],
                    json.dumps(room["meta"]["tags"]),
                    room["source"],
                    1 if room["repeated"] else 0,
                ),
            )
        db.commit()
        created = mission_by_id(mission_uuid)
        assert created is not None
        return {**mission_payload(created), "provider": selected["provider"]}
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(err)) from err


@app.get("/api/missions/{mission_key}")
def get_mission(mission_key: str) -> dict[str, Any]:
    mission = mission_by_id(mission_key)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    return mission_payload(mission)


@app.post("/api/run")
async def run_code(request: Request) -> dict[str, Any]:
    body = await request.json()
    slug = str(body.get("challengeId") or "")
    problem = get_judge_problem(slug)
    if not problem:
        raise HTTPException(status_code=404, detail="Challenge not found")
    code = str(body.get("code") or "")
    if len(code) > 40_000:
        raise HTTPException(status_code=400, detail="Source too large")
    try:
        result = run_tests(
            code=code,
            function_name=problem.function_name,
            tests=problem.sample_tests,
            compare=problem.compare,
            reveal_expected=True,
        )
        return {**result, "hidden": False}
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(err)) from err


@app.post("/api/submit")
async def submit_code(request: Request) -> dict[str, Any]:
    body = await request.json()
    player = player_by_id(str(body.get("playerId") or ""))
    mission = mission_by_id(str(body.get("missionId") or "")) if body.get("missionId") else None
    slug = str(body.get("challengeId") or "")
    problem = get_judge_problem(slug)
    if not player or not mission or not problem:
        raise HTTPException(status_code=400, detail="Invalid submit request")
    if mission["player_id"] != player["id"]:
        raise HTTPException(status_code=403, detail="Mission does not belong to this player")
    room = assigned_room(mission["id"], slug)
    if not room:
        raise HTTPException(status_code=403, detail="That problem is not part of this mission")
    if mission["status"] == "expired":
        raise HTTPException(status_code=409, detail="Mission timer expired. Start a new mission.")
    if mission["status"] != "active":
        raise HTTPException(status_code=409, detail="Mission is not active")

    rooms = rooms_for(mission["id"])
    previous = next((item for item in rooms if int(item["room"]) == int(room["room"]) - 1), None)
    if previous and previous["slug"] not in unlocked_ids(mission["id"]):
        raise HTTPException(status_code=403, detail="Previous room is still locked")

    code = str(body.get("code") or "")
    if len(code) > 40_000:
        raise HTTPException(status_code=400, detail="Source too large")

    try:
        result = run_tests(
            code=code,
            function_name=problem.function_name,
            tests=problem.hidden_tests,
            compare=problem.compare,
            reveal_expected=False,
        )
        db = get_db()
        db.execute(
            """
            INSERT INTO submissions (id, mission_id, challenge_id, passed, kind, stdout, stderr, created_at)
            VALUES (?, ?, ?, ?, 'hidden', ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                mission["id"],
                slug,
                1 if result["passedAll"] else 0,
                result["stdout"],
                result["stderr"],
                _now_ms(),
            ),
        )
        unlocked_next = None
        completed = False
        if result["passedAll"]:
            db.execute(
                "INSERT OR IGNORE INTO unlocks (mission_id, challenge_id, accepted_at) VALUES (?, ?, ?)",
                (mission["id"], slug, _now_ms()),
            )
            db.execute(
                """
                INSERT INTO completed_problems (player_id, slug, completed_at) VALUES (?, ?, ?)
                ON CONFLICT(player_id, slug) DO UPDATE SET completed_at = excluded.completed_at
                """,
                (player["id"], slug, _now_ms()),
            )
            nxt = next((item for item in rooms if int(item["room"]) == int(room["room"]) + 1), None)
            unlocked_next = int(nxt["room"]) if nxt else None
            solved = unlocked_ids(mission["id"])
            if len(rooms) == room_count() and all(item["slug"] in solved for item in rooms):
                escape_ms = _now_ms() - int(mission["started_at"])
                db.execute(
                    """
                    UPDATE missions SET status = 'completed', completed_at = ?, escape_ms = ?
                    WHERE id = ? AND status = 'active'
                    """,
                    (_now_ms(), escape_ms, mission["id"]),
                )
                completed = True
        db.commit()
        live = mission_by_id(mission["id"])
        assert live is not None
        return {
            **result,
            "hidden": True,
            "unlockedNext": unlocked_next,
            "completed": completed,
            "mission": mission_payload(live),
        }
    except HTTPException:
        raise
    except Exception as err:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(err)) from err


@app.post("/api/hints")
async def reveal_hint(request: Request) -> dict[str, Any]:
    body = await request.json()
    mission = mission_by_id(str(body.get("missionId") or ""))
    slug = str(body.get("challengeId") or "")
    problem = get_judge_problem(slug)
    index = int(body.get("index") or 0)
    if not mission or not problem or not assigned_room(mission["id"], slug) or index >= len(problem.hints):
        raise HTTPException(status_code=400, detail="Invalid hint request")
    if mission["status"] != "active":
        raise HTTPException(status_code=409, detail="Hints are only available during an active mission")
    db = get_db()
    cursor = db.execute(
        "INSERT OR IGNORE INTO hint_reveals (mission_id, slug, hint_index) VALUES (?, ?, ?)",
        (mission["id"], slug, index),
    )
    if cursor.rowcount > 0:
        db.execute("UPDATE missions SET hints_used = hints_used + 1 WHERE id = ?", (mission["id"],))
    db.commit()
    hints_used = db.execute(
        "SELECT hints_used FROM missions WHERE id = ?",
        (mission["id"],),
    ).fetchone()["hints_used"]
    return {"index": index, "hint": problem.hints[index], "hintsUsed": hints_used}


@app.get("/api/missions/{mission_key}/hints/{slug}")
def revealed_hints(mission_key: str, slug: str) -> dict[str, Any]:
    problem = get_judge_problem(slug)
    if not problem or not assigned_room(mission_key, slug):
        raise HTTPException(status_code=404, detail="Unknown problem")
    rows = get_db().execute(
        """
        SELECT hint_index FROM hint_reveals
        WHERE mission_id = ? AND slug = ?
        ORDER BY hint_index
        """,
        (mission_key, slug),
    ).fetchall()
    hints = []
    for row in rows:
        if 0 <= row["hint_index"] < len(problem.hints):
            hints.append(problem.hints[row["hint_index"]])
    return {"hints": hints}


@app.get("/api/leaderboard")
def leaderboard() -> dict[str, Any]:
    rows = get_db().execute(
        """
        SELECT m.id as mission_id, p.id as player_id, p.nickname, p.wallet,
               m.escape_ms, m.hints_used, m.completed_at,
               (SELECT COUNT(*) FROM unlocks u WHERE u.mission_id = m.id) as problems,
               (SELECT CASE
                  WHEN SUM(CASE WHEN mr.difficulty = 'Hard' THEN 1 ELSE 0 END) > 0 THEN 'Hard'
                  WHEN SUM(CASE WHEN mr.difficulty = 'Medium' THEN 1 ELSE 0 END) > 0 THEN 'Medium'
                  WHEN COUNT(mr.room) > 0 THEN 'Easy'
                  ELSE NULL END
                FROM mission_rooms mr WHERE mr.mission_id = m.id) as difficulty,
               (SELECT a.status FROM achievements a WHERE a.player_id = p.id AND a.mission_key = m.mission_key
                  ORDER BY a.created_at DESC LIMIT 1) as achievement_status,
               (SELECT a.signature FROM achievements a WHERE a.player_id = p.id AND a.status = 'confirmed'
                  ORDER BY a.confirmed_at DESC LIMIT 1) as signature
        FROM missions m
        JOIN players p ON p.id = m.player_id
        WHERE m.status = 'completed'
        ORDER BY m.escape_ms ASC, m.hints_used ASC, m.completed_at ASC
        LIMIT 50
        """
    ).fetchall()
    return {"entries": [dict(row) for row in rows]}


@app.get("/api/players/{player_id}/profile")
def player_profile(player_id: str) -> dict[str, Any]:
    player = player_by_id(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    db = get_db()
    missions = [dict(row) for row in db.execute(
        "SELECT * FROM missions WHERE player_id = ? ORDER BY started_at DESC",
        (player_id,),
    ).fetchall()]
    solved = db.execute(
        """
        SELECT COUNT(*) as n FROM unlocks u
        JOIN missions m ON m.id = u.mission_id
        WHERE m.player_id = ?
        """,
        (player_id,),
    ).fetchone()["n"]
    best = db.execute(
        "SELECT MIN(escape_ms) as best FROM missions WHERE player_id = ? AND status = 'completed'",
        (player_id,),
    ).fetchone()["best"]
    solved_problems = [
        dict(row)
        for row in db.execute(
            """
            SELECT mr.slug, mr.title, mr.question_id as questionId, mr.difficulty, mr.room,
                   mr.leetcode_url as leetcodeUrl, mr.category, u.accepted_at as acceptedAt,
                   mr.mission_id as missionId
            FROM mission_rooms mr
            JOIN unlocks u ON u.mission_id = mr.mission_id AND u.challenge_id = mr.slug
            JOIN missions m ON m.id = mr.mission_id
            WHERE m.player_id = ?
            ORDER BY u.accepted_at DESC
            """,
            (player_id,),
        ).fetchall()
    ]
    achievements = [
        dict(row)
        for row in db.execute(
            "SELECT * FROM achievements WHERE player_id = ? ORDER BY created_at DESC",
            (player_id,),
        ).fetchall()
    ]
    latest = achievements[0] if achievements else None
    completed = any(row["status"] == "completed" for row in missions)
    if latest and latest.get("status") == "confirmed":
        verification = "verified"
    elif latest and latest.get("status") == "pending":
        verification = "pending"
    elif latest and latest.get("status") == "failed":
        verification = "failed"
    elif completed:
        verification = "completed_unclaimed"
    else:
        verification = "in_progress"
    return {
        "player": player,
        "missions": missions,
        "problemsSolved": solved,
        "bestEscapeMs": best,
        "solvedProblems": solved_problems,
        "achievements": [{**row, "explorerUrl": None} for row in achievements],
        "verification": verification,
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.get("/", response_class=HTMLResponse)
def page_home(request: Request) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "home.html", {"title": mission_title()})


@app.get("/intro", response_class=HTMLResponse)
def page_intro(request: Request) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "intro.html", {"title": "Intro"})


@app.get("/ship", response_class=HTMLResponse)
def page_ship(request: Request) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "ship.html", {"title": "Deck plan"})


@app.get("/room/{room}", response_class=HTMLResponse)
def page_room(request: Request, room: int) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "terminal.html", {"title": f"Room {room}", "room": room})


@app.get("/finale", response_class=HTMLResponse)
def page_finale(request: Request) -> HTMLResponse:
    return TEMPLATES.TemplateResponse(request, "finale.html", {"title": "Escape"})


def create_app() -> FastAPI:
    get_db()
    return app


def main() -> None:
    import uvicorn

    get_db()
    port = int(os.environ.get("PORT", "8787"))
    uvicorn.run("code_adrift.app:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
