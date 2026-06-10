import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

type Point = { date: string; consumed: number; target: number }

export default function WeeklyTrendStrip({ trend }: { trend: Point[] }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">
        7 derniers jours
      </div>
      <div className="flex items-end gap-2 h-[60px]">
        {trend.map(p => {
          const ratio = p.target > 0 ? Math.min(1, p.consumed / p.target) : 0
          const barH = Math.max(2, ratio * 56)
          const future = p.date > today
          const color = future
            ? 'rgba(255,255,255,0.08)'
            : ratio > 0.85 ? NUTRITION_UI_COLORS.carbs : ratio > 0.6 ? '#f2f2f2' : '#ef4444'
          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md" style={{ height: `${barH}px`, background: color }} />
              <div className="text-[9px] text-white/40">{p.date.slice(8, 10)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
