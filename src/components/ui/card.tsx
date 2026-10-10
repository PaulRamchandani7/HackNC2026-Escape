import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils.ts'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ocean/15 bg-slatecard/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
      {...props}
    />
  )
}
