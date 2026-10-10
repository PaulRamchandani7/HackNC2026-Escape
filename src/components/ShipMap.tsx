import { BedDouble, Compass, Lock, Radio, ShipWheel, Zap } from 'lucide-react'
import type { Challenge } from '../lib/api.ts'

const ICONS = [BedDouble, Zap, Radio, Compass, ShipWheel]
const VB = { w: 1480, h: 720 }

const COMPARTMENTS = [
  { x: 196, y: 176, w: 196, h: 392 },
  { x: 408, y: 164, w: 220, h: 416 },
  { x: 644, y: 164, w: 204, h: 416 },
  { x: 864, y: 170, w: 196, h: 404 },
  { x: 1076, y: 188, w: 172, h: 368 },
]

const CORRIDOR = { y: 346, h: 52 }

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
      <div className="blueprint-sheet relative min-w-[1100px] overflow-hidden rounded-2xl border border-ocean/25 shadow-[0_0_80px_rgba(79,209,232,0.06)]">
        <div className="blueprint-grid pointer-events-none absolute inset-0" />
        <div className="radar pointer-events-none absolute top-4 right-4 h-16 w-16 opacity-80">
          <div className="radar-sweep absolute inset-1 rounded-full" />
        </div>
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="relative h-auto w-full" aria-hidden>
          <Blueprint solvedRooms={solvedRooms} />
        </svg>
        <div className="absolute inset-0">
          {rooms.map((room, index) => {
            const spot = COMPARTMENTS[index]
            if (!spot) return null
            const Icon = ICONS[index] ?? ShipWheel
            const open = unlockedRooms.includes(room.room)
            const solved = solvedRooms.has(room.room)
            const here = current?.room === room.room
            return (
              <button
                key={room.id}
                type="button"
                disabled={!open}
                onClick={() => onSelect(room)}
                style={{
                  left: `${(spot.x / VB.w) * 100}%`,
                  top: `${(spot.y / VB.h) * 100}%`,
                  width: `${(spot.w / VB.w) * 100}%`,
                  height: `${(spot.h / VB.h) * 100}%`,
                }}
                className={`absolute flex items-end rounded-sm border p-2 text-left transition duration-200 ${
                  solved
                    ? 'border-signal/80 bg-signal/10 text-signal shadow-[inset_0_0_36px_rgba(53,208,161,0.2)] enabled:hover:bg-signal/20'
                    : here
                      ? 'room-current border-ocean bg-ocean/10 text-ocean enabled:hover:bg-ocean/20'
                      : 'border-white/10 bg-[#07111c]/60 text-slate-500'
                } ${open ? 'enabled:hover:-translate-y-0.5 enabled:hover:border-ocean' : 'cursor-not-allowed'}`}
              >
                <span className="flex w-full items-center gap-2 rounded-md border border-current/25 bg-[#07111c]/80 px-2 py-1.5 backdrop-blur-sm">
                  {open ? <Icon size={15} /> : <Lock size={15} />}
                  <span className="min-w-0">
                    <span className="block text-[10px] tracking-[0.18em] uppercase">
                      {String(room.room).padStart(2, '0')}
                    </span>
                    <span className="block truncate text-xs font-semibold text-white">{room.name}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Blueprint({ solvedRooms }: { solvedRooms: Set<number> }) {
  const bulkheads = [392, 628, 848, 1060]
  return (
    <>
      <defs>
        <linearGradient id="hull-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#12283a" />
          <stop offset="0.5" stopColor="#0d1c2c" />
          <stop offset="1" stopColor="#101f30" />
        </linearGradient>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 L8 0" stroke="#4FD1E8" strokeOpacity="0.28" />
        </pattern>
        <radialGradient id="bow-glow" cx="0.8" cy="0.5" r="0.35">
          <stop offset="0" stopColor="#F4B860" stopOpacity="0.22" />
          <stop offset="1" stopColor="#F4B860" stopOpacity="0" />
        </radialGradient>
      </defs>

      <text x="36" y="42" fill="#4FD1E8" fontSize="13" letterSpacing="3.5">
        GENERAL ARRANGEMENT — MAIN DECK
      </text>
      <text x="36" y="64" fill="#8aa4b8" fontSize="11" letterSpacing="1.6">
        STERN
      </text>
      <text x="1328" y="64" fill="#8aa4b8" fontSize="11" letterSpacing="1.6">
        BOW
      </text>
      <text x="36" y="88" fill="#F4B860" fontSize="10" letterSpacing="1.4">
        NORTH ATLANTIC · CARGO DECK
      </text>

      <path
        className="hull-wake"
        d="M20 656 Q 120 636 220 656 T 420 656 T 620 656 T 820 656 T 1020 656 T 1220 656 T 1460 656"
        fill="none"
        stroke="#4FD1E8"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <path
        className="hull-wake hull-wake-late"
        d="M20 678 Q 140 700 260 678 T 500 678 T 740 678 T 980 678 T 1220 678 T 1460 678"
        fill="none"
        stroke="#4FD1E8"
        strokeOpacity="0.2"
        strokeWidth="2"
      />

      <path
        d="M78 372 L78 250 Q78 128 210 122 L1260 122 L1442 372 L1260 622 L210 622 Q78 616 78 494 Z"
        fill="url(#hull-fill)"
        stroke="#4FD1E8"
        strokeOpacity="0.7"
        strokeWidth="2"
      />
      <path
        d="M108 372 L108 262 Q108 156 228 150 L1236 150 L1396 372 L1236 594 L228 594 Q108 588 108 482 Z"
        fill="none"
        stroke="#4FD1E8"
        strokeOpacity="0.28"
      />
      <path d="M78 250 Q78 128 210 122 L1260 122 L1442 372 L1260 150 L210 150 Q108 156 108 262 Z" fill="url(#hatch)" opacity="0.45" />
      <path d="M78 494 Q78 616 210 622 L1260 622 L1442 372 L1260 594 L210 594 Q108 588 108 482 Z" fill="url(#hatch)" opacity="0.35" />
      <ellipse className="flicker" cx="1188" cy="372" rx="210" ry="120" fill="url(#bow-glow)" />

      <line x1="150" y1="372" x2="1320" y2="372" stroke="#4FD1E8" strokeOpacity="0.18" strokeDasharray="3 8" />
      {Array.from({ length: 12 }, (_, index) => {
        const x = 180 + index * 100
        return (
          <g key={x} opacity="0.35">
            <line x1={x} y1="132" x2={x} y2="146" stroke="#4FD1E8" />
            <text x={x} y="112" fill="#8aa4b8" fontSize="9" textAnchor="middle">
              {index * 10}
            </text>
          </g>
        )
      })}

      <rect
        x="196"
        y={CORRIDOR.y}
        width="1052"
        height={CORRIDOR.h}
        fill="#10283a"
        stroke="#4FD1E8"
        strokeOpacity="0.25"
      />
      {COMPARTMENTS.slice(0, -1).map((spot, index) => {
        const next = COMPARTMENTS[index + 1]
        if (!next) return null
        const live = solvedRooms.has(index + 1)
        const y = CORRIDOR.y + CORRIDOR.h / 2
        return (
          <line
            key={spot.x}
            x1={spot.x + spot.w - 8}
            y1={y}
            x2={next.x + 8}
            y2={y}
            stroke={live ? '#35D0A1' : '#4FD1E8'}
            strokeOpacity={live ? 0.95 : 0.35}
            strokeWidth={live ? 3 : 2}
            className={live ? 'pulse-line' : undefined}
          />
        )
      })}

      {bulkheads.map((x) => (
        <g key={x} stroke="#4FD1E8" strokeOpacity="0.55">
          <line x1={x} y1="164" x2={x} y2={CORRIDOR.y} />
          <line x1={x} y1={CORRIDOR.y + CORRIDOR.h} x2={x} y2="580" />
        </g>
      ))}

      <CrewDetail />
      <EngineDetail />
      <CommsDetail />
      <NavDetail />
      <BridgeDetail />

      <text x="118" y="250" fill="#8aa4b8" fontSize="10" letterSpacing="1.2">
        STEERING
      </text>
      <text x="1288" y="300" fill="#8aa4b8" fontSize="10" letterSpacing="1.2">
        FOREPEAK
      </text>
    </>
  )
}

function CrewDetail() {
  const bunks = [0, 1, 2, 3]
  return (
    <g fill="none" stroke="#4FD1E8">
      {bunks.map((bunk) => (
        <rect
          key={`up-${bunk}`}
          x={214 + (bunk % 2) * 78}
          y={198 + Math.floor(bunk / 2) * 32}
          width="62"
          height="20"
          rx="2"
          strokeOpacity="0.35"
        />
      ))}
      {bunks.map((bunk) => (
        <rect
          key={`down-${bunk}`}
          x={214 + (bunk % 2) * 78}
          y={430 + Math.floor(bunk / 2) * 32}
          width="62"
          height="20"
          rx="2"
          strokeOpacity="0.28"
        />
      ))}
      <text x="214" y="328" fill="#8aa4b8" stroke="none" fontSize="10" letterSpacing="1.4">
        CABINS
      </text>
    </g>
  )
}

function EngineDetail() {
  return (
    <g stroke="#4FD1E8" fill="none" strokeOpacity="0.4">
      <circle cx="470" cy="250" r="28" />
      <circle cx="548" cy="250" r="28" />
      <circle cx="470" cy="250" r="8" />
      <circle cx="548" cy="250" r="8" />
      <rect x="436" y="500" width="150" height="46" rx="4" />
      <line x1="436" y1="516" x2="586" y2="516" />
      <line x1="470" y1="278" x2="470" y2="346" />
      <line x1="548" y1="278" x2="548" y2="346" />
      <text x="436" y="318" fill="#8aa4b8" fontSize="10" letterSpacing="1.4">
        GENERATORS
      </text>
    </g>
  )
}

function CommsDetail() {
  return (
    <g stroke="#4FD1E8" fill="none" strokeOpacity="0.4">
      <rect x="668" y="196" width="150" height="36" rx="3" />
      <line x1="700" y1="196" x2="700" y2="150" />
      <circle cx="700" cy="146" r="8" />
      <path d="M684 132 Q700 118 716 132" />
      <path d="M674 122 Q700 100 726 122" strokeOpacity="0.25" />
      <rect x="668" y="500" width="70" height="40" />
      <rect x="748" y="500" width="70" height="40" />
      <text x="668" y="320" fill="#8aa4b8" fontSize="10" letterSpacing="1.4">
        RADIO
      </text>
    </g>
  )
}

function NavDetail() {
  return (
    <g stroke="#4FD1E8" fill="none" strokeOpacity="0.4">
      <rect x="888" y="196" width="148" height="90" />
      <line x1="888" y1="218" x2="1036" y2="218" strokeOpacity="0.25" />
      <line x1="888" y1="240" x2="1036" y2="240" strokeOpacity="0.25" />
      <line x1="925" y1="196" x2="925" y2="286" strokeOpacity="0.25" />
      <line x1="980" y1="196" x2="980" y2="286" strokeOpacity="0.25" />
      <circle cx="962" cy="530" r="26" />
      <line x1="962" y1="508" x2="962" y2="552" />
      <line x1="940" y1="530" x2="984" y2="530" />
      <text x="888" y="320" fill="#8aa4b8" fontSize="10" letterSpacing="1.4">
        CHARTS
      </text>
    </g>
  )
}

function BridgeDetail() {
  return (
    <g>
      {Array.from({ length: 5 }, (_, index) => (
        <rect
          key={index}
          className={index === 2 ? 'flicker' : undefined}
          x={1094 + index * 26}
          y="214"
          width="16"
          height="22"
          fill={index === 2 ? '#F4B860' : 'none'}
          stroke="#F4B860"
          strokeOpacity="0.8"
        />
      ))}
      <circle cx="1162" cy="470" r="22" fill="none" stroke="#4FD1E8" strokeOpacity="0.55" />
      <circle cx="1162" cy="470" r="6" fill="none" stroke="#4FD1E8" strokeOpacity="0.55" />
      <line x1="1162" y1="448" x2="1162" y2="492" stroke="#4FD1E8" strokeOpacity="0.4" />
      <line x1="1140" y1="470" x2="1184" y2="470" stroke="#4FD1E8" strokeOpacity="0.4" />
      <text x="1094" y="330" fill="#F4B860" fontSize="10" letterSpacing="1.4">
        HELM
      </text>
    </g>
  )
}

export function shipSystems(solvedRooms: number[]) {
  const has = (room: number) => solvedRooms.includes(room)
  return [
    {
      name: 'Power',
      state: has(2) ? 'Auxiliary power online' : 'Power offline',
      on: has(2),
      progress: has(2) ? 1 : 0,
    },
    {
      name: 'Communications',
      state: has(3) ? 'Distress signal transmitted' : 'Radio silent',
      on: has(3),
      progress: has(3) ? 1 : 0,
    },
    {
      name: 'Navigation',
      state: has(4) ? 'Safe course plotted' : 'Navigation offline',
      on: has(4),
      progress: has(4) ? 1 : 0,
    },
    {
      name: 'Bridge Access',
      state: has(5) ? 'Helm restored' : has(4) ? 'Bridge access authorized' : 'Bridge access denied',
      on: has(4),
      progress: has(5) ? 1 : has(4) ? 0.6 : 0,
    },
  ]
}
