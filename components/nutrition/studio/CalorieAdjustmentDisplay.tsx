'use client'

interface CalorieAdjustmentDisplayProps {
  value: number           // -30 to +30 — % vs TDEE directly (0 = TDEE)
  baseCalories: number | null  // TDEE reference
  targetCalories: number | null // final effective calories
  onChange: (v: number) => void
  readOnly?: boolean      // true when macro overrides are active — slider shows position but is non-interactive
}

function getAdjustmentColor(pct: number): string {
  if (pct < -15) return '#f87171'  // red-400 — déficit important
  if (pct < 0)   return '#fb923c'  // amber-400 — déficit modéré
  if (pct === 0) return 'rgba(255,255,255,0.4)'  // neutral — maintenance
  if (pct <= 15) return '#1f8a65'  // vert accent — surplus léger
  return '#0f7d4a'                 // vert foncé — surplus important
}

function getAdjustmentLabel(pct: number): string {
  if (pct < -15) return 'Déficit important'
  if (pct < 0)   return 'Déficit modéré'
  if (pct === 0) return 'Maintenance'
  if (pct <= 15) return 'Surplus léger'
  return 'Surplus important'
}

// Track fill % for the slider: -30→+30 maps to 0→100%
function getFillPct(value: number): number {
  return ((value + 30) / 60) * 100
}

const KCAL_MARKERS = [
  { value: -30, label: '-30%' },
  { value: -15, label: '-15%' },
  { value: 0,   label: '0' },
  { value: 15,  label: '+15%' },
  { value: 30,  label: '+30%' },
]

export default function CalorieAdjustmentDisplay({
  value,
  baseCalories,
  targetCalories,
  onChange,
  readOnly = false,
}: CalorieAdjustmentDisplayProps) {
  const color = getAdjustmentColor(value)
  const label = getAdjustmentLabel(value)
  // Delta = difference between target (after adjustment) and base (after goal, before adjustment)
  const deltaCal = baseCalories && targetCalories ? targetCalories - baseCalories : 0
  const fillPct = getFillPct(value)
  const midPct = getFillPct(0) // 50% — center/maintenance

  // Track: fill from center (0%) toward current value
  const trackBg = value < 0
    ? `linear-gradient(to right, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.06) ${fillPct}%, ${color} ${fillPct}%, ${color} ${midPct}%, rgba(255,255,255,0.06) ${midPct}%, rgba(255,255,255,0.06) 100%)`
    : `linear-gradient(to right, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.06) ${midPct}%, ${color} ${midPct}%, ${color} ${fillPct}%, rgba(255,255,255,0.06) ${fillPct}%, rgba(255,255,255,0.06) 100%)`

  return (
    <div className="space-y-2">
      {/* Header: label + value */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold" style={{ color }}>{value > 0 ? '+' : ''}{value}%</span>
          {deltaCal !== 0 && (
            <span className="text-[10px] font-medium text-white/35">
              ({deltaCal > 0 ? '+' : ''}{deltaCal} kcal)
            </span>
          )}
          {targetCalories && (
            <span className="text-[15px] font-bold text-white ml-1">
              {targetCalories} <span className="text-[10px] font-normal text-white/35">kcal</span>
            </span>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <style>{`
          .kcal-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: var(--kcal-thumb-color);
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.15);
            box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
            transition: transform 0.1s ease;
          }
          .kcal-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: var(--kcal-thumb-color);
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.15);
            box-shadow: 0 0 0 3px rgba(0,0,0,0.3);
          }
          .kcal-slider:active::-webkit-slider-thumb {
            transform: scale(1.2);
          }
        `}</style>
        <input
          type="range"
          min="-30"
          max="30"
          step="1"
          value={value}
          onChange={e => !readOnly && onChange(parseInt(e.target.value))}
          className="kcal-slider w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer"
          style={{
            '--kcal-thumb-color': color,
            background: trackBg,
            ...(readOnly ? { pointerEvents: 'none' as const, opacity: 0.55 } : {}),
          } as React.CSSProperties}
        />

        {/* Marqueurs */}
        <div className="relative mt-2 h-4">
          {KCAL_MARKERS.map((m, i) => {
            const pct = getFillPct(m.value)
            const isFirst = i === 0
            const isLast = i === KCAL_MARKERS.length - 1
            const transform = isFirst ? 'translateX(0%)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)'
            const align = isFirst ? 'items-start' : isLast ? 'items-end' : 'items-center'
            return (
              <div
                key={m.value}
                className={`absolute flex flex-col ${align}`}
                style={{ left: `${pct}%`, transform }}
              >
                <div className="w-px h-1.5 bg-white/[0.15]" />
                <span className="text-[8px] text-white/30 whitespace-nowrap mt-0.5">{m.label}</span>
              </div>
            )
          })}
        </div>
        {readOnly && (
          <p className="text-[9px] text-white/25 mt-1">
            Macros manuels — ajustez via Reset auto pour reprendre le contrôle
          </p>
        )}
      </div>
    </div>
  )
}
