'use client'

import type { NutritionMacros } from './SmartNutritionWidget'
import { computeNutritionBalance } from '@/lib/nutrition/balance'
import { computeActionableRemaining } from '@/lib/nutrition/actionable-remaining'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useClientT } from '../ClientI18nProvider'

type DeltaCard = {
  key: 'protein' | 'carbs' | 'fat' | 'water'
  label: string
  shortLabel: string
  remaining: number
  overflow: number
  unit: 'g' | 'L'
  accent: string
}

function formatValue(value: number, unit: 'g' | 'L'): string {
  return unit === 'L' ? `${value.toFixed(1)} ${unit}` : `${Math.round(value)}${unit}`
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
    protein_g: actionable.actionableRemaining.protein,
    carbs_g: actionable.actionableRemaining.carbs,
    fat_g: actionable.actionableRemaining.fat,
    water_ml: Math.max(0, target.water_ml - consumed.water_ml),
  }
  const overflow = {
    protein_g: actionable.overflow.protein_g,
    carbs_g: actionable.overflow.carbs_g,
    fat_g: actionable.overflow.fat_g,
    water_ml: Math.max(0, consumed.water_ml - target.water_ml),
  }
  const cards: DeltaCard[] = [
    {
      key: 'protein',
      label: t('nutrition.protein'),
      shortLabel: t('nutrition.protein'),
      remaining: remaining.protein_g,
      overflow: overflow.protein_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.protein,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbs'),
      shortLabel: t('nutrition.carbs'),
      remaining: remaining.carbs_g,
      overflow: overflow.carbs_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.carbs,
    },
    {
      key: 'fat',
      label: t('nutrition.fat'),
      shortLabel: t('nutrition.fat'),
      remaining: remaining.fat_g,
      overflow: overflow.fat_g,
      unit: 'g',
      accent: NUTRITION_UI_COLORS.fat,
    },
    {
      key: 'water',
      label: t('nutrition.hydration'),
      shortLabel: t('nutrition.hydration'),
      remaining: remaining.water_ml / 1000,
      overflow: overflow.water_ml / 1000,
      unit: 'L',
      accent: NUTRITION_UI_COLORS.water,
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

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-1">
            Reste à consommer
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
            kcal restantes
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {remainingCards.length > 0 ? (
          remainingCards.map(card => (
            <div key={card.key} className="rounded-2xl bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.1em] text-white/40 font-bold">{card.label}</div>
              <div className="mt-1 text-[20px] font-black tabular-nums" style={{ color: card.accent }}>
                {formatValue(card.remaining, card.unit)}
              </div>
              <div className="text-[10px] text-white/35 mt-1">
                encore utiles
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 rounded-2xl bg-[#111111] p-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#e0e0e0] font-bold">Bonne zone</div>
            <div className="mt-1 text-[13px] text-white/75 leading-relaxed">
              {t("nutrition.nomacro.lag")}
            </div>
          </div>
        )}
      </div>

      {overflowCards.length > 0 && (
        <div className="mt-3 rounded-2xl bg-[#111111] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#e0e0e0] font-bold">À freiner</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {overflowCards.map(card => (
              <div
                key={card.key}
                className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#b0b0b0]"
              >
                {card.label} +{formatValue(card.overflow, card.unit)}
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
