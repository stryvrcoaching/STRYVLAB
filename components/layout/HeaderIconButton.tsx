'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export default function HeaderIconButton({
  icon,
  label,
  active = false,
  variant = 'neutral',
  className = '',
  ...props
}: {
  icon: ReactNode
  label: string
  active?: boolean
  variant?: 'neutral' | 'accent'
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass =
    variant === 'accent'
      ? 'bg-[#1f8a65] text-white hover:bg-[#217356]'
      : active
        ? 'bg-[#1f8a65]/12 text-[#7fe2bf] hover:bg-[#1f8a65]/18'
        : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white/85'

  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] transition-all active:scale-[0.98] disabled:opacity-50 ${variantClass} ${className}`}
          {...props}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="rounded-xl border border-white/[0.06] bg-[#0f0f0f] px-2.5 py-1.5 text-[11px] font-medium text-white/80"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
