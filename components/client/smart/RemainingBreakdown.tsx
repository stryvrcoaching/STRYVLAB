'use client'

import type { NutritionMacros } from './SmartNutritionWidget'
import { computeNutritionBalance } from '@/lib/nutrition/balance'
import { computeActionableRemaining } from '@/lib/nutrition/actionable-remaining'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useClientT } from '../ClientI18nProvider'

type DeltaCard = {
  key: 'protein' | 'carbs' | 'fat'
  label: string
  shortLabel: string
  remaining: number
  overflow: number
  target: number
  unit: 'g' | 'kcal'
  accent: string
}

function formatValue(value: number, unit: 'g' | 'kcal'): string {
  return unit === 'kcal' ? `${Math.round(value)}` : `${Math.round(value)}`
}

function formatOverflowValue(value: number, unit: 'g' | 'kcal'): string {
  return unit === 'kcal' ? `${Math.round(value)} kcal` : `${Math.round(value)}g`
}

function RemainingSquircleGauge({
  label,
  valueText,
  progress,
  color,
  helper,
}: {
  label: string
  valueText: string
  progress: number
  color: string
  helper: string
}) {
  const size = 58
  const stroke = 4.5
  const inset = stroke / 2
  const pathSize = size - stroke
  const radius = 18
  const path = `
    M ${inset + radius} ${inset}
    H ${inset + pathSize - radius}
    Q ${inset + pathSize} ${inset} ${inset + pathSize} ${inset + radius}
    V ${inset + pathSize - radius}
    Q ${inset + pathSize} ${inset + pathSize} ${inset + pathSize - radius} ${inset + pathSize}
    H ${inset + radius}
    Q ${inset} ${inset + pathSize} ${inset} ${inset + pathSize - radius}
    V ${inset + radius}
    Q ${inset} ${inset} ${inset + radius} ${inset}
  `.replace(/\s+/g, ' ').trim()
  const pathLength = 4 * (pathSize - 2 * radius) + 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(progress, 1))
  const dashOffset = pathLength * (1 - clamped)

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative h-[58px] w-[58px]">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[13px] font-black leading-none tracking-[-0.03em] text-white">{valueText}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] font-semibold text-white/84">{label}</p>
      <p className="mt-0.5 text-center text-[8px] font-semibold uppercase tracking-[0.1em] text-white/32">{helper}</p>
    </div>
  )
}

function buildHeadline(cards: DeltaCard[], remainingCaloriesNet: number, t: (key: any) => string): string {
  const activeRemaining = cards.filter(card => card.remaining > 0)
  const activeOverflow = cards.filter(card => card.overflow > 0)

  if (activeOverflow.length === 0 && activeRemaining.length === 0 && remainingCaloriesNet <= 0) {
    return t("nutrition.goals.reached")
  }

  if (activeOverflow.length > 0) {
    const names = activeOverflow.map(card => card.shortLabel.toLowerCase()).join(", ")
    return t("nutrition.overflow.msg").replace("{names}", names)
  }

  const primary = activeRemaining.sort((a, b) => b.remaining - a.remaining)[0]
  if (!primary) {
    return remainingCaloriesNet > 0
      ? t("nutrition.calories.available").replace("{n}", String(Math.round(remainingCaloriesNet)))
      : t("nutrition.day.calibrated")
  }

  return t("nutrition.macro.priority").replace("{macro}", primary.label)
}

export default function RemainingBreakdown({
  consumed,
  target,
  gender,
  bodyWeightKg,
}: {
  consumed: NutritionMacros
  target: NutritionMacros
  gender?: string | null
  bodyWeightKg?: number | null
}) {
  const { t } = useClientT()
  const informativeBalance = computeNutritionBalance(consumed, target)
  const actionable = computeActionableRemaining({
    target,
    consumed,
    profile: { gender, weightKg: bodyWeightKg },
  })
  const { remainingCaloriesFromMacros } = informativeBalance
  const remaining = {
    calories: Math.max(0, actionable.actionableRemaining.calories),
    protein_g: actionable.actionableRemaining.protein,
    carbs_g: actionable.actionableRemaining.carbs,
    fat_g: actionable.actionableRemaining.fat,
  }
  const overflow = {
    calories: Math.max(0, consumed.kcal - target.kcal),
    protein_g: actionable.overflow.protein_g,
    carbs_g: actionable.overflow.carbs_g,
    fat_g: actionable.overflow.fat_g,
  }
  const cards: DeltaCard[] = [
    {
      key: 'protein',
      label: t('nutrition.protein'),
      shortLabel: t('nutrition.protein'),
      remaining: remaining.protein_g,
      overflow: overflow.protein_g,
      target: target.protein_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.protein,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs'),
      shortLabel: t('nutrition.carbs'),
      remaining: remaining.carbs_g,
      overflow: overflow.carbs_g,
      target: target.carbs_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.carbs,
    },
    {
      key: 'fat',
      label: t('nutrition.fat'),
      shortLabel: t('nutrition.fat'),
      remaining: remaining.fat_g,
      overflow: overflow.fat_g,
      target: target.fat_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.fat,
    },
  ]

  const activeCards = cards.filter(card => card.remaining > 0 || card.overflow > 0)
  const remainingCards = activeCards
    .filter(card => card.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
  const overflowCards = activeCards
    .filter(card => card.overflow > 0)
    .sort((a, b) => b.overflow - a.overflow)
  const headline = buildHeadline(cards, actionable.actionableRemaining.calories, t)
  const gaugeCards = [
    {
      key: 'calories',
      label: 'Calories',
      valueText: formatValue(remaining.calories, 'kcal'),
      progress: target.kcal > 0 ? consumed.kcal / target.kcal : 0,
      color: overflow.calories > 0 ? '#ef4444' : NUTRITION_UI_COLORS.calories,
      helper: overflow.calories > 0 ? t('nutrition.remaining.slowDown') : remaining.calories > 0 ? t('nutrition.remaining.useful') : t('nutrition.remaining.targetReached'),
    },
    ...cards.map((card) => ({
      key: card.key,
      label: card.label,
      valueText: formatValue(card.remaining, card.unit),
      progress: card.target > 0 ? (card.target - card.remaining + card.overflow) / card.target : 0,
      color: card.overflow > 0 ? '#ef4444' : card.accent,
      helper: card.overflow > 0 ? t('nutrition.remaining.slowDown') : card.remaining > 0 ? t('nutrition.remaining.useful') : t('nutrition.remaining.targetReached'),
    })),
  ] as const

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-1">
            {t('nutrition.remaining.title')}
          </div>
          <p className="text-[13px] text-white/65 leading-relaxed max-w-[28ch]">
            {headline}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white/[0.04] px-3 py-2 text-right">
          <div className="text-[18px] font-black text-white tabular-nums">
            {Math.round(actionable.actionableRemaining.calories)}
          </div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-white/35">
            {t('nutrition.remaining.remainingKcal')}
          </div>
        </div>
      </div>

      {remainingCards.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {gaugeCards.map(card => (
            <RemainingSquircleGauge
              key={card.key}
              label={card.label}
              valueText={card.valueText}
              progress={card.progress}
              color={card.color}
              helper={card.helper}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-2xl bg-[#111111] p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#e0e0e0] font-bold">{t('nutrition.remaining.goodZone')}</div>
            <div className="mt-1 text-[13px] text-white/75 leading-relaxed">
              {t("nutrition.nomacro.lag")}
            </div>
          </div>
        </div>
      )}

      {overflowCards.length > 0 && (
        <div className="mt-3 rounded-2xl bg-[#111111] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#e0e0e0] font-bold">{t('nutrition.remaining.slowDown')}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {overflowCards.map(card => (
              <div
                key={card.key}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#b0b0b0]"
              >
                {card.label} +{formatOverflowValue(card.overflow, card.unit)}
              </div>
            ))}
          </div>
        </div>
      )}

      {remainingCaloriesFromMacros > 0 && (
        <div className="mt-3 rounded-2xl bg-white/[0.025] px-3 py-2.5 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.1em] text-white/35 font-bold">
            Protocole brut
          </span>
          <span className="text-[12px] text-white/60 tabular-nums">
            {Math.round(remainingCaloriesFromMacros)} kcal avant compensation
          </span>
        </div>
      )}

    </div>
  )
}
