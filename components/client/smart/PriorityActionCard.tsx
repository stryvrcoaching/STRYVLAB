'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

export type { PriorityActionType, PriorityActionCardProps } from '@/lib/client/smart/priorityAction'
export { computePriorityAction } from '@/lib/client/smart/priorityAction'
import type { PriorityActionType, PriorityActionCardProps } from '@/lib/client/smart/priorityAction'

const TYPE_COLOR: Record<PriorityActionType, string> = {
  checkin: '#3b82f6',
  session: '#f2f2f2',
  meal:    NUTRITION_UI_COLORS.carbs,
  water:   NUTRITION_UI_COLORS.water,
  protein: NUTRITION_UI_COLORS.protein,
}

export default function PriorityActionCard({ type, title, subtitle, href, ctaLabel }: PriorityActionCardProps) {
  const color = TYPE_COLOR[type]
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl px-4 py-4 active:scale-[0.99] transition-transform"
      style={{
        background: '#161616',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white leading-tight truncate">{title}</p>
        <p className="text-[11px] text-white/50 mt-0.5">{subtitle}</p>
      </div>
      <div
        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ background: `${color}18`, color }}
      >
        {ctaLabel}
        <ChevronRight size={11} />
      </div>
    </Link>
  )
}
