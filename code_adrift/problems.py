from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

CompareMode = Literal["exact", "sorted", "groups"]
Difficulty = Literal["Easy", "Medium", "Hard"]
RoomTopic = Literal[
    "array",
    "string",
    "hash-table",
    "stack",
    "binary-search",
    "depth-first-search",
    "graph",
]

DATA_PATH = Path(__file__).resolve().parent / "data" / "problems.json"


@dataclass(frozen=True)
class TestCase:
    label: str
    args: list[Any]
    expected: Any


@dataclass(frozen=True)
class JudgeProblem:
    slug: str
    room_topic: RoomTopic
    difficulty: Difficulty
    function_name: str
    story: str
    statement: str
    starter_code: str
    sample_tests: list[TestCase]
    hidden_tests: list[TestCase]
    hints: list[str]
    compare: CompareMode
    estimated_minutes: int


@dataclass(frozen=True)
class RoomPlan:
    room: int
    name: str
    chapter: str
    difficulty: Difficulty
    topics: list[str]
    category: str
    minutes: int
    story: str
    success: str


def _tests(raw: list[dict[str, Any]]) -> list[TestCase]:
    return [TestCase(label=row["label"], args=row["args"], expected=row["expected"]) for row in raw]


@lru_cache(maxsize=1)
def _payload() -> dict[str, Any]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def mission_id() -> str:
    return str(_payload()["missionId"])


def mission_title() -> str:
    return str(_payload()["missionTitle"])


def room_count() -> int:
    return int(_payload()["roomCount"])


@lru_cache(maxsize=1)
def room_plan_list() -> list[RoomPlan]:
    return [
        RoomPlan(
            room=row["room"],
            name=row["name"],
            chapter=row["chapter"],
            difficulty=row["difficulty"],
            topics=list(row["topics"]),
            category=row["category"],
            minutes=row["minutes"],
            story=row["story"],
            success=row["success"],
        )
        for row in _payload()["roomPlan"]
    ]


@lru_cache(maxsize=1)
def judge_problems() -> list[JudgeProblem]:
    problems: list[JudgeProblem] = []
    for row in _payload()["judgeProblems"]:
        problems.append(
            JudgeProblem(
                slug=row["slug"],
                room_topic=row["roomTopic"],
                difficulty=row["difficulty"],
                function_name=row["functionName"],
                story=row.get("story") or "",
                statement=row["statement"],
                starter_code=row["starterCode"],
                sample_tests=_tests(row["sampleTests"]),
                hidden_tests=_tests(row["hiddenTests"]),
                hints=list(row["hints"]),
                compare=row["compare"],
                estimated_minutes=int(row["estimatedMinutes"]),
            )
        )
    return problems


@lru_cache(maxsize=1)
def _by_slug() -> dict[str, JudgeProblem]:
    return {problem.slug: problem for problem in judge_problems()}


def get_judge_problem(slug: str) -> JudgeProblem | None:
    return _by_slug().get(slug)


def problems_for_room(topics: list[str], difficulty: str) -> list[JudgeProblem]:
    return [
        problem
        for problem in judge_problems()
        if problem.room_topic in topics and problem.difficulty == difficulty
    ]


def room_plan(room: int) -> RoomPlan | None:
    for plan in room_plan_list():
        if plan.room == room:
            return plan
    return None
