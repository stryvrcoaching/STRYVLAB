'use client'

import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

interface MacroBarProps {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  height?: number
  showLabels?: boolean
}

export default function MacroBar({
  calories, protein_g, carbs_g, fat_g, height = 6, showLabels = false,
}: MacroBarProps) {
  const total = protein_g * 4 + fat_g * 9 + carbs_g * 4
  if (total === 0) return <div className="w-full rounded-full bg-white/[0.06]" style={{ height }} />

  const pct = {
    p: Math.round((protein_g * 4 / total) * 100),
    f: Math.round((fat_g * 9 / total) * 100),
    c: 0,
  }
  pct.c = 100 - pct.p - pct.f

  return (
    <div className="w-full space-y-1">
      <div className="flex w-full overflow-hidden rounded-full" style={{ height }}>
        <div style={{ width: `${pct.p}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} className="transition-all duration-300" />
        <div style={{ width: `${pct.f}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} className="transition-all duration-300" />
        <div style={{ width: `${pct.c}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} className="transition-all duration-300" />
      </div>
      {showLabels && (
        <div className="flex justify-between text-[9px] text-white/40">
          <span style={{ color: NUTRITION_UI_COLORS.protein }}>P {pct.p}%</span>
          <span style={{ color: NUTRITION_UI_COLORS.fat }}>L {pct.f}%</span>
          <span style={{ color: NUTRITION_UI_COLORS.carbs }}>G {pct.c}%</span>
        </div>
      )}
    </div>
  )
}
