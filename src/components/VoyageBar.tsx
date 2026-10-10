import { Link } from 'react-router-dom'
import { formatDuration } from '../lib/player.ts'

export function VoyageBar({
  elapsedMs,
  label,
}: {
  elapsedMs?: number
  label?: string
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-ocean/10 px-5 py-3">
      <Link to="/ship" className="display text-lg tracking-wide text-white">
        CODE: ADRIFT
      </Link>
      <div className="flex items-center gap-4 text-xs tracking-[0.16em] text-ocean/80 uppercase">
        {label ? <span>{label}</span> : null}
        {elapsedMs != null ? (
          <span className="font-mono text-sm tracking-normal text-amber">{formatDuration(elapsedMs)}</span>
        ) : null}
      </div>
    </header>
  )
}
