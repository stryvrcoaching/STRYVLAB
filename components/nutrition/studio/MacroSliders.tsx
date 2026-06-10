'use client'

import { useCallback } from 'react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

// Manual overrides — null = use calculated value (auto mode)
export interface MacroOverrides {
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

interface MacroSlidersProps {
  calcProtein: number
  calcFat: number
  calcCarbs: number

  overrides: MacroOverrides
  onOverridesChange: (overrides: MacroOverrides) => void

  leanMass?: number | null
  bodyWeight?: number | null
  tdee?: number | null   // TDEE for delta badge — always pass from macroResult.tdee
}

const SLIDER_CONFIG = {
  protein: {
    label: 'Protéines',
    color: NUTRITION_UI_COLORS.protein,
    unit: 'g',
    kcalPerG: 4,
    min: 0,
    max: 400,
    step: 1,
  },
  fat: {
    label: 'Lipides',
    color: NUTRITION_UI_COLORS.fat,
    unit: 'g',
    kcalPerG: 9,
    min: 0,
    max: 250,
    step: 1,
  },
  carbs: {
    label: 'Glucides',
    color: NUTRITION_UI_COLORS.carbs,
    unit: 'g',
    kcalPerG: 4,
    min: 0,
    max: 600,
    step: 1,
  },
} as const

type MacroKey = keyof typeof SLIDER_CONFIG

export default function MacroSliders({
  calcProtein,
  calcFat,
  calcCarbs,
  overrides,
  onOverridesChange,
  leanMass,
  bodyWeight,
  tdee,
}: MacroSlidersProps) {
  // Effective values: manual override takes priority, fallback to calculated
  const effectiveProtein = overrides.protein_g ?? calcProtein
  const effectiveFat = overrides.fat_g ?? calcFat
  const effectiveCarbs = overrides.carbs_g ?? calcCarbs

  // Recalculate calories from effective macros
  const effectiveCalories = Math.round(
    effectiveProtein * 4 + effectiveFat * 9 + effectiveCarbs * 4
  )

  const isManualProtein = overrides.protein_g !== null
  const isManualFat = overrides.fat_g !== null
  const isManualCarbs = overrides.carbs_g !== null
  const anyManual = isManualProtein || isManualFat || isManualCarbs

  const handleChange = useCallback(
    (key: MacroKey, value: number) => {
      const patch: Partial<MacroOverrides> = {}
      if (key === 'protein') patch.protein_g = value
      if (key === 'fat') patch.fat_g = value
      if (key === 'carbs') patch.carbs_g = value
      onOverridesChange({ ...overrides, ...patch })
    },
    [overrides, onOverridesChange]
  )

  const handleReset = useCallback(
    (key: MacroKey) => {
      const patch: Partial<MacroOverrides> = {}
      if (key === 'protein') patch.protein_g = null
      if (key === 'fat') patch.fat_g = null
      if (key === 'carbs') patch.carbs_g = null
      onOverridesChange({ ...overrides, ...patch })
    },
    [overrides, onOverridesChange]
  )

  const resetAll = useCallback(() => {
    onOverridesChange({ protein_g: null, fat_g: null, carbs_g: null })
  }, [onOverridesChange])

  const rows: {
    key: MacroKey
    value: number
    calcValue: number
    isManual: boolean
  }[] = [
    { key: 'protein', value: effectiveProtein, calcValue: calcProtein, isManual: isManualProtein },
    { key: 'fat',     value: effectiveFat,     calcValue: calcFat,     isManual: isManualFat     },
    { key: 'carbs',   value: effectiveCarbs,   calcValue: calcCarbs,   isManual: isManualCarbs   },
  ]

  const tdeeDelta = tdee != null ? effectiveCalories - tdee : null
  const tdeeDeltaColor =
    tdeeDelta == null                     ? 'rgba(255,255,255,0.4)'
    : tdeeDelta / tdee! < -0.15          ? '#f87171'
    : tdeeDelta / tdee! < 0              ? '#fb923c'
    : tdeeDelta / tdee! === 0            ? 'rgba(255,255,255,0.4)'
    : tdeeDelta / tdee! <= 0.15          ? '#1f8a65'
    :                                      '#0f7d4a'

  return (
    <div className="space-y-4">
      {/* Calorie total header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-black text-white tabular-nums leading-none">
            {effectiveCalories.toLocaleString('fr-FR')}
          </span>
          <span className="text-[11px] text-white/40">kcal</span>
          {tdeeDelta != null && (
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: tdeeDeltaColor }}
            >
              {tdeeDelta > 0 ? '+' : ''}{tdeeDelta} kcal
            </span>
          )}
        </div>
        {anyManual && (
          <button
            onClick={resetAll}
            className="text-[9px] text-white/30 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] border-[0.3px] border-white/[0.06]"
          >
            Reset auto
          </button>
        )}
      </div>

      {/* Sliders */}
      {rows.map(({ key, value, calcValue, isManual }) => {
        const cfg = SLIDER_CONFIG[key]
        const pct = Math.min((value / cfg.max) * 100, 100)
        const kcal = Math.round(value * cfg.kcalPerG)
        const totalKcal = effectiveCalories || 1
        const pctOfTotal = Math.round((kcal / totalKcal) * 100)

        // g/kg ratios for display
        let ratioLabel = ''
        let ratioLabel2 = ''
        if (key === 'protein' && leanMass && leanMass > 0) {
          ratioLabel = `${(value / leanMass).toFixed(1)}g/kg LBM`
          if (bodyWeight && bodyWeight > 0) {
            ratioLabel2 = `${(value / bodyWeight).toFixed(1)}g/kg`
          }
        } else if ((key === 'fat' || key === 'carbs') && bodyWeight && bodyWeight > 0) {
          ratioLabel = `${(value / bodyWeight).toFixed(1)}g/kg`
        }

        return (
          <div key={key} className="space-y-1.5">
            {/* Row: dot + label + g value + pct + ratio + reset */}
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-[11px] font-semibold text-white w-16 shrink-0">
                {cfg.label}
              </span>
              <span className="text-[13px] font-bold text-white tabular-nums w-10 text-right shrink-0">
                {value}g
              </span>
              <span className="text-[10px] text-white/40 tabular-nums w-12 text-right shrink-0">
                {pctOfTotal}%
              </span>
              {ratioLabel && (
                <span className="text-[9px] text-white/30 tabular-nums ml-1 shrink-0">
                  {ratioLabel}
                </span>
              )}
              {ratioLabel2 && (
                <span className="text-[9px] text-white/20 tabular-nums shrink-0">
                  · {ratioLabel2}
                </span>
              )}
              {isManual && (
                <button
                  onClick={() => handleReset(key)}
                  className="ml-auto text-[9px] text-white/30 hover:text-white/60 transition-colors shrink-0"
                  title="Revenir à la valeur calculée"
                >
                  ✕
                </button>
              )}
              {!isManual && (
                <span className="ml-auto text-[8px] text-white/20 shrink-0">auto</span>
              )}
            </div>

            {/* Slider */}
            <div className="relative ml-3.5">
              <style>{`
                .macro-slider-${key}::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 13px;
                  height: 13px;
                  border-radius: 50%;
                  background: ${cfg.color};
                  cursor: pointer;
                  border: 2px solid rgba(255,255,255,0.15);
                  box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
                  transition: transform 0.1s ease;
                  opacity: 1;
                }
                .macro-slider-${key}::-moz-range-thumb {
                  width: 13px;
                  height: 13px;
                  border-radius: 50%;
                  background: ${cfg.color};
                  cursor: pointer;
                  border: 2px solid rgba(255,255,255,0.15);
                  box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
                  opacity: 1;
                }
                .macro-slider-${key}:active::-webkit-slider-thumb {
                  transform: scale(1.25);
                  opacity: 1;
                }
              `}</style>
              <input
                type="range"
                min={cfg.min}
                max={cfg.max}
                step={cfg.step}
                value={value}
                onChange={(e) => handleChange(key, Number(e.target.value))}
                className={`macro-slider-${key} w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer`}
                style={{
                  background: `linear-gradient(to right, ${cfg.color} 0%, ${cfg.color} ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)`,
                }}
              />
              {/* Ghost tick showing calc value when overridden */}
              {isManual && calcValue !== value && (
                <div
                  className="absolute top-0 w-px h-1.5 bg-white/20 pointer-events-none"
                  style={{ left: `${Math.min((calcValue / cfg.max) * 100, 100)}%` }}
                  title={`Valeur calculée: ${calcValue}g`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
