import { Anchor } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button.tsx'
import { api, type Mission } from '../lib/api.ts'
import { loadMissionId, loadPlayer } from '../lib/player.ts'

export function Landing() {
  const navigate = useNavigate()
  const [guide, setGuide] = useState(false)
  const [saved, setSaved] = useState<Mission | null>(null)

  useEffect(() => {
    const id = loadMissionId()
    const player = loadPlayer()
    if (!id || !player) return
    api
      .getMission(id)
      .then((mission) => {
        if (mission.player_id === player.id && mission.rooms.length === 5) setSaved(mission)
      })
      .catch(() => setSaved(null))
  }, [])

  return (
    <main className="ocean-stage relative min-h-svh overflow-hidden">
      <div className="rain absolute inset-0 opacity-40" />
      <div className="relative z-10 mx-auto grid min-h-svh w-[min(1120px,calc(100%-2rem))] items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="flex items-center gap-2 text-xs tracking-[0.28em] text-amber uppercase">
            <Anchor size={14} /> North Atlantic · 03:17
          </p>
          <h1 className="display mt-4 text-6xl text-white sm:text-7xl">CODE: ADRIFT</h1>
          <p className="mt-4 max-w-xl text-xl text-ocean">
            Lost at sea. Trapped aboard. Code your way home.
          </p>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
            You wake up alone on a drifting ship. Its systems are failing, its doors are locked,
            and a storm is closing in. The only way to survive is to restore the ship&apos;s
            systems—one line of code at a time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate('/intro')}>
              Begin Your Escape
            </Button>
            <Button size="lg" variant="outline" onClick={() => setGuide(true)}>
              How to Play
            </Button>
            {saved?.status === 'active' ? (
              <Button size="lg" variant="amber" onClick={() => navigate('/ship')}>
                Continue Journey
              </Button>
            ) : null}
            {saved?.status === 'completed' ? (
              <Button asChild size="lg" variant="amber">
                <Link to="/finale">Review Your Escape</Link>
              </Button>
            ) : null}
          </div>
        </div>
        <HeroShip />
      </div>
      <div className="waves absolute inset-x-0 bottom-0">
        <span />
        <span />
        <span />
      </div>
      {guide ? <HowTo onClose={() => setGuide(false)} /> : null}
    </main>
  )
}

function HeroShip() {
  return (
    <div className="relative">
      <div className="radar absolute top-2 right-4 h-24 w-24">
        <div className="radar-sweep absolute inset-1 rounded-full" />
      </div>
      <svg viewBox="0 0 640 420" className="h-auto w-full" role="img" aria-label="Abandoned cargo ship in a storm">
        <rect width="640" height="420" fill="#07111C" />
        <path d="M0 250 C120 230 200 280 320 250 C460 214 520 290 640 240 L640 420 L0 420 Z" fill="#0c1c2c" />
        <path d="M40 250 L90 310 L520 310 L590 230 L500 214 L500 150 L390 150 L390 200 L120 214 Z" fill="#101F30" stroke="#4FD1E8" strokeOpacity="0.5" />
        <path d="M500 150 L560 150 L560 214 L500 214 Z" fill="#172A3D" stroke="#F4B860" strokeOpacity="0.8" />
        <rect className="flicker" x="518" y="168" width="22" height="14" fill="#F4B860" />
        <rect x="160" y="230" width="28" height="16" fill="#4FD1E8" opacity="0.25" />
        <rect x="230" y="230" width="28" height="16" fill="#4FD1E8" opacity="0.15" />
        <rect x="300" y="230" width="28" height="16" fill="#4FD1E8" opacity="0.1" />
        <path d="M70 120 C140 80 180 150 250 100" fill="none" stroke="#d7e4ef" strokeOpacity="0.15" />
        <path d="M300 90 C380 40 430 120 520 70" fill="none" stroke="#d7e4ef" strokeOpacity="0.12" />
      </svg>
    </div>
  )
}

function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-navy/80 p-4">
      <div className="w-[min(640px,100%)] rounded-2xl border border-ocean/20 bg-steel p-6">
        <h2 className="display text-3xl text-white">How to play</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <li>Wake up aboard the drifting cargo ship and follow the emergency broadcast.</li>
          <li>Open the only available compartment on the deck plan.</li>
          <li>Each terminal is a real LeetCode problem. The brief and tests are original. The title and link come from LeetCode.</li>
          <li>Run checks the samples. Submit runs hidden tests on the server. A room opens only after that verdict is accepted.</li>
          <li>Restore five systems — quarters, engines, radio, navigation, and the bridge — before the storm takes the ship.</li>
        </ol>
        <Button className="mt-6" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
