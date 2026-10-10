"""Grade Python solutions through Piston.

User code is sent to the Piston API. This module does not execute it.
"""

import json
import os
import time
import urllib.error
import urllib.request

from .outbound import urlopen

PISTON_URL = os.environ.get("PISTON_URL", "https://emkc.org/api/v2/piston/execute")
PISTON_LANGUAGE = os.environ.get("PISTON_LANGUAGE", "python3")
PISTON_VERSION = os.environ.get("PISTON_VERSION", "3.10.0")

_piston_blocked_until = 0.0

REJECTED = (
    "Piston rejected execution. Host your own Piston and set PISTON_URL. "
    "This server does not run submitted code itself."
)


def harness(user_code, function_name, tests):
    args = [test["args"] for test in tests]
    user_lit = json.dumps(json.dumps(user_code))
    name_lit = json.dumps(json.dumps(function_name))
    cases_lit = json.dumps(json.dumps(args))
    return f"""import json as _json, traceback as _tb, io as _io, sys as _sys
_dumps = _json.dumps
_loads = _json.loads
_user_src = _loads({user_lit})
_fn_name = _loads({name_lit})
_cases = _loads({cases_lit})
_out = _io.StringIO()
_err = _io.StringIO()
_sys.stdout = _out
_sys.stderr = _err
_g = {{"__name__": "solution"}}
try:
    exec(compile(_user_src, "solution.py", "exec"), _g, _g)
except Exception:
    _sys.stdout = _sys.__stdout__
    _sys.stderr = _sys.__stderr__
    print(_dumps({{"error": _tb.format_exc().splitlines()[-1], "results": [], "stdout": _out.getvalue(), "stderr": _err.getvalue()}}))
    raise SystemExit(0)
_fn = _g.get(_fn_name)
_results = []
if not callable(_fn):
    _results = [{{"error": "Define a function named " + _fn_name}}]
else:
    for _args in _cases:
        try:
            _got = _fn(*list(_args))
            if isinstance(_got, tuple):
                _got = list(_got)
            _results.append({{"got": _got}})
        except Exception:
            _results.append({{"error": _tb.format_exc().splitlines()[-1]}})
_sys.stdout = _sys.__stdout__
_sys.stderr = _sys.__stderr__
print(_dumps({{"results": _results, "stdout": _out.getvalue()[-4000:], "stderr": _err.getvalue()[-4000:]}}))
"""


def _sort_flat(value):
    if not isinstance(value, list):
        return value
    return sorted(value)


def _norm_groups(value):
    if not isinstance(value, list):
        return [["__invalid__"]]
    groups = []
    for group in value:
        if isinstance(group, list):
            groups.append(sorted(str(item) for item in group))
        else:
            groups.append([str(group)])
    return sorted(groups, key=lambda group: "\u0000".join(group))


def matches(got, expected, compare):
    if compare == "sorted":
        return json.dumps(_sort_flat(got)) == json.dumps(_sort_flat(expected))
    if compare == "groups":
        return json.dumps(_norm_groups(got)) == json.dumps(_norm_groups(expected))
    return json.dumps(got) == json.dumps(expected)


def run_piston(source):
    global _piston_blocked_until
    now = time.time() * 1000
    if now < _piston_blocked_until:
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": "",
            "error": "Public Piston rejected the request",
            "piston_blocked": True,
        }
    request = urllib.request.Request(
        PISTON_URL,
        data=json.dumps(
            {
                "language": PISTON_LANGUAGE,
                "version": PISTON_VERSION,
                "files": [{"name": "main.py", "content": source}],
                "run_timeout": 8000,
            }
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            status = response.status
            text = response.read().decode()
    except urllib.error.HTTPError as exc:
        status = exc.code
        text = exc.read().decode(errors="replace")
    except Exception as exc:
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": "",
            "error": str(exc) or "Piston request failed",
            "piston_blocked": False,
        }
    if status in {401, 403} or "whitelist" in text.lower():
        _piston_blocked_until = time.time() * 1000 + 10 * 60 * 1000
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": text[:500],
            "error": "Public Piston rejected the request",
            "piston_blocked": True,
        }
    if status >= 400:
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": text[:500],
            "error": f"Piston error ({status})",
            "piston_blocked": False,
        }
    try:
        body = json.loads(text)
    except json.JSONDecodeError:
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": text[:500],
            "error": "Piston did not return JSON",
            "piston_blocked": False,
        }
    run = body.get("run")
    if not run:
        message = body.get("message") or "Piston did not return a run"
        return {
            "executor": "piston",
            "stdout": "",
            "stderr": message,
            "error": message,
            "piston_blocked": False,
        }
    return {
        "executor": "piston",
        "stdout": run.get("stdout") or "",
        "stderr": run.get("stderr") or "",
        "error": None,
        "piston_blocked": False,
    }


def _rejected(stderr=""):
    return {
        "ok": False,
        "passedAll": False,
        "stdout": "",
        "stderr": stderr,
        "results": [],
        "error": REJECTED,
        "executor": "piston",
        "pistonNote": None,
    }


def _failed(outcome, error):
    return {
        "ok": False if outcome.get("error") and not outcome.get("stdout") else True,
        "passedAll": False,
        "stdout": (outcome.get("stdout") or "")[:2000],
        "stderr": (outcome.get("stderr") or "")[:2000],
        "results": [],
        "error": error,
        "executor": "piston",
        "pistonNote": None,
    }


def run_tests(*, code, function_name, tests, compare, reveal_expected):
    source = harness(code, function_name, tests)
    outcome = run_piston(source)
    if outcome["piston_blocked"] or (outcome.get("error") and not outcome.get("stdout")):
        if outcome["piston_blocked"]:
            return _rejected(outcome.get("stderr") or "")
        return _failed(outcome, outcome.get("error") or "Piston request failed")

    line = next(
        (
            row
            for row in reversed([row.strip() for row in outcome["stdout"].split("\n") if row.strip()])
            if row.startswith("{")
        ),
        None,
    )
    if not line:
        return _failed(outcome, outcome["stderr"].strip() or "Program did not return judge output. Check for a syntax error.")

    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        return _failed(outcome, "Unable to parse judge output.")

    rows = parsed.get("results") or []
    if parsed.get("error") and not rows:
        return {
            "ok": True,
            "passedAll": False,
            "stdout": parsed.get("stdout") or "",
            "stderr": parsed.get("stderr") or outcome.get("stderr") or "",
            "results": [],
            "error": parsed["error"],
            "executor": "piston",
            "pistonNote": None,
        }

    results = []
    for index, row in enumerate(rows):
        test = tests[index] if index < len(tests) else {}
        passed = not row.get("error") and index < len(tests) and matches(row.get("got"), test.get("expected"), compare)
        item = {
            "index": index,
            "label": test.get("label") or f"Test {index + 1}",
            "passed": passed,
        }
        if reveal_expected or not passed:
            if "got" in row:
                item["got"] = row.get("got")
        if reveal_expected:
            item["expected"] = test.get("expected")
        if row.get("error"):
            item["error"] = row["error"]
        results.append(item)

    error = next((item["error"] for item in results if item.get("error")), None)
    return {
        "ok": True,
        "passedAll": len(results) == len(tests) and all(item["passed"] for item in results),
        "stdout": (parsed.get("stdout") or "").strip(),
        "stderr": (parsed.get("stderr") or outcome.get("stderr") or "").strip(),
        "results": results,
        "error": error,
        "executor": "piston",
        "pistonNote": None,
    }
