'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import QuickWaterModal from '../QuickWaterModal'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { getNutritionProgressMeta, type NutritionProgressState } from '@/lib/nutrition/progress'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

export type NutritionMacros = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
  caffeine_mg?: number
}

export type SmartNutritionWidgetProps = {
  consumed: NutritionMacros
  target: NutritionMacros
  proteinStreakDays?: number
}

function formatOverflow(value: number, unit: 'g' | 'L'): string | null {
  if (value <= 0) return null
  return unit === 'L'
    ? `+${value.toFixed(1)} ${unit} au-dessus`
    : `+${Math.round(value)}${unit} au-dessus`
}

export default function SmartNutritionWidget({ consumed, target, proteinStreakDays }: SmartNutritionWidgetProps) {
  const { t } = useClientT()
  const MACROS = [
    { key: 'protein_g' as const, label: t('smart.nutrition.protein'), color: NUTRITION_UI_COLORS.protein },
    { key: 'carbs_g'   as const, label: t('smart.nutrition.carbs'),   color: NUTRITION_UI_COLORS.carbs },
    { key: 'fat_g'     as const, label: t('smart.nutrition.fat'),     color: NUTRITION_UI_COLORS.fat },
  ]
  const [waterOpen, setWaterOpen] = useState(false)
  const [waterDelta, setWaterDelta] = useState(0)
  const effectiveWaterMl = consumed.water_ml + waterDelta

  function getStateColor(_state: NutritionProgressState, baseColor: string): string {
    return baseColor
  }

  const kcalMeta = getNutritionProgressMeta(consumed.kcal, target.kcal)
  const waterMeta = getNutritionProgressMeta(effectiveWaterMl, target.water_ml)
  const waterStatusLabel = effectiveWaterMl >= target.water_ml
    ? effectiveWaterMl > target.water_ml
      ? t('nutrition.hero.goalExceeded')
      : t('nutrition.hero.goalReached')
    : null
  const kcalPct = Math.min(kcalMeta.ratio, 1)
  const r = 80
  const arcTotal = Math.PI * r
  const arcOffset = arcTotal * (1 - kcalPct)
  const kcalStroke = NUTRITION_UI_COLORS.calories

  return (
    <>
      <QuickWaterModal
        open={waterOpen}
        onClose={() => setWaterOpen(false)}
        onLogged={ml => setWaterDelta(d => d + ml)}
        onDeleted={ml => setWaterDelta(d => d - ml)}
      />
      <Link
        href="/client/nutrition"
        className="block bg-[#111111] rounded-2xl p-5 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30">{t('smart.nutrition.label')}</span>
          <span className="text-[10px] font-semibold text-[#f2f2f2]">→</span>
        </div>

        {/* Arc demi-cercle */}
        <div className="relative" style={{ height: 110 }}>
          <svg viewBox="0 0 200 110" className="w-full h-full">
            <path
              d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={12}
              strokeLinecap="round"
            />
            <path
              d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`}
              fill="none"
              stroke={kcalStroke}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={arcTotal}
              strokeDashoffset={arcOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <div className="font-black leading-none text-white tabular-nums text-[28px]">
              {Math.round(consumed.kcal)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.12em] text-white/35 mt-1">{t('smart.nutrition.caloriesConsumed')}</div>
            <div className="text-[10px] text-white/50 tabular-nums">/ {target.kcal} kcal</div>
          </div>
        </div>

        {/* Barres macros */}
        <div className="flex flex-col gap-2 mt-3">
          {MACROS.map(m => {
            const c = (consumed[m.key] as number) ?? 0
            const tg = (target[m.key] as number) ?? 0
            const meta = getNutritionProgressMeta(c, tg)
            const fillColor = m.color
            const statusLabel = c > tg
              ? t('nutrition.hero.goalExceeded')
              : c >= tg
                ? t('nutrition.hero.goalReached')
                : null
            return (
              <div key={m.key}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/50 uppercase tracking-[0.1em] font-bold">{m.label}</span>
                  <span className="font-bold tabular-nums" style={{ color: fillColor }}>
                    {Math.round(c)}/{tg}g
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${meta.clampedPercent}%`,
                      background: fillColor,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div className="mt-1 min-h-[14px] text-[9px] font-medium tabular-nums text-white/40">
                  {statusLabel ?? '\u00A0'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Eau */}
        <div className="flex items-center gap-3 mt-4 pt-3">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[10px] font-bold tracking-[0.1em] text-white/50" style={{ color: NUTRITION_UI_COLORS.water }}>
                {t('smart.nutrition.hydration')}
              </span>
              <span className="text-white font-bold tabular-nums">
                {(effectiveWaterMl / 1000).toFixed(1)} / {(target.water_ml / 1000).toFixed(1)} L
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${waterMeta.clampedPercent}%`,
                  background: NUTRITION_UI_COLORS.water,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div className="mt-1 min-h-[14px] text-[9px] font-medium tabular-nums text-white/40">
              {waterStatusLabel ?? '\u00A0'}
            </div>
          </div>
          <button
            onClick={e => { e.preventDefault(); setWaterOpen(true) }}
            className="w-9 h-9 rounded-xl bg-[#f2f2f2] flex items-center justify-center text-[#080808] active:scale-95 transition-transform shrink-0"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>

        {consumed.caffeine_mg != null && consumed.caffeine_mg > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-[10px]">
            <span className="text-white/40 uppercase tracking-[0.1em] font-bold">{t('smart.nutrition.caffeine')}</span>
            <span className="text-white font-bold tabular-nums">{Math.round(consumed.caffeine_mg)} mg</span>
          </div>
        )}

        {/* Régularité protéines */}
        {proteinStreakDays !== undefined && target.protein_g > 0 && (
          <div className="mt-3 pt-3">
            <div className="flex justify-between text-[10px] mb-1.5">
              <span className="text-white/40 uppercase tracking-[0.1em] font-bold">{t('nutrition.consistency')}</span>
              <span className="text-white/60 tabular-nums font-bold">{proteinStreakDays}/7{t('feedback.time.d')}</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#f2f2f2]"
                style={{ width: `${(proteinStreakDays / 7) * 100}%`, transition: 'width 0.6s ease' }}
              />
            </div>
          </div>
        )}
      </Link>
    </>
  )
}
