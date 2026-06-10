'use client'

import { useState } from 'react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

interface Props {
  calories: number
  protein: number
  carbs: number
  fat: number
  targetCal?: number
  targetProt?: number
  targetCarb?: number
  targetFat?: number
}

const COLORS = {
  cal:  'var(--data-petrol)',
  prot: NUTRITION_UI_COLORS.protein,
  carb: NUTRITION_UI_COLORS.carbs,
  fat:  NUTRITION_UI_COLORS.fat,
  over: 'var(--data-copper)',
  track: 'rgba(255,255,255,0.05)',
}

// ── SVG arc 270° ─────────────────────────────────────────────
function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function makeArcPath(cx: number, cy: number, r: number, pct: number) {
  const MAX = 270
  const startDeg = -135
  const angle = Math.min(Math.max(pct, 0), 0.9999) * MAX
  const start = polarToXY(cx, cy, r, startDeg)
  const end = polarToXY(cx, cy, r, startDeg + angle)
  const large = angle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
}

// ── Barre macro individuelle ──────────────────────────────────
function MacroRow({
  label, value, target, color, showRemaining,
}: {
  label: string
  value: number
  target: number
  color: string
  showRemaining: boolean
}) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0
  const over = target > 0 && value > target
  const display = showRemaining && target > 0
    ? Math.max(0, Math.round(target - value))
    : Math.round(value)
  const fillColor = over ? COLORS.over : color

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-[14px] font-black leading-none" style={{ color: over ? COLORS.over : 'white' }}>
            {display}
          </span>
          {target > 0 && (
            <span className="text-[10px] text-white/25 font-medium">/ {target}g</span>
          )}
        </div>
      </div>
      <div className="h-[7px] rounded-full overflow-hidden" style={{ background: COLORS.track }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  )
}

// ── Mode sans cible : résumé compact ─────────────────────────
function NoTargetSummary({ calories, protein, carbs, fat }: { calories: number; protein: number; carbs: number; fat: number }) {
  const { t } = useClientT()
  const pK = protein * 4, gK = carbs * 4, fK = fat * 9
  const total = pK + gK + fK || 1

  return (
    <div className="w-full">
      {/* Valeur calories centrale */}
      <div className="flex flex-col items-center py-5">
        <p className="font-black leading-none tracking-tight text-white" style={{ fontSize: 52 }}>
          {Math.round(calories)}
        </p>
        <p className="text-[10px] text-white/30 uppercase tracking-[0.14em] mt-1.5">kcal aujourd'hui</p>
      </div>

      {/* Répartition macro strip */}
      <div className="flex h-[6px] rounded-full overflow-hidden gap-[2px] mb-4">
        <div className="rounded-full" style={{ width: `${(pK / total) * 100}%`, backgroundColor: COLORS.prot }} />
        <div className="rounded-full" style={{ width: `${(gK / total) * 100}%`, backgroundColor: COLORS.carb }} />
        <div className="rounded-full" style={{ width: `${(fK / total) * 100}%`, backgroundColor: COLORS.fat }} />
      </div>

      {/* 3 valeurs macro */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('smart.nutrition.protein'), value: protein, color: COLORS.prot },
          { label: t('smart.nutrition.carbs'),  value: carbs,   color: COLORS.carb },
          { label: t('smart.nutrition.fat'),    value: fat,      color: COLORS.fat },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center py-2 bg-white/[0.03] rounded-xl">
            <span className="text-[16px] font-black text-white leading-none">{Math.round(value)}g</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] mt-1" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Widget principal ──────────────────────────────────────────
export default function NutritionWidget({
  calories, protein, carbs, fat,
  targetCal = 0, targetProt = 0, targetCarb = 0, targetFat = 0,
}: Props) {
  const { t } = useClientT()
  const [showRemaining, setShowRemaining] = useState(false)

  // Sans cible : mode compact
  if (targetCal === 0) {
    return <NoTargetSummary calories={calories} protein={protein} carbs={carbs} fat={fat} />
  }

  // Arc metrics
  const size = 240
  const cx = size / 2
  const cy = size / 2
  const R = cx - 18
  const SW = 22

  const calPct = calories / targetCal
  const calOver = calories > targetCal
  const arcFill = calOver ? COLORS.over : COLORS.cal

  const remaining = Math.max(0, Math.round(targetCal - calories))
  const centerValue = showRemaining ? remaining : Math.round(calories)
  const centerColor = calOver ? COLORS.over : 'white'
  const svgH = size * 0.82

  return (
    <div className="w-full">
      {/* ── Arc SVG ── */}
      <div className="relative mx-auto" style={{ width: size, height: svgH }}>
        <svg
          width={size}
          height={svgH}
          viewBox={`0 ${(size - svgH) / 2} ${size} ${svgH}`}
        >
          {/* Track */}
          <path
            d={makeArcPath(cx, cy, R, 1)}
            fill="none"
            strokeWidth={SW}
            stroke={COLORS.track}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {calPct > 0.005 && (
            <path
              d={makeArcPath(cx, cy, R, Math.min(calPct, 1))}
              fill="none"
              strokeWidth={SW}
              stroke={arcFill}
              strokeLinecap="round"
              style={undefined}
            />
          )}
        </svg>

        {/* Centre */}
        <div
          className="absolute left-0 right-0 flex flex-col items-center justify-center"
          style={{ top: (size - svgH) / 2 * -1, height: size }}
        >
          <p className="font-black leading-none tracking-tight" style={{ fontSize: 52, color: centerColor }}>
            {centerValue}
          </p>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.14em] mt-1.5">
            {showRemaining ? t('nutrition.remaining.info', { target: String(targetCal) }) : `/ ${targetCal} kcal`}
          </p>

          {/* Flancs */}
          {!showRemaining && (
            <div className="flex w-full px-2 justify-between mt-4 absolute" style={{ bottom: size * 0.12 }}>
              <div className="text-center">
                <p className="text-[16px] font-black text-white/50 leading-none">{remaining}</p>
                <p className="text-[8px] text-white/25 uppercase tracking-[0.12em] mt-0.5">{t('nutrition.remaining.tab')}</p>
              </div>
              <div className="text-center">
                <p className="text-[16px] font-black text-white/30 leading-none">{targetCal}</p>
                <p className="text-[8px] text-white/20 uppercase tracking-[0.12em] mt-0.5">{t('nutrition.target.label')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Toggle Consommé / Restant ── */}
      <div className="flex mx-auto w-fit bg-white/[0.06] rounded-full p-[3px] mb-5">
        {([false, true] as const).map((isRemaining) => {
          const active = isRemaining === showRemaining
          return (
            <button
              key={String(isRemaining)}
              onClick={() => setShowRemaining(isRemaining)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                active ? 'bg-white text-black' : 'text-white/40'
              }`}
            >
              {isRemaining ? t('nutrition.remaining.tab') : t('nutrition.consumed')}
            </button>
          )
        })}
      </div>

      {/* ── 3 barres macro ── */}
      <div className="space-y-4">
        <MacroRow label="Protéines" value={protein} target={targetProt} color={COLORS.prot} showRemaining={showRemaining} />
        <MacroRow label="Glucides"  value={carbs}   target={targetCarb} color={COLORS.carb} showRemaining={showRemaining} />
        <MacroRow label="Lipides"   value={fat}      target={targetFat}  color={COLORS.fat}  showRemaining={showRemaining} />
      </div>
    </div>
  )
}
