import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const VARIANTS = {
  default: 'bg-panel-2 text-text-dim border-border',
  accent: 'bg-accent/10 text-accent border-accent/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
} as const

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTS
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  )
}

export function windSpeedVariant(kt: number | null | undefined): keyof typeof VARIANTS {
  if (kt == null) return 'default'
  if (kt >= 113) return 'danger'
  if (kt >= 64) return 'warn'
  if (kt >= 34) return 'accent'
  return 'default'
}
