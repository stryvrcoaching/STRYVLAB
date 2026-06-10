'use client'

import { cn } from '@/lib/utils'

export type DashboardView = 'kanban' | 'agenda' | null

const VIEWS: { id: 'kanban' | 'agenda'; label: string }[] = [
  { id: 'kanban', label: 'Kanban' },
  { id: 'agenda', label: 'Agenda' },
]

export default function DashboardSubNav({
  active,
  onChange,
}: {
  active: DashboardView
  onChange: (v: DashboardView) => void
}) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {VIEWS.map(v => (
        <button
          key={v.id}
          onClick={() => onChange(active === v.id ? null : v.id)}
          className={cn(
            'px-3 h-7 rounded-lg text-[11px] font-semibold transition-all duration-150',
            active === v.id
              ? 'bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30'
              : 'bg-white/[0.03] border-[0.3px] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white/80',
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
