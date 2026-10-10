import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShipMap, shipSystems } from '../components/ShipMap.tsx'
import { VoyageBar } from '../components/VoyageBar.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card } from '../components/ui/card.tsx'
import { api, type Challenge, type Mission } from '../lib/api.ts'
import { loadMissionId, loadPlayer, saveMissionId } from '../lib/player.ts'

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
      <div className="mx-auto w-[min(1100px,calc(100%-1.5rem))] py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.22em] text-ocean uppercase">Deck plan</p>
            <h1 className="display mt-2 text-4xl text-white">The drifting hull</h1>
          </div>
          <Button variant="outline" onClick={restart}>
            Restart Journey
          </Button>
        </div>
        {notice ? <p className="mt-4 text-sm text-amber">{notice}</p> : null}
        {error ? <p className="mt-4 text-sm text-alarm">{error}</p> : null}
        <div className="mt-6" data-restored={solvedRooms.length}>
          <ShipMap
            rooms={mission.rooms}
            unlockedRooms={mission.unlockedRooms}
            solvedIds={mission.solvedChallengeIds}
            onSelect={openRoom}
          />
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {systems.map((system) => (
            <Card key={system.name} className={system.on ? 'border-signal/40' : ''}>
              <p className="text-xs tracking-[0.18em] text-slate-400 uppercase">{system.name}</p>
              <p className={`mt-2 text-sm ${system.on ? 'text-signal' : 'text-slate-300'}`}>{system.state}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
