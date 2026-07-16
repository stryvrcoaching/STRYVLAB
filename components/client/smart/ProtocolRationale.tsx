'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { getCycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import { useClientT } from '../ClientI18nProvider'
import { clientLocale } from '@/lib/i18n/clientTranslations'

interface ProtocolDay {
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  carb_cycle_type?: string | null
  recommendations?: string | null
}

interface ScheduleSlot {
  dow: number
  dayName: string
  carbCycleType: string | null
}

interface Props {
  protocolDays?: ProtocolDay[]
  scheduleSlots?: ScheduleSlot[]
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  activeDayName?: string | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean
  // Legacy single-day support
  target?: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  dayName?: string | null
}

// ISO weekday: 1=Lun … 7=Dim
const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 7]
const DOW_LABELS        = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const CARB_CYCLE_COLOR: Record<string, string> = {
  high:   NUTRITION_UI_COLORS.protein, // vert
  medium: NUTRITION_UI_COLORS.carbs,   // or
  low:    'rgba(255,255,255,0.18)',
}

const PHASE_COLORS: Record<string, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[9px] text-white/25 pt-3 pb-1.5">
      {children}
    </p>
  )
}

function Row({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: string
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[12px] text-white/45 leading-snug shrink-0">{label}</span>
      <div className="text-right min-w-0">
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: valueColor ?? '#e0e0e0' }}
        >
          {value}
        </span>
        {sub && <p className="text-[10px] text-white/30 mt-0.5 leading-snug">{sub}</p>}
      </div>
    </div>
  )
}

function WeekSchedule({ slots, days }: { slots: ScheduleSlot[]; days: ProtocolDay[] }) {
  const { t } = useClientT()
  if (slots.length === 0) return null

  // Build a lookup: dayName → carbCycleType
  const dayTypeByName = new Map(days.map(d => [d.name, d.carb_cycle_type ?? null]))
  // Build a lookup: dow → slot
  const slotByDow = new Map(slots.map(s => [s.dow, s]))

  return (
    <div className="bg-[#111111] rounded-2xl p-4 space-y-3">
      <p className="font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[9px] text-white/25">
        {t('nutrition.protocol.weeklyPlanning')}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DOW_DISPLAY_ORDER.map((dow, i) => {
          const slot = slotByDow.get(dow)
          const cct  = slot ? (dayTypeByName.get(slot.dayName) ?? slot.carbCycleType) : null
          const color = cct ? CARB_CYCLE_COLOR[cct] : 'rgba(255,255,255,0.08)'
          const label = cct === 'high' ? 'H' : cct === 'medium' ? 'M' : cct === 'low' ? 'B' : '—'
          return (
            <div key={dow} className="flex flex-col items-center gap-1.5">
              <p className="text-[9px] text-white/30">{DOW_LABELS[i]}</p>
              <div
                className="w-full rounded-full"
                style={{ height: 4, backgroundColor: color }}
              />
              <p className="text-[9px] font-bold" style={{ color: cct ? color : 'rgba(255,255,255,0.15)' }}>
                {label}
              </p>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {([
          ['high', t('nutrition.carbCycle.high')],
          ['medium', t('nutrition.carbCycle.medium')],
          ['low', t('nutrition.carbCycle.low')],
        ] as const).map(([key, label]) => (
          days.some(d => d.carb_cycle_type === key) && (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CARB_CYCLE_COLOR[key] }} />
              <span className="text-[10px] text-white/35">{label}</span>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function DayAccordion({
  day,
  tdee,
  tdeeSource,
  bodyWeightKg,
  cycleState,
  cycleSyncEnabled,
  defaultOpen,
}: {
  day: ProtocolDay
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean
  defaultOpen: boolean
}) {
  const { lang, t } = useClientT()
  const locale = clientLocale(lang)
  const [open, setOpen] = useState(defaultOpen)

  const delta     = tdee != null && tdee > 0 ? Math.round(day.kcal - tdee) : null
  const deltaStr  = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) + ' kcal vs TDEE' : null
  const goalLabel =
    delta == null ? null :
    delta >  100  ? t('nutrition.goal.surplus') :
    delta < -100  ? t('goal.deficit_calorique') : t('goal.maintenance')

  const gPerKg = bodyWeightKg && bodyWeightKg > 0
    ? (day.protein_g / bodyWeightKg).toFixed(2)
    : null

  const tdeeSourceLabel = tdeeSource === 'formula_proxy'
    ? t('nutrition.protocol.tdeeEstimated')
    : t('nutrition.protocol.tdeeAdaptive')

  const cycleTypeLabel = day.carb_cycle_type
    ? day.carb_cycle_type === 'high'
      ? t('nutrition.carbCycle.high')
      : day.carb_cycle_type === 'medium'
        ? t('nutrition.carbCycle.medium')
        : t('nutrition.carbCycle.low')
    : null
  const cycleTypeColor = day.carb_cycle_type ? CARB_CYCLE_COLOR[day.carb_cycle_type] : undefined

  const showCycle = !!(cycleSyncEnabled && cycleState?.hasActiveCycle && cycleState.currentPhase)
  const cycleAdj  = showCycle ? getCycleSyncAdjustment(cycleState!.currentPhase!) : null

  return (
    <div className="bg-[#111111] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-white/[0.03] transition-colors"
      >
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/70 truncate">
              {day.name}
            </p>
            {cycleTypeLabel && (
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] rounded-full px-2 py-0.5 shrink-0"
                style={{ color: cycleTypeColor, backgroundColor: cycleTypeColor ? `${cycleTypeColor}18` : undefined }}
              >
                {cycleTypeLabel}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <p className="text-[13px] font-semibold text-[#e0e0e0] tabular-nums">
              {Math.round(day.kcal).toLocaleString(locale)} kcal
            </p>
            {goalLabel && (
              <p className="text-[11px] text-white/35">{goalLabel}</p>
            )}
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 ml-3">
          <ChevronDown size={16} className="text-white/30" />
        </motion.div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/[0.05]">

              {/* Notes coach */}
              {day.recommendations && (
                <>
                  <SectionLabel>{t('nutrition.protocol.coachNotes')}</SectionLabel>
                  <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap pb-1">
                    {day.recommendations}
                  </p>
                </>
              )}

              {/* TDEE */}
              {tdee != null && tdee > 0 && (
                <>
                  <SectionLabel>{t('nutrition.protocol.energySpend')}</SectionLabel>
                  <Row
                    label="TDEE"
                    value={`${Math.round(tdee).toLocaleString(locale)} kcal`}
                    sub={tdeeSourceLabel}
                    valueColor="#4a90e2"
                  />
                </>
              )}

              {/* Objectif calorique */}
              <SectionLabel>{t('nutrition.protocol.calorieGoal')}</SectionLabel>
              <Row
                label={t('nutrition.protocol.target')}
                value={`${Math.round(day.kcal).toLocaleString(locale)} kcal`}
                sub={deltaStr ?? undefined}
                valueColor={NUTRITION_UI_COLORS.carbs}
              />

              {/* Macros */}
              <SectionLabel>{t('nutrition.protocol.macros')}</SectionLabel>
              {day.protein_g > 0 && (
                <Row
                  label={t('nutrition.protein')}
                  value={`${Math.round(day.protein_g)} g`}
                  sub={gPerKg ? t('nutrition.protocol.weightRatio', { n: gPerKg }) : undefined}
                  valueColor={NUTRITION_UI_COLORS.protein}
                />
              )}
              {day.carbs_g > 0 && (
                <Row
                  label={t('nutrition.carbs')}
                  value={`${Math.round(day.carbs_g)} g`}
                  valueColor={NUTRITION_UI_COLORS.carbs}
                />
              )}
              {day.fat_g > 0 && (
                <Row
                  label={t('nutrition.fat')}
                  value={`${Math.round(day.fat_g)} g`}
                  valueColor={NUTRITION_UI_COLORS.fat}
                />
              )}

              {/* Cycle sync */}
              {showCycle && cycleAdj && (() => {
                const phase      = cycleState!.currentPhase!
                const phaseName  = t(`cycle.phase.${phase}` as any)
                const phaseColor = PHASE_COLORS[phase] ?? '#a855f7'
                const hasDeltas  = cycleAdj.caloriesDelta !== 0 || cycleAdj.proteinDelta !== 0 || cycleAdj.carbsDelta !== 0
                const adjStr     = hasDeltas
                  ? [
                      cycleAdj.caloriesDelta !== 0 ? `${cycleAdj.caloriesDelta > 0 ? '+' : ''}${cycleAdj.caloriesDelta} kcal` : null,
                      cycleAdj.proteinDelta   !== 0 ? `${cycleAdj.proteinDelta > 0 ? '+' : ''}${cycleAdj.proteinDelta}g P`    : null,
                      cycleAdj.carbsDelta     !== 0 ? `${cycleAdj.carbsDelta > 0 ? '+' : ''}${cycleAdj.carbsDelta}g G`        : null,
                    ].filter(Boolean).join(' · ')
                  : t('msg.no.adjustment' as any)
                const adjustedKcal = Math.round(day.kcal + cycleAdj.caloriesDelta)
                const nextLabel    = cycleState!.nextPhaseIn != null
                  ? t('cycle.next.phase' as any).replace('{days}', String(cycleState!.nextPhaseIn))
                  : undefined
                return (
                  <>
                    <SectionLabel>{t('nutrition.protocol.cycleSync')}</SectionLabel>
                    <Row
                      label={t('nutrition.protocol.phase', { name: phaseName })}
                      value={hasDeltas ? `${adjStr} → ${adjustedKcal.toLocaleString(locale)} kcal` : adjStr}
                      sub={nextLabel}
                      valueColor={phaseColor}
                    />
                  </>
                )
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ProtocolRationale({
  protocolDays,
  scheduleSlots = [],
  tdee,
  tdeeSource,
  bodyWeightKg,
  activeDayName,
  cycleState,
  cycleSyncEnabled,
  target,
  dayName,
}: Props) {
  const { t } = useClientT()
  const days: ProtocolDay[] = protocolDays?.length
    ? protocolDays
    : target
      ? [{ name: dayName ?? t('smart.timeline.label'), kcal: target.kcal, protein_g: target.protein_g, carbs_g: target.carbs_g, fat_g: target.fat_g }]
      : []

  if (days.length === 0) return null

  const carbCycleTypes = new Set(days.map(d => d.carb_cycle_type).filter(Boolean))
  const isCarbCycling  = carbCycleTypes.size > 1
  const structureLabel = isCarbCycling
    ? `Carb cycling — ${t('nutrition.protocol.dayTypes', { n: days.length })}`
    : days.length > 1
      ? t('nutrition.protocol.dayTypes', { n: days.length })
      : null

  // Global phase: weighted average kcal across schedule (if slots available), else unweighted
  let avgKcal: number | null = null
  if (scheduleSlots.length > 0 && days.length > 0) {
    const dayKcalByName = new Map(days.map(d => [d.name, d.kcal]))
    const total = scheduleSlots.reduce((sum, s) => sum + (dayKcalByName.get(s.dayName) ?? 0), 0)
    avgKcal = total / scheduleSlots.length
  } else if (days.length > 0) {
    avgKcal = days.reduce((sum, d) => sum + d.kcal, 0) / days.length
  }
  const avgDelta     = avgKcal != null && tdee != null && tdee > 0 ? Math.round(avgKcal - tdee) : null
  const globalPhase  =
    avgDelta == null ? null :
    avgDelta >  100  ? t('nutrition.goal.caloricSurplus') :
    avgDelta < -100  ? t('goal.deficit_calorique') : t('goal.maintenance')
  const avgDeltaStr  = avgDelta != null
    ? t('nutrition.protocol.avgVsTdee', { n: `${avgDelta >= 0 ? `+${avgDelta}` : `${avgDelta}`}` })
    : null

  return (
    <div className="space-y-2">
      {/* ── Header ── */}
      <div className="px-1 pb-1">
        <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/40">
          {t('nutrition.protocol.myProtocol')}
        </p>
        {(structureLabel || globalPhase) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {globalPhase && <p className="text-[11px] text-[#e0e0e0]">{globalPhase}</p>}
            {structureLabel && <p className="text-[10px] text-white/30">· {structureLabel}</p>}
          </div>
        )}
        {avgDeltaStr && (
          <p className="text-[10px] text-white/25 mt-0.5">{avgDeltaStr}</p>
        )}
      </div>

      {/* ── Weekly schedule ── */}
      <WeekSchedule slots={scheduleSlots} days={days} />

      {/* ── Day accordions ── */}
      {days.map(day => (
        <DayAccordion
          key={day.name}
          day={day}
          tdee={tdee}
          tdeeSource={tdeeSource}
          bodyWeightKg={bodyWeightKg}
          cycleState={cycleState}
          cycleSyncEnabled={cycleSyncEnabled}
          defaultOpen={day.name === (activeDayName ?? dayName)}
        />
      ))}
    </div>
  )
}
