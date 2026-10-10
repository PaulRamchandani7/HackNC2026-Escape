import Editor, { type Monaco } from '@monaco-editor/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { VoyageBar } from '../components/VoyageBar.tsx'
import { Badge } from '../components/ui/badge.tsx'
import { Button } from '../components/ui/button.tsx'
import { difficultyVariant } from '../lib/difficulty.ts'
import { api, type CaseResult, type Mission } from '../lib/api.ts'
import { draftKey, loadMissionId, loadPlayer } from '../lib/player.ts'

export function Terminal() {
  const { room = '1' } = useParams()
  const roomNum = Number(room)
  const navigate = useNavigate()
  const [mission, setMission] = useState<Mission | null>(null)
  const [code, setCode] = useState('')
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<CaseResult[]>([])
  const [stdout, setStdout] = useState('')
  const [stderr, setStderr] = useState('')
  const [message, setMessage] = useState('')
  const [executorNote, setExecutorNote] = useState('')
  const [transition, setTransition] = useState('')
  const [hints, setHints] = useState<string[]>([])
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const challenge = useMemo(
    () => mission?.rooms.find((item) => item.room === roomNum),
    [mission, roomNum],
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const player = loadPlayer()
    const missionId = loadMissionId()
    if (!player || !missionId) {
      navigate('/')
      return
    }
    let cancelled = false
    api
      .getMission(missionId)
      .then((next) => {
        if (!cancelled) setMission(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terminal offline')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const challengeId = challenge?.id
  const starterCode = challenge?.starterCode
  const missionId = mission?.id

  useEffect(() => {
    if (!challengeId || !missionId || starterCode == null) return
    const draft = localStorage.getItem(draftKey(challengeId))
    setCode(draft || starterCode)
    setResults([])
    setStdout('')
    setStderr('')
    setMessage('')
    setExecutorNote('')
    api
      .revealedHints(missionId, challengeId)
      .then((out) => setHints(out.hints))
      .catch(() => setHints([]))
  }, [challengeId, missionId, starterCode])

  function onCode(value: string | undefined) {
    const next = value ?? ''
    setCode(next)
    if (challenge) localStorage.setItem(draftKey(challenge.id), next)
  }

  function resetCode() {
    if (!challenge) return
    setCode(challenge.starterCode)
    localStorage.removeItem(draftKey(challenge.id))
  }

  const locked = !!challenge && !!mission && !mission.unlockedRooms.includes(challenge.room)
  const solved = !!challenge && !!mission && mission.solvedChallengeIds.includes(challenge.id)

  async function run() {
    if (!challenge) return
    setRunning(true)
    setError('')
    try {
      const out = await api.run(challenge.id, code)
      setResults(out.results)
      setStdout(out.stdout)
      setStderr(out.stderr)
      setExecutorNote(out.pistonNote || `Executed by ${out.executor}`)
      setMessage(
        out.passedAll
          ? 'Sample diagnostics passed. Submit to run the sealed tests.'
          : out.error || 'Sample diagnostics failed.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  async function submit() {
    if (!challenge) return
    const player = loadPlayer()
    const missionId = mission?.id || loadMissionId()
    if (!player || !missionId) return
    setSubmitting(true)
    setError('')
    try {
      const out = await api.submit(player.id, missionId, challenge.id, code)
      setResults(out.results)
      setStdout(out.stdout)
      setStderr(out.stderr)
      setMission(out.mission)
      setExecutorNote(out.pistonNote || `Executed by ${out.executor}`)
      if (out.passedAll && out.completed) {
        setTransition(challenge.success)
        window.setTimeout(() => navigate('/finale'), 1600)
      } else if (out.passedAll) {
        setTransition(challenge.success)
        window.setTimeout(() => navigate('/ship'), 1600)
      } else {
        setMessage(out.error || 'Hidden diagnostics failed. The door stays sealed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function revealHint() {
    if (!challenge || !mission) return
    const index = hints.length
    if (index >= challenge.hintCount) return
    try {
      const out = await api.hint(mission.id, challenge.id, index)
      setHints((current) => [...current, out.hint])
      setMission((current) => (current ? { ...current, hints_used: out.hintsUsed } : current))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hint failed')
    }
  }

  if (!challenge || !mission) {
    return (
      <main className="grid min-h-svh place-items-center bg-navy text-slate-300">
        {error || 'Booting terminal…'}
      </main>
    )
  }

  const elapsed = Math.max(0, now - mission.started_at)

  return (
    <main className="min-h-svh bg-navy">
      <VoyageBar elapsedMs={elapsed} label={challenge.name} />
      {transition ? (
        <div className="restore-flash fixed inset-0 z-50 grid place-items-center bg-navy/90 px-6 text-center">
          <p className="display text-3xl text-signal sm:text-5xl">{transition}</p>
        </div>
      ) : null}
      <div className="grid min-h-[calc(100svh-57px)] lg:grid-cols-[minmax(320px,440px)_1fr]">
        <aside className="relative overflow-auto border-b border-ocean/10 px-5 py-6 lg:border-r lg:border-b-0">
          <div className="rain pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative">
            <p className="boot-line font-mono text-xs text-ocean">SYSTEM DIAGNOSTIC</p>
            <p className="mt-4 text-xs tracking-[0.2em] text-amber uppercase">{challenge.chapter}</p>
            <h1 className="display mt-2 text-3xl text-white">{challenge.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{challenge.story}</p>
            <h2 className="mt-6 text-lg text-white">
              #{challenge.questionId} {challenge.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={difficultyVariant(challenge.difficulty)}>{challenge.difficulty}</Badge>
              <Badge>{challenge.category}</Badge>
              <Badge>{challenge.metadataSource} metadata</Badge>
            </div>
            <pre className="mt-4 overflow-auto rounded-xl border border-ocean/10 bg-steel p-4 font-sans text-sm leading-6 whitespace-pre-wrap text-slate-200">
              {challenge.statement}
            </pre>
            <p className="mt-3 text-xs text-slate-500">
              Original diagnostic brief. LeetCode&apos;s statement is not copied here.
            </p>
            <a className="mt-2 inline-block text-sm text-ocean" href={challenge.leetcodeUrl} target="_blank" rel="noreferrer">
              Open the original problem
            </a>
            <div className="mt-5 space-y-2">
              {challenge.sampleTests.map((test) => (
                <pre key={test.label} className="overflow-auto rounded-lg bg-black/30 p-2 font-mono text-xs text-slate-300">
                  {test.label}: {JSON.stringify(test.args)} → {JSON.stringify(test.expected)}
                </pre>
              ))}
            </div>
            <Button
              type="button"
              className="mt-5"
              variant="outline"
              disabled={hints.length >= challenge.hintCount || mission.status !== 'active'}
              onClick={revealHint}
            >
              Hint {Math.min(hints.length + 1, challenge.hintCount)} of {challenge.hintCount}
            </Button>
            {hints.map((hint, index) => (
              <p key={hint} className="mt-2 border-l-2 border-amber bg-amber/10 px-3 py-2 text-sm">
                Hint {index + 1}: {hint}
              </p>
            ))}
            <Link className="mt-6 block text-sm text-slate-400" to="/ship">
              Return to the deck plan
            </Link>
          </div>
        </aside>
        <section className="flex flex-col gap-3 bg-[#0b1622] p-4">
          {locked ? (
            <div className="grid flex-1 place-items-center text-center">
              <div>
                <h2 className="display text-3xl text-white">Compartment sealed</h2>
                <p className="mt-2 max-w-md text-slate-400">
                  The previous diagnostic has to be accepted by the ship before this door opens.
                </p>
                <Button className="mt-4" onClick={() => navigate('/ship')}>
                  Back to the deck
                </Button>
              </div>
            </div>
          ) : (
            <>
              {solved ? (
                <p className="text-sm text-signal">This system is already restored. You can review the code.</p>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-ocean/20">
                <Editor
                  height="48vh"
                  defaultLanguage="python"
                  theme="adrift"
                  beforeMount={defineTheme}
                  value={code}
                  onChange={onCode}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={resetCode}>
                  Reset Code
                </Button>
                <Button type="button" variant="outline" disabled={running} onClick={run}>
                  {running ? 'Running samples…' : 'Run Code'}
                </Button>
                <Button type="button" disabled={submitting || solved} onClick={submit}>
                  {submitting ? 'Checking sealed tests…' : 'Submit Solution'}
                </Button>
              </div>
              {error ? <p className="text-alarm">{error}</p> : null}
              {message ? <p className="text-ocean">{message}</p> : null}
              {executorNote ? <p className="text-xs text-slate-500">{executorNote}</p> : null}
              <div className="grid gap-2">
                {results.map((result) => (
                  <div
                    key={`${result.label}-${result.index}`}
                    className={`rounded-lg bg-steel px-3 py-2 text-sm ${result.passed ? 'border-l-2 border-signal' : 'border-l-2 border-alarm'}`}
                  >
                    <strong>{result.passed ? 'PASS' : 'FAIL'}</strong> {result.label}
                    {result.error ? <div className="text-alarm">{result.error}</div> : null}
                    {!result.passed && !result.error ? (
                      <div className="font-mono text-xs text-slate-400">
                        got {JSON.stringify(result.got)}
                        {result.expected !== undefined
                          ? ` · expected ${JSON.stringify(result.expected)}`
                          : ' · the sealed expected value stays on the server'}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              {stdout ? <Output label="stdout" text={stdout} /> : null}
              {stderr ? <Output label="stderr" text={stderr} danger /> : null}
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme('adrift', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '4FD1E8' },
      { token: 'string', foreground: 'F4B860' },
      { token: 'comment', foreground: '6d8294' },
    ],
    colors: {
      'editor.background': '#0b1622',
      'editorLineNumber.foreground': '#6d8294',
    },
  })
}

function Output({ label, text, danger = false }: { label: string; text: string; danger?: boolean }) {
  return (
    <pre className={`overflow-auto rounded-lg bg-black/40 p-3 text-xs ${danger ? 'text-alarm' : 'text-slate-300'}`}>
      <span className="mb-1 block text-slate-500">{label}</span>
      {text}
    </pre>
  )
}
