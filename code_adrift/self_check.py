from __future__ import annotations

import sys

from code_adrift.judge import run_tests
from code_adrift.leetcode import list_problems, select_mission_rooms
from code_adrift.problems import judge_problems
from code_adrift.references import reference_solutions


def main() -> int:
    failures: list[str] = []
    refs = reference_solutions()

    for problem in judge_problems():
        code = refs.get(problem.slug)
        if not code:
            failures.append(f"{problem.slug}: missing reference solution")
            continue
        hidden = run_tests(
            code=code,
            function_name=problem.function_name,
            tests=problem.hidden_tests,
            compare=problem.compare,
            reveal_expected=True,
        )
        sample = run_tests(
            code=code,
            function_name=problem.function_name,
            tests=problem.sample_tests,
            compare=problem.compare,
            reveal_expected=True,
        )
        if not hidden["passedAll"] or not sample["passedAll"]:
            failures.append(
                f"{problem.slug}: sample={sample['passedAll']} hidden={hidden['passedAll']} "
                f"executor={hidden['executor']} error={hidden.get('error') or ''} {hidden['results']}"
            )
        else:
            print(f"pass {problem.slug} via {hidden['executor']}")

    wrong = run_tests(
        code="def search_insert(nums, target):\n    return 0\n",
        function_name="search_insert",
        tests=judge_problems()[0].hidden_tests,
        compare="exact",
        reveal_expected=False,
    )
    if wrong["passedAll"]:
        failures.append("placeholder solution was accepted")
    else:
        print(f"reject placeholder via {wrong['executor']}")

    listed = list_problems(difficulty="Easy", topic="array", limit=5)
    sample = ", ".join(row["slug"] for row in listed["questions"][:3])
    print(
        f"leetcode list source={listed['source']} total={listed['total']} "
        f"sample={sample} error={listed.get('error') or ''}"
    )
    if not listed["questions"] and listed["source"] == "unavailable":
        failures.append(f"leetcode list unavailable: {listed['error']}")

    selected = select_mission_rooms([])
    print(
        "selected "
        + " | ".join(
            f"{room['room']}:{room['meta']['questionId']} {room['meta']['title']} ({room['source']})"
            for room in selected["rooms"]
        )
    )

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print("self-check ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
