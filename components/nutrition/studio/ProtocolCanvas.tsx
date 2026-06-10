'use client'

import { useState } from 'react'
import { Plus, X, Pencil, Check, CheckCircle2, Info } from 'lucide-react'
import MacroBar from './MacroBar'
import CoherenceScore from './CoherenceScore'
import InfoModal from './InfoModal'
import { INJECTION_INFO_MODALS } from '@/lib/nutrition/infoModalDefinitions'
import type { DayDraft } from '@/lib/nutrition/types'
import type { TrainingWeekSchedule } from '@/lib/nutrition/training-week-schedule'
import TrainingWeekSchedulePanel from './TrainingWeekSchedulePanel'
import ProtocolScheduleHeatmap from './ProtocolScheduleHeatmap'
import type { CoherenceScoreData, ScheduleSlotDraft, StudioShareIssue } from './useNutritionStudio'

interface Props {
  protocolName: string
  onProtocolNameChange: (v: string) => void
  days: DayDraft[]
  activeDayIndex: number
  onActiveDayChange: (i: number) => void
  onUpdateDay: (index: number, patch: Partial<DayDraft>) => void
  onAddDay: (name?: string) => void
  onRemoveDay: (index: number) => void
  onInjectMacros: (i: number) => void
  onInjectHydration: (i: number) => void
  onInjectAll: (i: number) => void
  hasMacroResult: boolean
  hasHydration: boolean
  coherenceScore: CoherenceScoreData
  shareIssues?: StudioShareIssue[]
  loading?: boolean
  trainingWeekSchedule?: TrainingWeekSchedule | null
  selectedScheduleDow?: number | null
  onSelectScheduleDow?: (dow: number) => void
  scheduleSlots: ScheduleSlotDraft[]
  onScheduleSlotsChange: (slots: ScheduleSlotDraft[]) => void
}

function NumberField({ label, value, onChange, unit }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/45">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="w-16 rounded-md bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[11px] text-white text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
        />
        {unit && <span className="text-[9px] text-white/30 w-5">{unit}</span>}
      </div>
    </div>
  )
}

export default function ProtocolCanvas({
  protocolName, onProtocolNameChange,
  days, activeDayIndex, onActiveDayChange,
  onUpdateDay, onAddDay, onRemoveDay,
  onInjectMacros, onInjectHydration, onInjectAll,
  hasMacroResult, hasHydration,
  coherenceScore,
  shareIssues = [],
  loading = false,
  trainingWeekSchedule = null,
  selectedScheduleDow = null,
  onSelectScheduleDow,
  scheduleSlots,
  onScheduleSlotsChange,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(protocolName)
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null)
  const [tempDayName, setTempDayName] = useState('')
  const [openInfoModal, setOpenInfoModal] = useState<string | null>(null)
  const activeDay = days[activeDayIndex]

  if (loading) {
    return (
      <div className="h-full flex flex-col animate-pulse">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
          <div className="h-3.5 w-36 rounded bg-white/[0.06]" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
            <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
            <div className="h-2.5 w-20 rounded bg-white/[0.06]" />
          </div>
          {/* Coherence score bar */}
          <div className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-3 space-y-2">
            <div className="flex justify-between">
              <div className="h-2.5 w-20 rounded bg-white/[0.05]" />
              <div className="h-2.5 w-10 rounded bg-white/[0.06]" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06]" />
            <div className="grid grid-cols-5 gap-1">
              {[1,2,3,4,5].map(i => <div key={i} className="h-2 rounded bg-white/[0.04]" />)}
            </div>
          </div>
          {/* Day cards grid */}
          <div>
            <div className="h-2 w-24 rounded bg-white/[0.04] mb-2" />
            <div className="grid grid-cols-2 gap-2">
              {[1,2].map(i => (
                <div key={i} className="rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] p-3 space-y-2">
                  <div className="h-2.5 w-24 rounded bg-white/[0.06]" />
                  <div className="h-3.5 w-16 rounded bg-white/[0.05]" />
                  <div className="h-[3px] w-full rounded-full bg-white/[0.06]" />
                  <div className="flex gap-1">
                    {[1,2,3].map(j => <div key={j} className="h-2 flex-1 rounded bg-white/[0.04]" />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Active day editor */}
          <div className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-4 space-y-3">
            <div className="h-3 w-28 rounded bg-white/[0.05]" />
            {/* Inject button */}
            <div className="h-10 w-full rounded-xl bg-white/[0.05]" />
            <div className="flex gap-2">
              <div className="h-8 flex-1 rounded-lg bg-white/[0.04]" />
              <div className="h-8 flex-1 rounded-lg bg-white/[0.04]" />
            </div>
            {/* Manual fields */}
            <div className="space-y-1.5 pt-1">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-2.5 w-16 rounded bg-white/[0.04]" />
                  <div className="h-6 w-20 rounded-md bg-white/[0.05]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Protocol name */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onProtocolNameChange(tempName); setEditingName(false) }
                if (e.key === 'Escape') { setTempName(protocolName); setEditingName(false) }
              }}
              className="flex-1 rounded-lg bg-white/[0.04] border-[0.3px] border-[#1f8a65]/40 px-3 py-1 text-[13px] font-semibold text-white outline-none"
            />
            <button onClick={() => { onProtocolNameChange(tempName); setEditingName(false) }}>
              <Check size={14} className="text-[#1f8a65]" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setTempName(protocolName); setEditingName(true) }}
            className="flex items-center gap-2 group"
          >
            <span className="text-[13px] font-semibold text-white">{protocolName}</span>
            <Pencil size={11} className="text-white/25 group-hover:text-[#1f8a65] transition-colors" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 p-4 pb-40">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 text-[10px] font-semibold text-white/50">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-[#1f8a65]" />
            <span>Paramètres</span>
          </div>
          <span>|</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-[#1f8a65]" />
            <span>Calcul</span>
          </div>
          <span>|</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border-[1px] border-[#1f8a65] bg-[#1f8a65]/20" />
            <span className="text-[#1f8a65]">Protocole</span>
          </div>
        </div>

        {/* Coherence Score */}
        <CoherenceScore coherence={coherenceScore} />

        {shareIssues.length > 0 && (
          <div className="space-y-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Partage
            </p>
            <div className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
              {shareIssues.map((issue, index) => (
                <div key={`${issue.severity}-${index}`} className="flex items-start gap-2">
                  {issue.severity === 'blocking' ? (
                    <X size={12} className="mt-0.5 shrink-0 text-red-400" />
                  ) : (
                    <Info size={12} className="mt-0.5 shrink-0 text-amber-400" />
                  )}
                  <p className={`text-[10px] leading-relaxed ${issue.severity === 'blocking' ? 'text-red-300/85' : 'text-amber-300/80'}`}>
                    {issue.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <TrainingWeekSchedulePanel
          schedule={trainingWeekSchedule}
          loading={loading}
          protocolDayNames={days.map((d) => d.name)}
          activeDow={selectedScheduleDow}
          onSelectDow={onSelectScheduleDow}
        />

        <ProtocolScheduleHeatmap
          days={days}
          activeDayIndex={activeDayIndex}
          scheduleSlots={scheduleSlots}
          onScheduleSlotsChange={onScheduleSlotsChange}
          trainingWeekSchedule={trainingWeekSchedule}
        />

        {/* Day cards overview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Jours du protocole
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {days.map((day, i) => {
              const cal = Number(day.calories) || 0
              const p = Number(day.protein_g) || 0
              const f = Number(day.fat_g) || 0
              const c = Number(day.carbs_g) || 0
              const isActive = i === activeDayIndex
              return (
                <button
                  key={day.localId}
                  onClick={() => onActiveDayChange(i)}
                  className={`relative rounded-xl p-3 border-[0.3px] text-left transition-all ${
                    isActive
                      ? 'bg-[#1f8a65]/[0.08] border-[#1f8a65]/30'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveDay(i) }}
                    className="absolute top-1.5 right-1.5 text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                  <p className="text-[10px] font-medium text-white/80 leading-tight pr-3">{day.name}</p>
                  {cal > 0 ? (
                    <>
                      <p className="text-[12px] font-bold text-white mt-1">{cal} <span className="text-[9px] font-normal text-white/40">kcal</span></p>
                      <p className="text-[9px] text-white/40 mt-0.5">P{p}·L{f}·G{c}</p>
                      <div className="mt-2">
                        <MacroBar calories={cal} protein_g={p} carbs_g={c} fat_g={f} height={3} />
                      </div>
                    </>
                  ) : (
                    <p className="text-[9px] text-white/25 mt-1">Non configuré</p>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => onAddDay()}
            className="w-full py-2 rounded-xl bg-white/[0.02] border-[0.3px] border-dashed border-white/[0.08] text-[10px] text-white/35 hover:text-white/60 hover:border-white/20 transition-all flex items-center justify-center gap-1"
          >
            <Plus size={11} /> Ajouter un jour
          </button>
        </div>

        {/* Active day editor */}
        {activeDay && (
          <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
              {editingDayIndex === activeDayIndex ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    value={tempDayName}
                    onChange={e => setTempDayName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        onUpdateDay(activeDayIndex, { name: tempDayName })
                        setEditingDayIndex(null)
                      }
                      if (e.key === 'Escape') {
                        setEditingDayIndex(null)
                      }
                    }}
                    className="flex-1 rounded-lg bg-white/[0.04] border-[0.3px] border-[#1f8a65]/40 px-2 py-1 text-[11px] font-semibold text-white outline-none"
                  />
                  <button
                    onClick={() => {
                      onUpdateDay(activeDayIndex, { name: tempDayName })
                      setEditingDayIndex(null)
                    }}
                    className="text-[#1f8a65] hover:text-[#217356]"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-white">{activeDay.name}</p>
                  <button
                    onClick={() => {
                      setTempDayName(activeDay.name)
                      setEditingDayIndex(activeDayIndex)
                    }}
                    className="text-white/25 hover:text-white/60 transition-colors"
                  >
                    <Pencil size={10} />
                  </button>
                </>
              )}
            </div>

            {/* Injection buttons */}
            <div className="space-y-2">

              {/* Bouton principal — Tous les calculs (macros + hydratation) */}
              {(hasMacroResult || hasHydration) && (
                <button
                  onClick={() => onInjectAll(activeDayIndex)}
                  className="w-full h-10 rounded-xl bg-[#1f8a65] text-white text-[11px] font-bold hover:bg-[#217356] active:scale-[0.98] transition-all flex items-center justify-between px-4"
                >
                  <span>Appliquer les paramètres</span>
                  <button
                    onClick={e => { e.stopPropagation(); setOpenInfoModal('allCalculations') }}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.1] hover:bg-white/[0.2]"
                  >
                    <Info size={12} />
                  </button>
                </button>
              )}

            </div>

            {/* Manual fine-tune */}
            <div>
              <p className="text-[9px] text-white/30 mb-1">Ajustement manuel</p>
              <div className="space-y-0.5">
                <NumberField label="Calories" value={activeDay.calories} unit="kcal"
                  onChange={v => onUpdateDay(activeDayIndex, { calories: v })} />
                <NumberField label="Protéines" value={activeDay.protein_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { protein_g: v })} />
                <NumberField label="Lipides" value={activeDay.fat_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { fat_g: v })} />
                <NumberField label="Glucides" value={activeDay.carbs_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { carbs_g: v })} />
                <NumberField label="Hydratation" value={activeDay.hydration_ml} unit="ml"
                  onChange={v => onUpdateDay(activeDayIndex, { hydration_ml: v })} />
              </div>
            </div>

            {/* Live macro bar for active day */}
            {activeDay.calories && (
              <MacroBar
                calories={Number(activeDay.calories)}
                protein_g={Number(activeDay.protein_g) || 0}
                carbs_g={Number(activeDay.carbs_g) || 0}
                fat_g={Number(activeDay.fat_g) || 0}
                height={5}
                showLabels
              />
            )}

            {/* Recommendations */}
            <div>
              <p className="text-[9px] text-white/30 mb-1">Notes / recommandations</p>
              <textarea
                value={activeDay.recommendations}
                onChange={e => onUpdateDay(activeDayIndex, { recommendations: e.target.value })}
                placeholder="Conseils pour ce jour..."
                rows={2}
                className="w-full rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 py-2 text-[11px] text-white/70 placeholder:text-white/20 outline-none resize-none focus:border-[#1f8a65]/40"
              />
            </div>
          </div>
        )}
      </div>


      {/* Info modals */}
      {openInfoModal && INJECTION_INFO_MODALS[openInfoModal as keyof typeof INJECTION_INFO_MODALS] && (
        <InfoModal
          isOpen={true}
          title={INJECTION_INFO_MODALS[openInfoModal as keyof typeof INJECTION_INFO_MODALS].title}
          description={INJECTION_INFO_MODALS[openInfoModal as keyof typeof INJECTION_INFO_MODALS].description}
          example={INJECTION_INFO_MODALS[openInfoModal as keyof typeof INJECTION_INFO_MODALS].example}
          whenToUse={INJECTION_INFO_MODALS[openInfoModal as keyof typeof INJECTION_INFO_MODALS].whenToUse}
          onClose={() => setOpenInfoModal(null)}
        />
      )}
    </div>
  )
}
