'use client'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

type DayPoint = {
  date: string
  consumed: number
  protein_g: number
  carbs_g: number
  fat_g: number
  target: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
}

const MACROS = [
  { key: 'protein_g', color: NUTRITION_UI_COLORS.protein },
  { key: 'carbs_g',   color: NUTRITION_UI_COLORS.carbs },
  { key: 'fat_g',     color: NUTRITION_UI_COLORS.fat },
] as const

function getDow(iso: string, dayLabels: string[]): string {
  const [y, m, d] = iso.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dayLabels[(jsDay + 6) % 7]
}

const BAR_H = 56

export default function MacroWeekGrid({ trend }: { trend: DayPoint[] }) {
  const { lang, t } = useClientT()
  const today = new Date().toISOString().slice(0, 10)
  const dayLabels =
    lang === 'es' ? ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    : lang === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/60">
          {t('nutrition.consistency')} · {t('programme.period.7d')}
        </span>
        <div className="flex items-center gap-2">
          {MACROS.map(m => (
            <div key={m.key} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
              <span className="text-[9px] text-white/35 font-bold">
                {m.key === 'protein_g' ? 'P' : m.key === 'carbs_g' ? 'G' : 'L'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5">
        {trend.map(p => {
          const isToday = p.date === today
          const isFuture = p.date > today
          const hasData = p.consumed > 0 && !isFuture

          // How filled vs target (capped at 1)
          const fillRatio = p.target > 0 ? Math.min(1, p.consumed / p.target) : 0

          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
              {/* Stacked macro bar */}
              <div
                className="w-full rounded-lg overflow-hidden flex flex-col justify-end gap-[1px]"
                style={{ height: BAR_H, background: 'rgba(255,255,255,0.04)' }}
              >
                {hasData && MACROS.map(macro => {
                  const val = p[macro.key] as number
                  const kcal = macro.key === 'fat_g' ? val * 9 : val * 4
                  const blockH = p.consumed > 0
                    ? Math.max(2, (kcal / (p.consumed || 1)) * BAR_H * fillRatio)
                    : 0
                  return (
                    <div
                      key={macro.key}
                      style={{ height: blockH, background: macro.color, flexShrink: 0 }}
                    />
                  )
                })}
              </div>

              {/* Kcal label — today in yellow, past with data in white, else dash */}
              <div className={`text-[8px] font-black tabular-nums leading-none ${
                isToday ? 'text-[#f2f2f2]' : hasData ? 'text-white/50' : 'text-white/15'
              }`}>
                {hasData || isToday ? Math.round(p.consumed) : '–'}
              </div>

              {/* Day label */}
              <div className={`text-[9px] font-bold ${isToday ? 'text-[#f2f2f2]' : 'text-white/30'}`}>
                {getDow(p.date, dayLabels)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
