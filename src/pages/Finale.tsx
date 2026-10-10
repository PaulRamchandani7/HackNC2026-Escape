import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button.tsx'
import { Card } from '../components/ui/card.tsx'
import { api, type Mission } from '../lib/api.ts'
import { formatDuration, loadMissionId, loadPlayer, saveMissionId } from '../lib/player.ts'

export function Finale() {
  const navigate = useNavigate()
  const [mission, setMission] = useState<Mission | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = loadMissionId()
    if (!id) {
      navigate('/')
      return
    }
    api
      .getMission(id)
      .then((next) => {
        if (!next.allSolved) navigate('/ship')
        else setMission(next)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'The horizon is still dark'))
  }, [navigate])

  async function playAgain() {
    const player = loadPlayer()
    if (!player) {
      navigate('/intro')
      return
    }
    const next = await api.startMission(player.id, true)
    saveMissionId(next.id)
    navigate('/ship')
  }

  if (!mission) {
    return <main className="ocean-stage grid min-h-svh place-items-center">{error || 'The storm is breaking…'}</main>
  }

  const elapsed = mission.escape_ms ?? mission.elapsedMs
  const difficulties = [...new Set(mission.rooms.map((room) => room.difficulty))].join(', ')
  const card = [
    'CODE: ADRIFT',
    'YOU MADE IT HOME',
    `Problems solved: ${mission.solvedChallengeIds.length}`,
    `Escape time: ${formatDuration(elapsed)}`,
    `Hints used: ${mission.hints_used}`,
    `Submission attempts: ${mission.attempts}`,
    `Difficulty: ${difficulties}`,
  ].join('\n')

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'CODE: ADRIFT', text: card }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(card)
    setCopied(true)
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[linear-gradient(180deg,#07111c_0%,#16324a_42%,#f4b860_78%,#f7e2b8_100%)]">
      <div className="rain absolute inset-0 opacity-20" />
      <div className="relative z-10 mx-auto flex min-h-svh w-[min(860px,calc(100%-1.5rem))] flex-col items-center justify-center py-16 text-center">
        <Bridge />
        <p className="mt-8 text-xs tracking-[0.28em] text-navy uppercase">All systems restored</p>
        <h1 className="display mt-3 text-5xl text-white sm:text-6xl">You made it home</h1>
        <p className="mt-4 max-w-xl text-lg text-slate-100">
          You restored the ship, navigated through the storm, and escaped using nothing but your
          problem-solving skills.
        </p>
        <p className="mt-3 font-mono text-sm tracking-wide text-navy">COURSE SET FOR HOME. YOU ESCAPED.</p>
        <Card className="mt-8 w-full max-w-lg bg-navy/80 text-left text-slate-100">
          <p className="text-xs tracking-[0.2em] text-ocean uppercase">Escape card</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <Stat label="Problems solved" value={String(mission.solvedChallengeIds.length)} />
            <Stat label="Escape time" value={formatDuration(elapsed)} />
            <Stat label="Hints used" value={String(mission.hints_used)} />
            <Stat label="Attempts" value={String(mission.attempts)} />
            <Stat label="Difficulty" value={difficulties} />
          </dl>
        </Card>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={playAgain}>Play Again</Button>
          <Button variant="amber" onClick={share}>
            {copied ? 'Copied' : 'Share Your Escape'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1 text-lg text-white">{value}</dd>
    </div>
  )
}

function Bridge() {
  return (
    <svg viewBox="0 0 640 180" className="w-full max-w-xl" aria-hidden>
      <path d="M20 120 L80 150 L560 150 L620 110 L540 96 L540 50 L430 50 L430 90 L90 100 Z" fill="#101F30" stroke="#35D0A1" />
      <rect x="470" y="62" width="40" height="18" fill="#4FD1E8" opacity="0.8" />
      <path d="M0 150 C160 130 240 170 400 140 C500 122 560 160 640 140 L640 180 L0 180 Z" fill="#f4b860" opacity="0.35" />
    </svg>
  )
}
