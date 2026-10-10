import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button.tsx'
import { api } from '../lib/api.ts'
import { loadPlayer, saveMissionId, savePlayer } from '../lib/player.ts'

const SCENES = [
  {
    kicker: '03:17 AM — NORTH ATLANTIC OCEAN',
    lines: ['You open your eyes.', 'The floor beneath you rocks violently.', "You don't remember boarding this ship."],
    tone: 'void',
  },
  {
    kicker: 'CREW CABIN',
    lines: ['The crew is gone.', 'The emergency lights are barely functioning.', "Every door is sealed by the ship's automated security system."],
    tone: 'cabin',
  },
  {
    kicker: 'EMERGENCY PROTOCOL ACTIVE',
    lines: ['Navigation offline.', 'Engine controls restricted.', 'Bridge access denied.', 'Manual recovery requires successful completion of system diagnostics.'],
    tone: 'terminal',
  },
  {
    kicker: 'MISSION: REACH THE BRIDGE',
    lines: ["Restore the ship's systems, unlock each compartment, and regain control before the storm overtakes the vessel."],
    tone: 'mission',
  },
] as const

export function Intro() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scene = SCENES[index] ?? SCENES[0]

  async function enterShip() {
    setBusy(true)
    setError('')
    try {
      let player = loadPlayer()
      if (!player) {
        player = await api.createPlayer()
        savePlayer(player)
      }
      const mission = await api.startMission(player.id)
      saveMissionId(mission.id)
      navigate('/ship')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The terminal failed to boot')
      setBusy(false)
    }
  }

  return (
    <main className={`relative min-h-svh overflow-hidden ${scene.tone === 'void' ? 'bg-black' : 'ocean-stage'}`}>
      {scene.tone !== 'void' ? <div className="rain absolute inset-0 opacity-30" /> : null}
      <div className="relative z-10 mx-auto flex min-h-svh w-[min(760px,calc(100%-2rem))] flex-col justify-center">
        <button
          type="button"
          className="absolute top-6 right-0 text-xs tracking-[0.2em] text-slate-400 uppercase"
          onClick={() => setIndex(SCENES.length - 1)}
        >
          Skip intro
        </button>
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.kicker}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
          >
            <p className={`text-xs tracking-[0.24em] uppercase ${scene.tone === 'terminal' ? 'text-amber' : 'text-ocean'}`}>
              {scene.kicker}
            </p>
            <div className="mt-6 space-y-4">
              {scene.lines.map((line) => (
                <p key={line} className="display text-3xl leading-snug text-white sm:text-4xl">
                  {line}
                </p>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-10 flex flex-wrap gap-3">
          {index < SCENES.length - 1 ? (
            <Button onClick={() => setIndex((value) => value + 1)}>Continue</Button>
          ) : (
            <Button disabled={busy} onClick={enterShip}>
              {busy ? 'Opening the hatch…' : 'Enter the First Room'}
            </Button>
          )}
        </div>
        {error ? <p className="mt-4 text-alarm">{error}</p> : null}
      </div>
    </main>
  )
}
