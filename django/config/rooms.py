"""Original room plans and judge problems.

LeetCode supplies titles, ids, difficulty, tags, and links. Statements,
starters, and tests in diagnostics.json are the original briefs.
"""

import json
from pathlib import Path

_DATA = json.loads((Path(__file__).with_name("diagnostics.json")).read_text())
ROOM_PLAN = _DATA["rooms"]
PROBLEMS = _DATA["problems"]
BY_SLUG = {problem["slug"]: problem for problem in PROBLEMS}


def problems_for_room(topics, difficulty):
    return [
        problem
        for problem in PROBLEMS
        if problem["roomTopic"] in topics and problem["difficulty"] == difficulty
    ]


def room_plan(number):
    return next((plan for plan in ROOM_PLAN if plan["room"] == number), None)
