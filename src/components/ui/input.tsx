import { type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils.ts'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-cyan-200/20 bg-[#0c1018] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/60',
        className,
      )}
      {...props}
    />
  )
}
