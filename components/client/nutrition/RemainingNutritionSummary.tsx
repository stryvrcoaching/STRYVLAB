"use client"

import type { RemainingNutritionTargets } from "@/lib/nutrition/remaining-targets"
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors"
import { useClientT } from "@/components/client/ClientI18nProvider"

type RemainingNutritionSummaryProps = {
  remaining: RemainingNutritionTargets
  /** When true, renders in the violet/indigo planning theme instead of neutral */
  variant?: "neutral" | "violet"
}

function formatRemainingMacro(value: number, t: ReturnType<typeof useClientT>["t"]): string {
  if (value > 0) return `${Math.round(value)} g`
  if (value === 0) return t("nutrition.remaining.alreadyMet")
  return t("nutrition.remaining.alreadyCovered.grams", { n: Math.round(Math.abs(value)) })
}

function formatRemainingCalories(value: number, t: ReturnType<typeof useClientT>["t"]): string {
  if (value > 0) return t("nutrition.remaining.kcal", { n: Math.round(value) })
  if (value === 0) return t("nutrition.remaining.alreadyMet")
  return t("nutrition.remaining.alreadyCovered.kcal", { n: Math.round(Math.abs(value)) })
}

export default function RemainingNutritionSummary({ remaining, variant = "neutral" }: RemainingNutritionSummaryProps) {
  const { t } = useClientT()
  const isViolet = variant === "violet"

  const wrapperStyle = isViolet
    ? { background: "rgba(129,140,248,0.07)", border: "0.3px solid rgba(129,140,248,0.14)" }
    : { background: "rgba(255,255,255,0.04)" }

  const titleColor = isViolet ? "rgba(129,140,248,0.7)" : "rgba(255,255,255,0.30)"
  const subtitleColor = isViolet ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.35)"
  const cardBg = isViolet ? "rgba(129,140,248,0.06)" : "rgba(255,255,255,0.03)"

  return (
    <div className="rounded-2xl p-4 mb-3" style={wrapperStyle}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p
          className="text-[10px] uppercase tracking-[0.16em] font-bold"
          style={{ color: titleColor }}
        >
          {t("nutrition.remaining.title")}
        </p>
        <p className="text-[10px]" style={{ color: subtitleColor }}>
          {t("nutrition.remaining.subtitle.adjusted")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5" style={{ background: cardBg }}>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">{t("nutrition.protein")}</p>
          <p className="text-[14px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.protein }}>
            {formatRemainingMacro(remaining.protein, t)}
          </p>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: cardBg }}>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">{t("nutrition.carbs")}</p>
          <p className="text-[14px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.carbs }}>
            {formatRemainingMacro(remaining.carbs, t)}
          </p>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: cardBg }}>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">{t("nutrition.fat")}</p>
          <p className="text-[14px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.fat }}>
            {formatRemainingMacro(remaining.fat, t)}
          </p>
        </div>
        <div className="rounded-xl p-2.5" style={{ background: cardBg }}>
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/30 font-semibold">{t("log.custom.calories")}</p>
          <p className="text-[14px] font-black mt-1" style={{ color: NUTRITION_UI_COLORS.calories }}>
            {formatRemainingCalories(remaining.calories, t)}
          </p>
        </div>
      </div>
    </div>
  )
}
