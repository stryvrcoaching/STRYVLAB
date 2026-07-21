'use client'
import { getNutritionProgressMeta, type NutritionProgressState } from '@/lib/nutrition/progress'
import { computeNutritionBalance } from '@/lib/nutrition/balance'
import type { NutritionMacros } from './SmartNutritionWidget'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { useClientT } from '../ClientI18nProvider'

type Props = {
  consumed: NutritionMacros
  target: NutritionMacros
  onWaterClick?: () => void
  smoothingSlot?: React.ReactNode
  simulationMode?: boolean
  compact?: boolean
  micro?: boolean
  showSimulationBadge?: boolean
  hideHydration?: boolean
}

const MACRO_KEYS = [
  { key: 'protein_g' as const, iKey: 'nutrition.protein' as const, color: NUTRITION_UI_COLORS.protein },
  { key: 'carbs_g'   as const, iKey: 'nutrition.carbs' as const,   color: NUTRITION_UI_COLORS.carbs   },
  { key: 'fat_g'     as const, iKey: 'nutrition.fat' as const,     color: NUTRITION_UI_COLORS.fat     },
]

function formatOverflow(value: number, unit: 'g' | 'L'): string | null {
  if (value <= 0) return null
  return unit === 'L' ? `+${value.toFixed(1)} L` : `+${Math.round(value)}g`
}

function getMacroOverflowTone(overflowGrams: number): string {
  if (overflowGrams > 5) return '#ef4444'
  if (overflowGrams > 0) return '#f59e0b'
  return ''
}

function getCalorieOverflowTone(overflowKcal: number): string {
  if (overflowKcal > 50) return '#ef4444'
  if (overflowKcal > 0) return '#f59e0b'
  return ''
}

function getStateColor(state: NutritionProgressState, base: string): string {
  if (state === 'over')       return '#ef4444'
  if (state === 'near_limit') return '#f59e0b'
  return base
}

function formatRemainingLabel(value: number, unit: 'g' | 'L', t: ReturnType<typeof useClientT>['t']): string {
  if (unit === 'L') return t('nutrition.hero.remainingLiters', { n: value.toFixed(1) })
  return t('nutrition.hero.remainingGrams', { n: Math.round(value) })
}

function getMacroStatus(remaining: number, overflow: number, baseColor: string, t: ReturnType<typeof useClientT>['t']) {
  if (overflow > 0) {
    return {
      label: t('nutrition.hero.goalExceeded'),
      color: getMacroOverflowTone(overflow),
    }
  }

  if (remaining <= 0) {
    return {
      label: t('nutrition.hero.goalReached'),
      color: baseColor,
    }
  }

  return {
    label: formatRemainingLabel(remaining, 'g', t),
    color: 'rgba(255,255,255,0.32)',
  }
}

function getCalorieStatus(remaining: number, overflow: number, baseColor: string, t: ReturnType<typeof useClientT>['t']) {
  if (overflow > 0) {
    return {
      label: t('nutrition.hero.goalExceeded'),
      color: getCalorieOverflowTone(overflow),
    }
  }

  if (remaining <= 0) {
    return {
      label: t('nutrition.hero.goalReached'),
      color: baseColor,
    }
  }

  return {
    label: t('nutrition.hero.remainingKcal', { n: Math.round(remaining) }),
    color: 'rgba(255,255,255,0.32)',
  }
}

function MacroSquircleGauge({
  label,
  valueText,
  secondaryText,
  footerText,
  progress,
  color,
  footerColor,
  compact = false,
  micro = false,
  animateProgress = true,
}: {
  label: string
  valueText: string
  secondaryText: string
  footerText: string
  progress: number
  color: string
  footerColor: string
  compact?: boolean
  micro?: boolean
  animateProgress?: boolean
}) {
  const size = micro ? 52 : compact ? 56 : 60
  const stroke = micro ? 4 : 4.5
  const inset = stroke / 2
  const pathSize = size - stroke
  const radius = 22
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
  const isFull = clamped >= 0.999

  return (
    <div className="flex min-w-0 flex-col items-center">
      <p className={`mb-1.5 font-semibold ${micro ? 'text-[9px]' : 'text-[10px]'}`} style={{ color }}>
        {label}
      </p>
      <div className="relative" style={{ width: size, height: size }}>
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
            strokeLinecap={isFull ? 'butt' : 'round'}
            strokeLinejoin="round"
            {...(isFull ? {} : { strokeDasharray: pathLength, strokeDashoffset: dashOffset })}
            style={animateProgress ? { transition: 'stroke-dashoffset 0.35s ease, stroke 0.3s ease' } : undefined}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <span
              className={`font-black leading-none tracking-[-0.03em] tabular-nums ${micro ? 'text-[11px]' : compact ? 'text-[11px]' : 'text-[12px]'}`}
              style={{ color }}
            >
              {valueText}
            </span>
            <div className="my-1 h-px w-7 rounded-full bg-white/18" />
            <span
              className={`font-medium leading-none tabular-nums ${micro ? 'text-[11px]' : compact ? 'text-[11px]' : 'text-[12px]'}`}
              style={{ color: secondaryText.startsWith('-') ? color : 'rgba(255,255,255,0.42)' }}
            >
              {secondaryText}
            </span>
          </div>
        </div>
      </div>
      <p className={`mt-1 min-h-[30px] max-w-[76px] text-center font-semibold uppercase leading-[1.15] tracking-[0.1em] ${micro ? 'text-[11px]' : compact ? 'text-[11px]' : 'text-[12px]'}`} style={{ color: footerColor }}>
        {footerText}
      </p>
    </div>
  )
}

export default function SmartNutritionHero({
  consumed,
  target,
  onWaterClick,
  smoothingSlot,
  simulationMode = false,
  compact = false,
  micro = false,
  showSimulationBadge = true,
  hideHydration = false,
}: Props) {
  const { t } = useClientT()
  const balance = computeNutritionBalance(consumed, target)
  const MACROS = MACRO_KEYS.map(m => ({ ...m, label: t(m.iKey as any) }))

  const kcalMeta   = getNutritionProgressMeta(consumed.kcal, target.kcal)
  const remaining  = Math.round(balance.remainingCaloriesNet)
  const kcalOverflow = Math.max(0, Math.round(consumed.kcal - target.kcal))
  const kcalRemaining = Math.max(0, remaining)
  const calorieBaseColor = NUTRITION_UI_COLORS.calories
  const kcalStatus = getCalorieStatus(kcalRemaining, kcalOverflow, calorieBaseColor, t)
  const kcalGaugeColor = calorieBaseColor

  const waterMeta          = getNutritionProgressMeta(consumed.water_ml, target.water_ml)
  const waterOverflowLabel = formatOverflow((consumed.water_ml - target.water_ml) / 1000, 'L')
  const cardPadding = micro ? '8px' : compact ? '12px' : '14px'
  const gaugeGapClass = micro ? 'gap-2 mt-1' : compact ? 'gap-2 mt-1' : 'gap-2 mt-1.5'

  return (
    <div
      className={`rounded-2xl ${
        simulationMode
          ? 'border-[0.3px] border-white/[0.06] bg-[#181818]'
          : 'bg-[#111111]'
      }`}
      style={{ padding: cardPadding }}
    >

        {/* ── Simulation badge ── */}
        {simulationMode && showSimulationBadge && (
          <div className={`flex items-center ${micro ? 'mb-1' : compact ? 'mb-1.5' : 'mb-3'}`}>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08]">
              <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              <span className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/82">Simulation</span>
            </div>
          </div>
        )}

      <div className={`grid grid-cols-4 ${gaugeGapClass}`}>
          <MacroSquircleGauge
            label="Calories"
            valueText={String(Math.round(consumed.kcal))}
            secondaryText={kcalOverflow > 0 ? `+${kcalOverflow}` : String(Math.round(target.kcal - consumed.kcal))}
            footerText={kcalRemaining <= 0 || kcalOverflow > 0 ? kcalStatus.label : `${Math.round(target.kcal)}`}
            progress={target.kcal > 0 ? consumed.kcal / target.kcal : 0}
            color={kcalGaugeColor}
            footerColor="rgba(255,255,255,0.4)"
            compact={compact}
            micro={micro}
            animateProgress={!simulationMode}
          />
          {MACROS.map(m => {
          const consumedValue = consumed[m.key] ?? 0
          const targetValue = target[m.key] ?? 0
          const overflowValue = Math.max(0, consumedValue - targetValue)
          const remainingValue = Math.max(0, targetValue - consumedValue)
          const status = getMacroStatus(remainingValue, overflowValue, m.color, t)
          const netRemainingValue = Math.round(targetValue - consumedValue)
          const fillColor = overflowValue > 0
            ? getMacroOverflowTone(overflowValue)
            : m.color
          return (
            <MacroSquircleGauge
              key={m.key}
              label={m.label}
              valueText={String(Math.round(consumedValue))}
              secondaryText={overflowValue > 0 ? `+${Math.round(overflowValue)}` : String(netRemainingValue)}
              footerText={remainingValue <= 0 || overflowValue > 0 ? status.label : `${Math.round(targetValue)}g`}
              progress={targetValue > 0 ? consumedValue / targetValue : 0}
              color={m.color}
              footerColor="rgba(255,255,255,0.4)"
              compact={compact}
              micro={micro}
              animateProgress={!simulationMode}
            />
          )
          })}
      </div>

      {!simulationMode && !hideHydration && (
        <button
          type="button"
          onClick={onWaterClick}
          className={`${compact ? 'mt-2 pt-2' : 'mt-2.5 pt-2'} group w-full border-t border-white/[0.06] text-left`}
          disabled={!onWaterClick}
        >
          <div className="flex justify-between text-[10px] mb-1.5">
            <span
              className="text-[10px] font-bold tracking-[0.1em] text-white/50"
              style={{ color: NUTRITION_UI_COLORS.water }}
            >
              {t('nutrition.hydration.label')}
            </span>
            <span className="text-white font-bold tabular-nums">
              {(consumed.water_ml / 1000).toFixed(1)} / {(target.water_ml / 1000).toFixed(1)} L
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${waterMeta.clampedPercent}%`,
                background: NUTRITION_UI_COLORS.water,
              }}
            />
          </div>
          <div className="mt-1 min-h-[14px] text-[11px] font-medium tabular-nums text-white/40">
            {waterOverflowLabel ?? ' '}
          </div>
        </button>
      )}

      {!simulationMode && smoothingSlot ? (
        <div className={`${compact ? 'mt-2 pt-2' : 'mt-2 pt-2.5'} border-t border-white/[0.06]`}>
          {smoothingSlot}
        </div>
      ) : null}
    </div>
  )
}
