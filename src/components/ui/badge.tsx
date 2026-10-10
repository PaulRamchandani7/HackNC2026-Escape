import { cva, type VariantProps } from 'class-variance-authority'
import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils.ts'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
  {
    variants: {
      variant: {
        default: 'border-ocean/30 text-ocean',
        easy: 'border-signal/40 text-signal',
        medium: 'border-amber/40 text-amber',
        hard: 'border-alarm/40 text-alarm',
        purple: 'border-ocean/40 text-ocean',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
