import { Compass, Radio, ShipWheel, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShipMap, shipSystems } from '../components/ShipMap.tsx'
import { VoyageBar } from '../components/VoyageBar.tsx'
import { Button } from '../components/ui/button.tsx'
import { api, type Challenge, type Mission } from '../lib/api.ts'
import { loadMissionId, loadPlayer, saveMissionId } from '../lib/player.ts'

const SYSTEM_ICONS = [Zap, Radio, Compass, ShipWheel]

export function Ship() {
  const navigate = useNavigate()
  const [mission, setMission] = useState<Mission | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const player = loadPlayer()
    const id = loadMissionId()
    if (!player || !id) {
      navigate('/')
      return
    }
    api
      .getMission(id)
      .then((next) => {
        if (next.status === 'completed') navigate('/finale')
        else setMission(next)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Deck plan unavailable'))
  }, [navigate])

  async function restart() {
    const player = loadPlayer()
    if (!player) return
    setError('')
    try {
      const next = await api.startMission(player.id, true)
      saveMissionId(next.id)
      setMission(next)
      setNotice('A new diagnostic sequence has been assigned.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed')
    }
  }

  function openRoom(room: Challenge) {
    if (!mission?.unlockedRooms.includes(room.room)) {
      setNotice('That compartment is still sealed.')
      return
    }
    navigate(`/room/${room.room}`)
  }

  if (!mission) {
    return (
      <main className="ocean-stage grid min-h-svh place-items-center text-slate-300">
        {error || 'Plotting the deck…'}
      </main>
    )
  }

  const solvedRooms = mission.rooms
    .filter((room) => mission.solvedChallengeIds.includes(room.id))
    .map((room) => room.room)
  const systems = shipSystems(solvedRooms)
  const elapsed = mission.status === 'completed' && mission.escape_ms != null
    ? mission.escape_ms
    : Math.max(0, now - mission.started_at)

  return (
    <main className="ocean-stage min-h-svh">
      <VoyageBar elapsedMs={elapsed} label={`${solvedRooms.length} of 5 ship systems restored`} />
      <div className="mx-auto w-[min(1480px,calc(100%-1rem))] py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.22em] text-ocean uppercase">Deck plan</p>
            <h1 className="display mt-1 text-4xl text-white">The drifting hull</h1>
          </div>
          <Button variant="outline" onClick={restart}>
            Restart Journey
          </Button>
        </div>
        {notice ? <p className="mt-3 text-sm text-amber">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}
        <div className="mt-3" data-restored={solvedRooms.length}>
          <ShipMap
            rooms={mission.rooms}
            unlockedRooms={mission.unlockedRooms}
            solvedIds={mission.solvedChallengeIds}
            onSelect={openRoom}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {systems.map((system, index) => {
            const Icon = SYSTEM_ICONS[index] ?? Zap
            const full = system.progress === 1
            return (
              <article
                key={system.name}
                className={`rounded-2xl border bg-slatecard/90 p-4 transition duration-200 hover:-translate-y-0.5 ${
                  system.on
                    ? 'border-signal/45 shadow-[0_0_28px_rgba(53,208,161,0.12)]'
                    : 'border-ocean/15 hover:border-ocean/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg border ${
                      system.on ? 'border-signal/40 text-signal' : 'border-ocean/20 text-ocean/70'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="text-[10px] tracking-[0.18em] text-slate-400 uppercase">
                    {full ? 'Restored' : system.on ? 'Partial' : 'Offline'}
                  </span>
                </div>
                <p className="mt-3 text-xs tracking-[0.18em] text-slate-400 uppercase">{system.name}</p>
                <p className={`mt-1 text-sm ${system.on ? 'text-signal' : 'text-slate-300'}`}>{system.state}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${full ? 'bg-signal' : 'bg-ocean'}`}
                    style={{ width: `${Math.round(system.progress * 100)}%` }}
                  />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
