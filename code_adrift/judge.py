from __future__ import annotations

import json
import os
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from code_adrift.problems import CompareMode, TestCase

ExecutorName = Literal["piston", "local-python"]

PISTON_URL = os.environ.get("PISTON_URL", "https://emkc.org/api/v2/piston/execute")
PISTON_LANGUAGE = os.environ.get("PISTON_LANGUAGE", "python3")
PISTON_VERSION = os.environ.get("PISTON_VERSION", "3.10.0")
PYTHON = os.environ.get("PYTHON", "python3")

LOCAL_NOTE = (
    "Public Piston (emkc.org) is whitelist-only. This run used the local Python process. "
    "Set PISTON_URL to a self-hosted Piston API to use the InterVue executor."
)

_piston_blocked_until = 0.0


@dataclass
class CaseResult:
    index: int
    label: str
    passed: bool
    got: Any | None = None
    expected: Any | None = None
    error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "index": self.index,
            "label": self.label,
            "passed": self.passed,
        }
        if self.got is not None:
            payload["got"] = self.got
        if self.expected is not None:
            payload["expected"] = self.expected
        if self.error is not None:
            payload["error"] = self.error
        return payload


@dataclass
class ExecOutcome:
    executor: ExecutorName
    stdout: str
    stderr: str
    error: str | None = None
    piston_blocked: bool = False


def _harness(user_code: str, function_name: str, tests: list[TestCase]) -> str:
    args = [test.args for test in tests]
    return f"""import json as _json, traceback as _tb, io as _io, sys as _sys
_dumps = _json.dumps
_loads = _json.loads
_user_src = _loads({json.dumps(json.dumps(user_code))})
_fn_name = _loads({json.dumps(json.dumps(function_name))})
_cases = _loads({json.dumps(json.dumps(args))})
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


def _sort_flat(value: Any) -> Any:
    if not isinstance(value, list):
        return value
    return sorted(value, key=lambda item: (str(type(item)), str(item)))


def _norm_groups(value: Any) -> list[list[str]]:
    if not isinstance(value, list):
        return [["__invalid__"]]
    groups: list[list[str]] = []
    for group in value:
        if isinstance(group, list):
            groups.append(sorted(str(item) for item in group))
        else:
            groups.append([str(group)])
    groups.sort(key=lambda group: "\0".join(group))
    return groups


def matches(got: Any, expected: Any, compare: CompareMode) -> bool:
    if compare == "sorted":
        return json.dumps(_sort_flat(got), sort_keys=True) == json.dumps(
            _sort_flat(expected), sort_keys=True
        )
    if compare == "groups":
        return json.dumps(_norm_groups(got)) == json.dumps(_norm_groups(expected))
    return json.dumps(got, sort_keys=True) == json.dumps(expected, sort_keys=True)


def _run_piston(source: str) -> ExecOutcome | None:
    global _piston_blocked_until
    if time.time() * 1000 < _piston_blocked_until:
        return None
    body = json.dumps(
        {
            "language": PISTON_LANGUAGE,
            "version": PISTON_VERSION,
            "files": [{"name": "main.py", "content": source}],
            "run_timeout": 8000,
        }
    ).encode("utf-8")
    request = Request(
        PISTON_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            text = response.read().decode("utf-8", errors="replace")
            status = getattr(response, "status", 200)
    except HTTPError as err:
        text = err.read().decode("utf-8", errors="replace")
        status = err.code
    except URLError as err:
        return ExecOutcome(
            executor="piston",
            stdout="",
            stderr=str(err.reason),
            error=f"Piston request failed: {err.reason}",
            piston_blocked=False,
        )

    if status in {401, 403} or "whitelist" in text.lower():
        _piston_blocked_until = time.time() * 1000 + 10 * 60 * 1000
        return ExecOutcome(
            executor="piston",
            stdout="",
            stderr=text[:500],
            error="Public Piston rejected the request",
            piston_blocked=True,
        )
    if status < 200 or status >= 300:
        return ExecOutcome(
            executor="piston",
            stdout="",
            stderr=text[:500],
            error=f"Piston error ({status})",
            piston_blocked=False,
        )
    payload = json.loads(text)
    run = payload.get("run")
    if not run:
        message = payload.get("message") or "Piston did not return a run"
        return ExecOutcome(
            executor="piston",
            stdout="",
            stderr=str(payload.get("message") or ""),
            error=str(message),
            piston_blocked=False,
        )
    return ExecOutcome(
        executor="piston",
        stdout=run.get("stdout") or "",
        stderr=run.get("stderr") or "",
        piston_blocked=False,
    )


def _run_local(source: str) -> ExecOutcome:
    import subprocess

    root = Path("data/exec").resolve()
    root.mkdir(parents=True, exist_ok=True)
    dir_path = Path(tempfile.mkdtemp(prefix="run-", dir=root))
    file_path = dir_path / "main.py"
    try:
        file_path.write_text(source, encoding="utf-8")
        completed = subprocess.run(
            [PYTHON, "-I", str(file_path)],
            cwd=dir_path,
            env={
                "PATH": os.environ.get("PATH", ""),
                "PYTHONIOENCODING": "utf-8",
                "PYTHONDONTWRITEBYTECODE": "1",
            },
            capture_output=True,
            text=True,
            timeout=8,
        )
        return ExecOutcome(
            executor="local-python",
            stdout=completed.stdout,
            stderr=completed.stderr,
            piston_blocked=True,
        )
    except subprocess.TimeoutExpired:
        return ExecOutcome(
            executor="local-python",
            stdout="",
            stderr="",
            error="Local executor timed out",
            piston_blocked=True,
        )
    except Exception as err:  # noqa: BLE001 — surface any spawn failure to the client
        return ExecOutcome(
            executor="local-python",
            stdout="",
            stderr="",
            error=str(err),
            piston_blocked=True,
        )
    finally:
        shutil.rmtree(dir_path, ignore_errors=True)


def run_tests(
    *,
    code: str,
    function_name: str,
    tests: list[TestCase],
    compare: CompareMode,
    reveal_expected: bool,
) -> dict[str, Any]:
    source = _harness(code, function_name, tests)
    piston_only = os.environ.get("PISTON_ONLY", "").lower() == "true"

    try:
        piston = _run_piston(source)
        if piston is None or piston.piston_blocked:
            if piston_only:
                return {
                    "ok": False,
                    "passedAll": False,
                    "stdout": "",
                    "stderr": piston.stderr if piston else "",
                    "results": [],
                    "error": (
                        "Piston rejected execution. Host your own Piston and set PISTON_URL. "
                        "Local fallback is disabled."
                    ),
                    "executor": "piston",
                    "pistonNote": LOCAL_NOTE,
                }
            outcome = _run_local(source)
        elif piston.error and not piston.stdout:
            return {
                "ok": False,
                "passedAll": False,
                "stdout": "",
                "stderr": piston.stderr,
                "results": [],
                "error": piston.error,
                "executor": "piston",
                "pistonNote": None,
            }
        else:
            outcome = piston
    except Exception as err:  # noqa: BLE001
        if piston_only:
            return {
                "ok": False,
                "passedAll": False,
                "stdout": "",
                "stderr": "",
                "results": [],
                "error": str(err),
                "executor": "piston",
                "pistonNote": None,
            }
        outcome = _run_local(source)

    note = LOCAL_NOTE if outcome.executor == "local-python" else None

    if outcome.error and not outcome.stdout:
        return {
            "ok": False,
            "passedAll": False,
            "stdout": "",
            "stderr": outcome.stderr,
            "results": [],
            "error": outcome.error,
            "executor": outcome.executor,
            "pistonNote": note,
        }

    line = next(
        (
            row
            for row in reversed(outcome.stdout.splitlines())
            if row.strip().startswith("{")
        ),
        None,
    )
    if not line:
        return {
            "ok": True,
            "passedAll": False,
            "stdout": outcome.stdout[:2000],
            "stderr": outcome.stderr[:2000],
            "results": [],
            "error": outcome.stderr.strip()
            or "Program did not return judge output. Check for a syntax error.",
            "executor": outcome.executor,
            "pistonNote": note,
        }

    try:
        parsed = json.loads(line.strip())
    except json.JSONDecodeError:
        return {
            "ok": True,
            "passedAll": False,
            "stdout": "",
            "stderr": outcome.stderr,
            "results": [],
            "error": "Unable to parse judge output.",
            "executor": outcome.executor,
            "pistonNote": note,
        }

    if parsed.get("error") and not parsed.get("results"):
        return {
            "ok": True,
            "passedAll": False,
            "stdout": parsed.get("stdout") or "",
            "stderr": parsed.get("stderr") or outcome.stderr,
            "results": [],
            "error": parsed["error"],
            "executor": outcome.executor,
            "pistonNote": note,
        }

    results: list[CaseResult] = []
    for index, row in enumerate(parsed.get("results") or []):
        test = tests[index] if index < len(tests) else None
        passed = not row.get("error") and test is not None and matches(
            row.get("got"), test.expected, compare
        )
        results.append(
            CaseResult(
                index=index,
                label=test.label if test else f"Test {index + 1}",
                passed=passed,
                got=row.get("got") if reveal_expected or not passed else None,
                expected=test.expected if reveal_expected and test else None,
                error=row.get("error"),
            )
        )

    error = next((row.error for row in results if row.error), None)
    return {
        "ok": True,
        "passedAll": len(results) == len(tests) and all(row.passed for row in results),
        "stdout": (parsed.get("stdout") or "").strip(),
        "stderr": (parsed.get("stderr") or outcome.stderr).strip(),
        "results": [row.as_dict() for row in results],
        "error": error,
        "executor": outcome.executor,
        "pistonNote": note,
    }
