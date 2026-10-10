from __future__ import annotations

import json
import random
import time
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from code_adrift.db import get_db
from code_adrift.problems import (
    Difficulty,
    judge_problems,
    problems_for_room,
    room_plan_list,
)

LEETCODE_GRAPHQL = "https://leetcode.com/graphql"
LIST_TTL_MS = 15 * 60 * 1000
DETAIL_TTL_MS = 6 * 60 * 60 * 1000
STALE_OK_MS = 7 * 24 * 60 * 60 * 1000

MetadataSource = Literal["live", "cache", "seed"]

_cooldown_until = 0.0
_last_error = ""
_last_live_at = 0.0


def problem_url(slug: str) -> str:
    return f"https://leetcode.com/problems/{slug}/"


def _meta(
    question_id: str,
    title: str,
    slug: str,
    difficulty: Difficulty,
    tags: list[str],
) -> dict[str, Any]:
    return {
        "questionId": question_id,
        "title": title,
        "slug": slug,
        "difficulty": difficulty,
        "paid": False,
        "tags": tags,
        "url": problem_url(slug),
    }


SEED: dict[str, dict[str, Any]] = {
    "search-insert-position": _meta("35", "Search Insert Position", "search-insert-position", "Easy", ["array", "binary-search"]),
    "best-time-to-buy-and-sell-stock": _meta("121", "Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock", "Easy", ["array", "dynamic-programming"]),
    "plus-one": _meta("66", "Plus One", "plus-one", "Easy", ["array", "math"]),
    "squares-of-a-sorted-array": _meta("977", "Squares of a Sorted Array", "squares-of-a-sorted-array", "Easy", ["array", "two-pointers", "sorting"]),
    "max-consecutive-ones": _meta("485", "Max Consecutive Ones", "max-consecutive-ones", "Easy", ["array"]),
    "valid-palindrome": _meta("125", "Valid Palindrome", "valid-palindrome", "Easy", ["two-pointers", "string"]),
    "length-of-last-word": _meta("58", "Length of Last Word", "length-of-last-word", "Easy", ["string"]),
    "first-unique-character-in-a-string": _meta(
        "387",
        "First Unique Character in a String",
        "first-unique-character-in-a-string",
        "Easy",
        ["hash-table", "string", "queue", "counting"],
    ),
    "detect-capital": _meta("520", "Detect Capital", "detect-capital", "Easy", ["string"]),
    "group-anagrams": _meta("49", "Group Anagrams", "group-anagrams", "Medium", ["array", "hash-table", "string", "sorting"]),
    "top-k-frequent-elements": _meta(
        "347",
        "Top K Frequent Elements",
        "top-k-frequent-elements",
        "Medium",
        ["array", "hash-table", "divide-and-conquer", "sorting", "heap-priority-queue", "bucket-sort", "counting", "quickselect"],
    ),
    "subarray-sum-equals-k": _meta("560", "Subarray Sum Equals K", "subarray-sum-equals-k", "Medium", ["array", "hash-table", "prefix-sum"]),
    "longest-consecutive-sequence": _meta(
        "128",
        "Longest Consecutive Sequence",
        "longest-consecutive-sequence",
        "Medium",
        ["array", "hash-table", "union-find"],
    ),
    "longest-substring-without-repeating-characters": _meta(
        "3",
        "Longest Substring Without Repeating Characters",
        "longest-substring-without-repeating-characters",
        "Medium",
        ["hash-table", "string", "sliding-window"],
    ),
    "decode-string": _meta("394", "Decode String", "decode-string", "Medium", ["string", "stack", "recursion"]),
    "search-in-rotated-sorted-array": _meta(
        "33",
        "Search in Rotated Sorted Array",
        "search-in-rotated-sorted-array",
        "Medium",
        ["array", "binary-search"],
    ),
    "find-minimum-in-rotated-sorted-array": _meta(
        "153",
        "Find Minimum in Rotated Sorted Array",
        "find-minimum-in-rotated-sorted-array",
        "Medium",
        ["array", "binary-search"],
    ),
    "number-of-islands": _meta(
        "200",
        "Number of Islands",
        "number-of-islands",
        "Medium",
        ["array", "depth-first-search", "breadth-first-search", "union-find", "matrix"],
    ),
    "course-schedule": _meta(
        "207",
        "Course Schedule",
        "course-schedule",
        "Medium",
        ["depth-first-search", "breadth-first-search", "graph", "topological-sort"],
    ),
    "number-of-provinces": _meta(
        "547",
        "Number of Provinces",
        "number-of-provinces",
        "Medium",
        ["depth-first-search", "breadth-first-search", "union-find", "graph"],
    ),
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _read_cache(key: str) -> dict[str, Any] | None:
    row = get_db().execute(
        "SELECT payload, fetched_at, fresh_until FROM problem_cache WHERE cache_key = ?",
        (key,),
    ).fetchone()
    if row is None:
        return None
    age = _now_ms() - int(row["fetched_at"])
    if age > STALE_OK_MS:
        return None
    return {
        "value": json.loads(row["payload"]),
        "fresh": _now_ms() <= int(row["fresh_until"]),
        "fetchedAt": int(row["fetched_at"]),
    }


def _write_cache(key: str, value: Any, ttl: int) -> None:
    now = _now_ms()
    get_db().execute(
        """
        INSERT INTO problem_cache (cache_key, payload, fetched_at, fresh_until)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          payload = excluded.payload,
          fetched_at = excluded.fetched_at,
          fresh_until = excluded.fresh_until
        """,
        (key, json.dumps(value), now, now + ttl),
    )
    get_db().commit()


def _normalize_difficulty(value: str | None) -> Difficulty | None:
    key = (value or "").lower()
    if key == "easy":
        return "Easy"
    if key == "medium":
        return "Medium"
    if key == "hard":
        return "Hard"
    return None


def _graphql(query: str, variables: dict[str, Any] | None = None) -> Any:
    global _cooldown_until, _last_error, _last_live_at
    if _now_ms() < _cooldown_until:
        raise RuntimeError("LeetCode rate-limit cooldown is active")
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    request = Request(
        LEETCODE_GRAPHQL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Referer": "https://leetcode.com/problemset/",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
            status = getattr(response, "status", 200)
    except HTTPError as err:
        status = err.code
        if status in {429, 403}:
            _cooldown_until = _now_ms() + 60_000
            _last_error = f"LeetCode HTTP {status}"
            raise RuntimeError(_last_error) from err
        _last_error = f"LeetCode HTTP {status}"
        raise RuntimeError(_last_error) from err
    except URLError as err:
        _last_error = f"LeetCode request failed: {err.reason}"
        raise RuntimeError(_last_error) from err

    if status in {429, 403}:
        _cooldown_until = _now_ms() + 60_000
        _last_error = f"LeetCode HTTP {status}"
        raise RuntimeError(_last_error)
    if "errors" in payload and payload["errors"]:
        _last_error = payload["errors"][0].get("message") or "LeetCode GraphQL error"
        raise RuntimeError(_last_error)
    if not payload.get("data"):
        _last_error = "LeetCode returned an empty payload"
        raise RuntimeError(_last_error)
    _last_error = ""
    _last_live_at = float(_now_ms())
    return payload["data"]


LIST_QUERY = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      paidOnly: isPaidOnly
      title
      titleSlug
      topicTags { name slug }
    }
  }
}
"""


def list_problems(
    *,
    difficulty: Difficulty,
    topic: str | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    topic = topic or ""
    key = f"list:{difficulty}:{topic}:{limit}"
    cached = _read_cache(key)
    if cached and cached["fresh"]:
        parsed = cached["value"]
        return {
            **parsed,
            "source": "cache",
            "fetchedAt": cached["fetchedAt"],
            "error": None,
            "endpoint": LEETCODE_GRAPHQL,
        }

    try:
        filters: dict[str, Any] = {"difficulty": difficulty.upper()}
        if topic:
            filters["tags"] = [topic]
        data = _graphql(
            LIST_QUERY,
            {
                "categorySlug": "",
                "limit": limit,
                "skip": 0,
                "filters": filters,
            },
        )
        raw = (data.get("problemsetQuestionList") or {}).get("questions") or []
        questions: list[dict[str, Any]] = []
        for row in raw:
            normalized = _normalize_difficulty(row.get("difficulty"))
            slug = row.get("titleSlug")
            title = row.get("title")
            question_id = row.get("frontendQuestionId")
            if not normalized or not slug or not title or not question_id or row.get("paidOnly"):
                continue
            tags = [tag.get("slug") for tag in (row.get("topicTags") or []) if tag.get("slug")]
            if topic and topic not in tags:
                continue
            questions.append(
                {
                    "questionId": question_id,
                    "title": title,
                    "slug": slug,
                    "difficulty": normalized,
                    "paid": False,
                    "tags": tags,
                    "url": problem_url(slug),
                    "acRate": row.get("acRate") if isinstance(row.get("acRate"), (int, float)) else None,
                }
            )
        payload = {
            "total": (data.get("problemsetQuestionList") or {}).get("total") or len(questions),
            "questions": questions,
        }
        _write_cache(key, payload, LIST_TTL_MS)
        return {
            **payload,
            "source": "live",
            "fetchedAt": _now_ms(),
            "error": None,
            "endpoint": LEETCODE_GRAPHQL,
        }
    except Exception as err:  # noqa: BLE001
        message = str(err)
        if cached:
            parsed = cached["value"]
            return {
                **parsed,
                "source": "cache",
                "fetchedAt": cached["fetchedAt"],
                "error": message,
                "endpoint": LEETCODE_GRAPHQL,
            }
        return {
            "total": 0,
            "questions": [],
            "source": "unavailable",
            "fetchedAt": None,
            "error": message,
            "endpoint": LEETCODE_GRAPHQL,
        }


def resolve_catalog_metadata() -> dict[str, Any]:
    key = "catalog-meta:v2"
    cached = _read_cache(key)
    if cached and cached["fresh"]:
        rows = cached["value"]
        return {
            "bySlug": {row["slug"]: {"meta": row, "source": "cache"} for row in rows},
            "source": "cache",
            "error": None,
            "fetchedAt": cached["fetchedAt"],
        }

    fields = "\n".join(
        f'p{index}: question(titleSlug: {json.dumps(problem.slug)}) '
        "{ questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug } }"
        for index, problem in enumerate(judge_problems())
    )
    try:
        data = _graphql(f"query {{ {fields} }}")
        rows: list[dict[str, Any]] = []
        for index, problem in enumerate(judge_problems()):
            row = data.get(f"p{index}") or {}
            difficulty = _normalize_difficulty(row.get("difficulty"))
            if not row.get("title") or not row.get("titleSlug") or not row.get("questionFrontendId") or not difficulty:
                continue
            slug = row.get("titleSlug") or problem.slug
            rows.append(
                {
                    "questionId": row["questionFrontendId"],
                    "title": row["title"],
                    "slug": slug,
                    "difficulty": difficulty,
                    "paid": bool(row.get("isPaidOnly")),
                    "tags": [tag.get("slug") for tag in (row.get("topicTags") or []) if tag.get("slug")],
                    "url": problem_url(slug),
                }
            )
        if not rows:
            raise RuntimeError("LeetCode returned no catalog metadata")
        _write_cache(key, rows, DETAIL_TTL_MS)
        return {
            "bySlug": {row["slug"]: {"meta": row, "source": "live"} for row in rows},
            "source": "live",
            "error": None,
            "fetchedAt": _now_ms(),
        }
    except Exception as err:  # noqa: BLE001
        message = str(err)
        if cached:
            rows = cached["value"]
            return {
                "bySlug": {row["slug"]: {"meta": row, "source": "cache"} for row in rows},
                "source": "cache",
                "error": message,
                "fetchedAt": cached["fetchedAt"],
            }
        return {
            "bySlug": {slug: {"meta": meta, "source": "seed"} for slug, meta in SEED.items()},
            "source": "seed",
            "error": message,
            "fetchedAt": None,
        }


def select_mission_rooms(completed_slugs: list[str]) -> dict[str, Any]:
    resolved = resolve_catalog_metadata()
    completed = set(completed_slugs)
    used: set[str] = set()
    rooms: list[dict[str, Any]] = []

    for plan in room_plan_list():
        candidates = problems_for_room(plan.topics, plan.difficulty)
        confirmed: list[dict[str, Any]] = []
        for problem in candidates:
            hit = resolved["bySlug"].get(problem.slug)
            meta = hit["meta"] if hit else SEED.get(problem.slug)
            source = hit["source"] if hit else "seed"
            if not meta or meta.get("paid"):
                continue
            if meta["difficulty"] != plan.difficulty:
                continue
            if problem.room_topic not in meta["tags"]:
                continue
            confirmed.append({"slug": problem.slug, "meta": meta, "source": source})

        pool = [item for item in confirmed if item["slug"] not in completed and item["slug"] not in used]
        repeated = False
        if not pool:
            pool = [item for item in confirmed if item["slug"] not in used]
            repeated = bool(pool)
        if not pool:
            raise RuntimeError(
                f"No verifiable LeetCode {plan.difficulty} {plan.category} problem is available"
            )
        choice = random.choice(pool)
        used.add(choice["slug"])
        rooms.append(
            {
                "room": plan.room,
                "category": plan.category,
                "problemSlug": choice["slug"],
                "meta": choice["meta"],
                "source": choice["source"],
                "repeated": repeated,
            }
        )

    return {
        "rooms": rooms,
        "provider": provider_status(resolved["source"], resolved["error"], resolved["fetchedAt"]),
    }


def provider_status(
    source: str = "idle",
    error: str | None = None,
    fetched_at: int | None = None,
) -> dict[str, Any]:
    return {
        "endpoint": LEETCODE_GRAPHQL,
        "officialApi": False,
        "contentPolicy": "metadata-only",
        "note": (
            "CODE: ADRIFT uses the same unofficial LeetCode GraphQL endpoint as InterVue for "
            "titles, ids, difficulty, tags, and links. Problem statements are not copied. "
            "Each room uses an original brief and original tests, and links to the official problem."
        ),
        "source": source,
        "error": error if error is not None else (_last_error or None),
        "fetchedAt": fetched_at if fetched_at is not None else (int(_last_live_at) or None),
        "cooldown": _now_ms() < _cooldown_until,
    }
