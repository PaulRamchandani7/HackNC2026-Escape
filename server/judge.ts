import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CompareMode, TestCase } from './problems.ts'

const PISTON_URL = process.env.PISTON_URL ?? 'https://emkc.org/api/v2/piston/execute'
const PISTON_LANGUAGE = process.env.PISTON_LANGUAGE ?? 'python3'
const PISTON_VERSION = process.env.PISTON_VERSION ?? '3.10.0'
const PYTHON = process.env.PYTHON ?? 'python3'

export type CaseResult = {
  index: number
  label: string
  passed: boolean
  got?: unknown
  expected?: unknown
  error?: string
}

export type ExecutorName = 'piston' | 'local-python'

type ExecOutcome = {
  executor: ExecutorName
  stdout: string
  stderr: string
  error?: string
  pistonBlocked: boolean
}

let pistonBlockedUntil = 0

function harness(userCode: string, functionName: string, tests: TestCase[]) {
  const args = tests.map((test) => test.args)
  return `import json as _json, traceback as _tb, io as _io, sys as _sys
_dumps = _json.dumps
_loads = _json.loads
_user_src = _loads(${JSON.stringify(JSON.stringify(userCode))})
_fn_name = _loads(${JSON.stringify(JSON.stringify(functionName))})
_cases = _loads(${JSON.stringify(JSON.stringify(args))})
_out = _io.StringIO()
_err = _io.StringIO()
_sys.stdout = _out
_sys.stderr = _err
_g = {"__name__": "solution"}
try:
    exec(compile(_user_src, "solution.py", "exec"), _g, _g)
except Exception:
    _sys.stdout = _sys.__stdout__
    _sys.stderr = _sys.__stderr__
    print(_dumps({"error": _tb.format_exc().splitlines()[-1], "results": [], "stdout": _out.getvalue(), "stderr": _err.getvalue()}))
    raise SystemExit(0)
_fn = _g.get(_fn_name)
_results = []
if not callable(_fn):
    _results = [{"error": "Define a function named " + _fn_name}]
else:
    for _args in _cases:
        try:
            _got = _fn(*list(_args))
            if isinstance(_got, tuple):
                _got = list(_got)
            _results.append({"got": _got})
        except Exception:
            _results.append({"error": _tb.format_exc().splitlines()[-1]})
_sys.stdout = _sys.__stdout__
_sys.stderr = _sys.__stderr__
print(_dumps({"results": _results, "stdout": _out.getvalue()[-4000:], "stderr": _err.getvalue()[-4000:]}))
`
}

function sortFlat(value: unknown): unknown {
  if (!Array.isArray(value)) return value
  return [...value].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
}

function normGroups(value: unknown): string[][] {
  if (!Array.isArray(value)) return [['__invalid__']]
  return value
    .map((group) => (Array.isArray(group) ? group.map((item) => String(item)).sort() : [String(group)]))
    .sort((a, b) => a.join('\u0000').localeCompare(b.join('\u0000')))
}

function matches(got: unknown, expected: unknown, compare: CompareMode) {
  if (compare === 'sorted') {
    return JSON.stringify(sortFlat(got)) === JSON.stringify(sortFlat(expected))
  }
  if (compare === 'groups') {
    return JSON.stringify(normGroups(got)) === JSON.stringify(normGroups(expected))
  }
  return JSON.stringify(got) === JSON.stringify(expected)
}

async function runPiston(source: string): Promise<ExecOutcome | null> {
  if (Date.now() < pistonBlockedUntil) return null
  const response = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: PISTON_LANGUAGE,
      version: PISTON_VERSION,
      files: [{ name: 'main.py', content: source }],
      run_timeout: 8000,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  if (response.status === 401 || response.status === 403 || /whitelist/i.test(text)) {
    pistonBlockedUntil = Date.now() + 10 * 60 * 1000
    return {
      executor: 'piston',
      stdout: '',
      stderr: text.slice(0, 500),
      error: 'Public Piston rejected the request',
      pistonBlocked: true,
    }
  }
  if (!response.ok) {
    return {
      executor: 'piston',
      stdout: '',
      stderr: text.slice(0, 500),
      error: `Piston error (${response.status})`,
      pistonBlocked: false,
    }
  }
  const body = JSON.parse(text) as {
    run?: { stdout?: string; stderr?: string; code?: number }
    message?: string
  }
  if (!body.run) {
    return {
      executor: 'piston',
      stdout: '',
      stderr: body.message ?? '',
      error: body.message || 'Piston did not return a run',
      pistonBlocked: false,
    }
  }
  return {
    executor: 'piston',
    stdout: body.run.stdout ?? '',
    stderr: body.run.stderr ?? '',
    pistonBlocked: false,
  }
}

function runLocal(source: string): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    void (async () => {
      const root = path.resolve('data/exec')
      await mkdir(root, { recursive: true })
      const dir = await mkdtemp(path.join(root, 'run-'))
      const file = path.join(dir, 'main.py')
      await writeFile(file, source, 'utf8')
      const child = spawn(PYTHON, ['-I', file], {
        cwd: dir,
        env: {
          PATH: process.env.PATH ?? '',
          PYTHONIOENCODING: 'utf-8',
          PYTHONDONTWRITEBYTECODE: '1',
        },
        timeout: 8000,
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      child.on('error', (err) => {
        void rm(dir, { recursive: true, force: true })
        resolve({
          executor: 'local-python',
          stdout,
          stderr,
          error: err.message,
          pistonBlocked: true,
        })
      })
      child.on('close', () => {
        void rm(dir, { recursive: true, force: true })
        resolve({
          executor: 'local-python',
          stdout,
          stderr,
          pistonBlocked: true,
        })
      })
    })().catch((err: unknown) => {
      resolve({
        executor: 'local-python',
        stdout: '',
        stderr: '',
        error: err instanceof Error ? err.message : 'Local executor failed',
        pistonBlocked: true,
      })
    })
  })
}

const LOCAL_NOTE =
  'Public Piston (emkc.org) is whitelist-only. This run used the local Python process. Set PISTON_URL to a self-hosted Piston API to use the InterVue executor.'

export async function runTests(opts: {
  code: string
  functionName: string
  tests: TestCase[]
  compare: CompareMode
  revealExpected: boolean
}): Promise<{
  ok: boolean
  passedAll: boolean
  stdout: string
  stderr: string
  results: CaseResult[]
  error?: string
  executor: ExecutorName
  pistonNote: string | null
}> {
  const source = harness(opts.code, opts.functionName, opts.tests)
  let outcome: ExecOutcome
  try {
    const piston = await runPiston(source)
    if (!piston || piston.pistonBlocked) {
      if (process.env.PISTON_ONLY === 'true') {
        return {
          ok: false,
          passedAll: false,
          stdout: '',
          stderr: piston?.stderr ?? '',
          results: [],
          error:
            'Piston rejected execution. Host your own Piston and set PISTON_URL. Local fallback is disabled.',
          executor: 'piston',
          pistonNote: LOCAL_NOTE,
        }
      }
      outcome = await runLocal(source)
    } else if (piston.error && !piston.stdout) {
      return {
        ok: false,
        passedAll: false,
        stdout: '',
        stderr: piston.stderr,
        results: [],
        error: piston.error,
        executor: 'piston',
        pistonNote: null,
      }
    } else {
      outcome = piston
    }
  } catch (err) {
    if (process.env.PISTON_ONLY === 'true') {
      return {
        ok: false,
        passedAll: false,
        stdout: '',
        stderr: '',
        results: [],
        error: err instanceof Error ? err.message : 'Piston request failed',
        executor: 'piston',
        pistonNote: null,
      }
    }
    outcome = await runLocal(source)
  }

  if (outcome.error && !outcome.stdout) {
    return {
      ok: false,
      passedAll: false,
      stdout: '',
      stderr: outcome.stderr,
      results: [],
      error: outcome.error,
      executor: outcome.executor,
      pistonNote: outcome.executor === 'local-python' ? LOCAL_NOTE : null,
    }
  }

  const line = outcome.stdout
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .reverse()
    .find((row) => row.startsWith('{'))
  if (!line) {
    return {
      ok: true,
      passedAll: false,
      stdout: outcome.stdout.slice(0, 2000),
      stderr: outcome.stderr.slice(0, 2000),
      results: [],
      error: outcome.stderr.trim() || 'Program did not return judge output. Check for a syntax error.',
      executor: outcome.executor,
      pistonNote: outcome.executor === 'local-python' ? LOCAL_NOTE : null,
    }
  }

  let parsed: {
    error?: string
    stdout?: string
    stderr?: string
    results?: Array<{ got?: unknown; error?: string }>
  }
  try {
    parsed = JSON.parse(line) as typeof parsed
  } catch {
    return {
      ok: true,
      passedAll: false,
      stdout: '',
      stderr: outcome.stderr,
      results: [],
      error: 'Unable to parse judge output.',
      executor: outcome.executor,
      pistonNote: outcome.executor === 'local-python' ? LOCAL_NOTE : null,
    }
  }

  if (parsed.error && (!parsed.results || parsed.results.length === 0)) {
    return {
      ok: true,
      passedAll: false,
      stdout: parsed.stdout ?? '',
      stderr: parsed.stderr || outcome.stderr,
      results: [],
      error: parsed.error,
      executor: outcome.executor,
      pistonNote: outcome.executor === 'local-python' ? LOCAL_NOTE : null,
    }
  }

  const results: CaseResult[] = (parsed.results ?? []).map((row, index) => {
    const test = opts.tests[index]
    const passed = !row.error && matches(row.got, test?.expected, opts.compare)
    return {
      index,
      label: test?.label ?? `Test ${index + 1}`,
      passed,
      got: opts.revealExpected || !passed ? row.got : undefined,
      expected: opts.revealExpected ? test?.expected : undefined,
      error: row.error,
    }
  })

  return {
    ok: true,
    passedAll: results.length === opts.tests.length && results.every((row) => row.passed),
    stdout: (parsed.stdout ?? '').trim(),
    stderr: (parsed.stderr || outcome.stderr).trim(),
    results,
    error: results.some((row) => row.error)
      ? results.find((row) => row.error)?.error
      : undefined,
    executor: outcome.executor,
    pistonNote: outcome.executor === 'local-python' ? LOCAL_NOTE : null,
  }
}
