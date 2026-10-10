import { BedDouble, Compass, Lock, Radio, ShipWheel, Zap } from 'lucide-react'
import type { Challenge } from '../lib/api.ts'

const ICONS = [BedDouble, Zap, Radio, Compass, ShipWheel]

export function ShipMap({
  rooms,
  unlockedRooms,
  solvedIds,
  onSelect,
}: {
  rooms: Challenge[]
  unlockedRooms: number[]
  solvedIds: string[]
  onSelect: (room: Challenge) => void
}) {
  const solvedRooms = new Set(rooms.filter((room) => solvedIds.includes(room.id)).map((room) => room.room))
  const current = rooms.find((room) => unlockedRooms.includes(room.room) && !solvedRooms.has(room.room))

  return (
    <div className="overflow-x-auto">
      <div className="relative min-w-[760px]">
      <svg viewBox="0 0 980 280" className="h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="hull" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#172A3D" />
            <stop offset="1" stopColor="#0c1a28" />
          </linearGradient>
        </defs>
        <path
          d="M70 168 L120 230 L860 230 L930 150 L820 132 L820 78 L690 78 L690 128 L150 140 Z"
          fill="url(#hull)"
          stroke="#4FD1E8"
          strokeOpacity="0.45"
        />
        <path d="M820 78 L900 78 L900 132 L820 132 Z" fill="#101F30" stroke="#F4B860" strokeOpacity="0.7" />
        <rect className="flicker" x="846" y="92" width="18" height="12" fill="#F4B860" opacity="0.8" />
        {rooms.slice(0, -1).map((room, index) => {
          const next = rooms[index + 1]
          if (!next) return null
          const a = position(index)
          const b = position(index + 1)
          const live = solvedRooms.has(room.room)
          return (
            <line
              key={`${room.room}-${next.room}`}
              x1={a.x}
              y1={a.y + 18}
              x2={b.x}
              y2={b.y + 18}
              stroke={live ? '#35D0A1' : '#4FD1E8'}
              strokeOpacity={live ? 0.9 : 0.25}
              strokeWidth="2"
              className={live ? 'pulse-line' : undefined}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0">
        {rooms.map((room, index) => {
          const Icon = ICONS[index] ?? ShipWheel
          const open = unlockedRooms.includes(room.room)
          const solved = solvedRooms.has(room.room)
          const here = current?.room === room.room
          const spot = position(index)
          return (
            <button
              key={room.id}
              type="button"
              disabled={!open}
              onClick={() => onSelect(room)}
              style={{ left: `${(spot.x / 980) * 100}%`, top: `${(spot.y / 280) * 100}%` }}
              className={`absolute w-[6.6rem] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2 py-1.5 text-left text-[11px] leading-tight transition ${
                solved
                  ? 'restore-flash border-signal/70 bg-signal/10 text-signal'
                  : here
                    ? 'border-ocean bg-ocean/15 text-ocean shadow-[0_0_24px_rgba(79,209,232,0.35)]'
                    : 'border-white/10 bg-navy/80 text-slate-400'
              } ${open ? 'hover:border-ocean' : 'cursor-not-allowed opacity-60'}`}
            >
              <span className="flex items-center gap-2 text-xs tracking-widest uppercase">
                {solved ? <Icon size={14} /> : open ? <Icon size={14} /> : <Lock size={14} />}
                {String(room.room).padStart(2, '0')}
              </span>
              <span className="mt-1 block text-[11px] font-semibold text-white">{room.name}</span>
            </button>
          )
        })}
      </div>
      </div>
    </div>
  )
}

function position(index: number) {
  const spots = [
    { x: 190, y: 186 },
    { x: 350, y: 186 },
    { x: 510, y: 176 },
    { x: 670, y: 166 },
    { x: 860, y: 108 },
  ]
  return spots[index] ?? spots[0]
}

export function shipSystems(solvedRooms: number[]) {
  const has = (room: number) => solvedRooms.includes(room)
  return [
    {
      name: 'Power',
      state: has(2) ? 'Auxiliary power online' : 'Power offline',
      on: has(2),
    },
    {
      name: 'Communications',
      state: has(3) ? 'Distress signal transmitted' : 'Radio silent',
      on: has(3),
    },
    {
      name: 'Navigation',
      state: has(4) ? 'Safe course plotted' : 'Navigation offline',
      on: has(4),
    },
    {
      name: 'Bridge Access',
      state: has(5) ? 'Helm restored' : has(4) ? 'Bridge access authorized' : 'Bridge access denied',
      on: has(4),
    },
  ]
}
