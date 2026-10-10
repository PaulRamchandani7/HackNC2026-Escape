import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils.ts'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ocean text-navy shadow-[0_0_24px_rgba(79,209,232,0.28)] hover:bg-[#8be7f4]',
        amber: 'bg-amber text-navy hover:bg-[#ffd18a]',
        outline: 'border border-ocean/30 bg-transparent text-slate-100 hover:bg-ocean/10',
        ghost: 'text-slate-200 hover:bg-white/5',
      },
      size: {
        default: 'h-10 px-4',
        lg: 'h-12 px-7 text-base',
        sm: 'h-8 px-3 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
