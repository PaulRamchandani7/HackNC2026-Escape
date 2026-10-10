"""LeetCode metadata, using the same unofficial GraphQL endpoint as InterVue.

Statements are not requested. A seed of last-known titles and tags is used
when the site is down or rate-limits the request.
"""

import json
import random
import time
import urllib.error
import urllib.request

from .outbound import urlopen

from django.db import connection

from .rooms import PROBLEMS, ROOM_PLAN, problems_for_room

LEETCODE_GRAPHQL = "https://leetcode.com/graphql"
LIST_TTL_MS = 15 * 60 * 1000
DETAIL_TTL_MS = 6 * 60 * 60 * 1000
STALE_OK_MS = 7 * 24 * 60 * 60 * 1000

_cooldown_until = 0.0
_last_error = ""
_last_live_at = 0.0
PROBLEM_ORDER = PROBLEMS


def problem_url(slug):
    return f"https://leetcode.com/problems/{slug}/"


def _meta(question_id, title, slug, difficulty, tags):
    return {
        "questionId": question_id,
        "title": title,
        "slug": slug,
        "difficulty": difficulty,
        "paid": False,
        "tags": tags,
        "url": problem_url(slug),
    }


SEED = {
    "search-insert-position": _meta("35", "Search Insert Position", "search-insert-position", "Easy", ["array", "binary-search"]),
    "best-time-to-buy-and-sell-stock": _meta("121", "Best Time to Buy and Sell Stock", "best-time-to-buy-and-sell-stock", "Easy", ["array", "dynamic-programming"]),
    "plus-one": _meta("66", "Plus One", "plus-one", "Easy", ["array", "math"]),
    "squares-of-a-sorted-array": _meta("977", "Squares of a Sorted Array", "squares-of-a-sorted-array", "Easy", ["array", "two-pointers", "sorting"]),
    "max-consecutive-ones": _meta("485", "Max Consecutive Ones", "max-consecutive-ones", "Easy", ["array"]),
    "valid-palindrome": _meta("125", "Valid Palindrome", "valid-palindrome", "Easy", ["two-pointers", "string"]),
    "length-of-last-word": _meta("58", "Length of Last Word", "length-of-last-word", "Easy", ["string"]),
    "first-unique-character-in-a-string": _meta("387", "First Unique Character in a String", "first-unique-character-in-a-string", "Easy", ["hash-table", "string", "queue", "counting"]),
    "detect-capital": _meta("520", "Detect Capital", "detect-capital", "Easy", ["string"]),
    "group-anagrams": _meta("49", "Group Anagrams", "group-anagrams", "Medium", ["array", "hash-table", "string", "sorting"]),
    "top-k-frequent-elements": _meta("347", "Top K Frequent Elements", "top-k-frequent-elements", "Medium", ["array", "hash-table", "divide-and-conquer", "sorting", "heap-priority-queue", "bucket-sort", "counting", "quickselect"]),
    "subarray-sum-equals-k": _meta("560", "Subarray Sum Equals K", "subarray-sum-equals-k", "Medium", ["array", "hash-table", "prefix-sum"]),
    "longest-consecutive-sequence": _meta("128", "Longest Consecutive Sequence", "longest-consecutive-sequence", "Medium", ["array", "hash-table", "union-find"]),
    "longest-substring-without-repeating-characters": _meta("3", "Longest Substring Without Repeating Characters", "longest-substring-without-repeating-characters", "Medium", ["hash-table", "string", "sliding-window"]),
    "decode-string": _meta("394", "Decode String", "decode-string", "Medium", ["string", "stack", "recursion"]),
    "search-in-rotated-sorted-array": _meta("33", "Search in Rotated Sorted Array", "search-in-rotated-sorted-array", "Medium", ["array", "binary-search"]),
    "find-minimum-in-rotated-sorted-array": _meta("153", "Find Minimum in Rotated Sorted Array", "find-minimum-in-rotated-sorted-array", "Medium", ["array", "binary-search"]),
    "number-of-islands": _meta("200", "Number of Islands", "number-of-islands", "Medium", ["array", "depth-first-search", "breadth-first-search", "union-find", "matrix"]),
    "course-schedule": _meta("207", "Course Schedule", "course-schedule", "Medium", ["depth-first-search", "breadth-first-search", "graph", "topological-sort"]),
    "number-of-provinces": _meta("547", "Number of Provinces", "number-of-provinces", "Medium", ["depth-first-search", "breadth-first-search", "union-find", "graph"]),
}


def _ensure_cache():
    with connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS problem_cache (
                cache_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                fetched_at INTEGER NOT NULL,
                fresh_until INTEGER NOT NULL
            )
            """
        )


def _read_cache(key):
    _ensure_cache()
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT payload, fetched_at, fresh_until FROM problem_cache WHERE cache_key = %s",
            [key],
        )
        row = cursor.fetchone()
    if not row:
        return None
    payload, fetched_at, fresh_until = row
    now = int(time.time() * 1000)
    if now - fetched_at > STALE_OK_MS:
        return None
    return {"value": json.loads(payload), "fresh": now <= fresh_until, "fetchedAt": fetched_at}


def _write_cache(key, value, ttl):
    _ensure_cache()
    now = int(time.time() * 1000)
    payload = json.dumps(value)
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO problem_cache (cache_key, payload, fetched_at, fresh_until)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload = excluded.payload,
                fetched_at = excluded.fetched_at,
                fresh_until = excluded.fresh_until
            """,
            [key, payload, now, now + ttl],
        )


def graphql(query, variables=None):
    global _cooldown_until, _last_error, _last_live_at
    now = time.time() * 1000
    if now < _cooldown_until:
        raise RuntimeError("LeetCode rate-limit cooldown is active")
    body = json.dumps({"query": query, "variables": variables}).encode()
    request = urllib.request.Request(
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
            status = response.status
            raw = response.read().decode()
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode(errors="replace")
        if status in {429, 403}:
            _cooldown_until = time.time() * 1000 + 60_000
        _last_error = f"LeetCode HTTP {status}"
        raise RuntimeError(_last_error) from exc
    if status in {429, 403}:
        _cooldown_until = time.time() * 1000 + 60_000
        _last_error = f"LeetCode HTTP {status}"
        raise RuntimeError(_last_error)
    if status >= 400:
        _last_error = f"LeetCode HTTP {status}"
        raise RuntimeError(_last_error)
    payload = json.loads(raw)
    if payload.get("errors"):
        _last_error = payload["errors"][0].get("message") or "LeetCode GraphQL error"
        raise RuntimeError(_last_error)
    if not payload.get("data"):
        _last_error = "LeetCode returned an empty payload"
        raise RuntimeError(_last_error)
    _last_error = ""
    _last_live_at = time.time() * 1000
    return payload["data"]


def _normalize_difficulty(value):
    key = (value or "").lower()
    if key == "easy":
        return "Easy"
    if key == "medium":
        return "Medium"
    if key == "hard":
        return "Hard"
    return None


def resolve_catalog_metadata():
    key = "catalog-meta:v2"
    cached = _read_cache(key)
    if cached and cached["fresh"]:
        rows = cached["value"]
        return {
            "by_slug": {row["slug"]: {"meta": row, "source": "cache"} for row in rows},
            "source": "cache",
            "error": None,
            "fetched_at": cached["fetchedAt"],
        }

    fields = "\n".join(
        f'p{index}: question(titleSlug: {json.dumps(problem["slug"])}) '
        "{ questionFrontendId title titleSlug difficulty isPaidOnly topicTags { slug } }"
        for index, problem in enumerate(PROBLEM_ORDER)
    )
    try:
        data = graphql(f"query {{ {fields} }}")
        rows = []
        for index, problem in enumerate(PROBLEM_ORDER):
            row = data.get(f"p{index}") or {}
            difficulty = _normalize_difficulty(row.get("difficulty"))
            if not row.get("title") or not row.get("titleSlug") or not row.get("questionFrontendId") or not difficulty:
                continue
            tags = [tag.get("slug") for tag in row.get("topicTags") or [] if tag.get("slug")]
            slug = row.get("titleSlug") or problem["slug"]
            rows.append(
                {
                    "questionId": row["questionFrontendId"],
                    "title": row["title"],
                    "slug": slug,
                    "difficulty": difficulty,
                    "paid": bool(row.get("isPaidOnly")),
                    "tags": tags,
                    "url": problem_url(slug),
                }
            )
        if not rows:
            raise RuntimeError("LeetCode returned no catalog metadata")
        _write_cache(key, rows, DETAIL_TTL_MS)
        return {
            "by_slug": {row["slug"]: {"meta": row, "source": "live"} for row in rows},
            "source": "live",
            "error": None,
            "fetched_at": int(time.time() * 1000),
        }
    except Exception as exc:
        message = str(exc) or "LeetCode request failed"
        if cached:
            rows = cached["value"]
            return {
                "by_slug": {row["slug"]: {"meta": row, "source": "cache"} for row in rows},
                "source": "cache",
                "error": message,
                "fetched_at": cached["fetchedAt"],
            }
        return {
            "by_slug": {slug: {"meta": meta, "source": "seed"} for slug, meta in SEED.items()},
            "source": "seed",
            "error": message,
            "fetched_at": None,
        }


def select_mission_rooms(completed_slugs):
    resolved = resolve_catalog_metadata()
    completed = set(completed_slugs)
    used = set()
    rooms = []
    for plan in ROOM_PLAN:
        candidates = problems_for_room(plan["topics"], plan["difficulty"])
        confirmed = []
        for problem in candidates:
            hit = resolved["by_slug"].get(problem["slug"])
            meta = hit["meta"] if hit else SEED.get(problem["slug"])
            source = hit["source"] if hit else "seed"
            if not meta or meta["paid"]:
                continue
            if meta["difficulty"] != plan["difficulty"]:
                continue
            if problem["roomTopic"] not in meta["tags"]:
                continue
            confirmed.append({"slug": problem["slug"], "meta": meta, "source": source})
        pool = [item for item in confirmed if item["slug"] not in completed and item["slug"] not in used]
        repeated = False
        if not pool:
            pool = [item for item in confirmed if item["slug"] not in used]
            repeated = bool(pool)
        if not pool:
            raise RuntimeError(
                f"No verifiable LeetCode {plan['difficulty']} {plan['category']} problem is available"
            )
        choice = random.choice(pool)
        used.add(choice["slug"])
        rooms.append(
            {
                "room": plan["room"],
                "category": plan["category"],
                "problemSlug": choice["slug"],
                "meta": choice["meta"],
                "source": choice["source"],
                "repeated": repeated,
            }
        )
    return {"rooms": rooms, "source": resolved["source"], "error": resolved["error"]}
