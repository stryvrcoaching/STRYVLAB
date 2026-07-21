// components/programs/studio/EditorPane.tsx
'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Plus, AlertCircle, CalendarDays, Check, ChevronDown, ChevronUp, Clock3, Copy, Layers, Repeat2, Weight } from 'lucide-react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import ExerciseCard, { type ExerciseData } from './ExerciseCard'
import { MorphoBiomechIndicators } from '@/components/morpho/MorphoBiomechIndicators'
import { isMorphoV2, type BiomechMovementPattern, type PatternVerdict } from '@/lib/morpho/types'
import { buildVerdictMap, computeCoherence } from '@/lib/morpho/exerciseCoherence'
import { extractMorphoTraits, type MorphoTraits } from '@/lib/morpho/morphoTraits'
import type { IntelligenceResult, IntelligenceAlert } from '@/lib/programs/intelligence'
import { getSessionsPerWeek, getTrainingDaysPerWeek } from '@/lib/programs/frequency'
import { estimateSessionDurationMin } from '@/lib/training/sessionDuration'
import { parseRepsRange } from '@/lib/progression/double-progression'

const GOALS = [
  { value: 'hypertrophy', label: 'Hypertrophie' },
  { value: 'strength', label: 'Force' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'fat_loss', label: 'Perte de gras' },
  { value: 'recomp', label: 'Recomposition' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'athletic', label: 'Athletic' },
]

const LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
  { value: 'elite', label: 'Élite' },
]

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const EQUIPMENT_ARCHETYPES = [
  { value: '', label: '— Non spécifié —' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'home_dumbbells', label: 'Domicile — Haltères' },
  { value: 'home_full', label: 'Domicile — Complet' },
  { value: 'home_rack', label: 'Rack à domicile' },
  { value: 'functional_box', label: 'Box / Fonctionnel' },
  { value: 'commercial_gym', label: 'Salle de sport' },
]

function resolveEstimatedReps(value: string | null | undefined): number {
  const parsed = parseRepsRange(value ?? '')
  if (parsed) return Math.round((parsed.rep_min + parsed.rep_max) / 2)
  const numericValue = Number.parseFloat(String(value ?? '').replace(',', '.'))
  return Number.isFinite(numericValue) && numericValue > 0 ? Math.round(numericValue) : 0
}

function formatEstimatedVolume(volumeKg: number): string {
  if (volumeKg >= 1000) {
    return `${(volumeKg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} t`
  }
  return `${Math.round(volumeKg).toLocaleString('fr-FR')} kg`
}

function summarizeSession(exercises: ExerciseData[], goal: string) {
  let totalSets = 0
  let totalReps = 0
  let estimatedVolumeKg = 0
  let loadedSets = 0
  let strengthSets = 0

  exercises.forEach(exercise => {
    const setCount = Math.max(0, Math.floor(Number(exercise.sets ?? 0)))
    totalSets += setCount
    if (exercise.execution_type && exercise.execution_type !== 'reps_rir') return

    strengthSets += setCount
    const weightKg = Number(exercise.current_weight_kg ?? 0)
    for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
      const reps = resolveEstimatedReps(
        exercise.set_prescriptions?.[setIndex]?.reps ?? exercise.reps,
      )
      totalReps += reps
      if (weightKg > 0 && reps > 0) {
        estimatedVolumeKg += weightKg * reps
        loadedSets += 1
      }
    }
  })

  return {
    durationMin: exercises.length > 0 ? estimateSessionDurationMin(exercises, goal) : 0,
    totalSets,
    totalReps,
    estimatedVolumeKg,
    partialVolume: estimatedVolumeKg > 0 && loadedSets < strengthSets,
  }
}

function HeaderMetric({ icon, value, label, title }: {
  icon: ReactNode
  value: string
  label: string
  title?: string
}) {
  return (
    <span
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.035] px-2 text-[9px] text-white/40"
      title={title}
      aria-label={`${label} : ${value}`}
    >
      <span className="text-[#1f8a65]">{icon}</span>
      <span className="font-mono font-semibold tabular-nums text-white/75">{value}</span>
    </span>
  )
}

function SessionDayPicker({ selectedDays, onChange }: {
  selectedDays: number[]
  onChange: (days: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const sortedDays = [...selectedDays].sort((a, b) => a - b)
  const buttonLabel = sortedDays.length === 0
    ? 'Jours'
    : sortedDays.length === 1
      ? DAYS[sortedDays[0] - 1]
      : `${DAYS[sortedDays[0] - 1]} +${sortedDays.length - 1}`

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'inline-flex h-7 min-w-[68px] items-center justify-center gap-1.5 rounded-md border-[0.3px] px-2 text-[9px] font-semibold transition-colors',
          sortedDays.length > 0
            ? 'border-[#1f8a65]/25 bg-[#1f8a65]/10 text-[#1f8a65]'
            : 'border-white/[0.06] bg-white/[0.03] text-white/40 hover:text-white/65',
        ].join(' ')}
      >
        <CalendarDays size={11} aria-hidden="true" />
        {buttonLabel}
        <ChevronDown size={9} className={open ? 'rotate-180' : ''} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Jours de la séance"
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border-[0.3px] border-white/[0.08] bg-[#181818] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          {DAYS_FULL.map((day, index) => {
            const dayNumber = index + 1
            const active = sortedDays.includes(dayNumber)
            return (
              <button
                key={day}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                onClick={() => onChange(
                  active
                    ? sortedDays.filter(value => value !== dayNumber)
                    : [...sortedDays, dayNumber].sort((a, b) => a - b),
                )}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] text-white/55 hover:bg-white/[0.04] hover:text-white/80"
              >
                {day}
                <span className={active ? 'text-[#1f8a65]' : 'text-white/15'}>
                  <Check size={12} aria-hidden="true" />
                </span>
              </button>
            )
          })}
          {sortedDays.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t-[0.3px] border-white/[0.06] px-2.5 pt-2 text-left text-[9px] text-white/30 hover:text-white/55"
            >
              Effacer la sélection
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export interface TemplateMeta {
  name: string
  description: string
  goal: string
  level: string
  frequency: number
  weeks: number
  notes: string
  equipment_archetype: string
  muscle_tags: string[]
  session_mode: 'day' | 'cycle'
}

export interface EditorSession {
  name: string
  day_of_week: number | null
  days_of_week: number[]
  notes: string
  exercises: ExerciseData[]
  open: boolean
}

interface Props {
  meta: TemplateMeta
  sessions: EditorSession[]
  error: string
  uploadingKey: string | null
  highlightKey: string | null
  intelligenceResult: IntelligenceResult | null
  morphoConnected: boolean
  morphoDate?: string
  templateId?: string
  alertsFor: (si: number, ei: number) => IntelligenceAlert[]
  sessionMode: 'day' | 'cycle'
  onMetaChange: (patch: Partial<TemplateMeta>) => void
  onSessionModeChange: (mode: 'day' | 'cycle') => void
  onUpdateSession: (si: number, patch: Partial<EditorSession>) => void
  onUpdateExercise: (si: number, ei: number, patch: Partial<ExerciseData>) => void
  onRemoveExercise: (si: number, ei: number) => void
  onAddExercise: (si: number) => void
  onDuplicateSession: (si: number) => void
  onRemoveSession: (si: number) => void
  onAddSession: () => void
  onImageUpload: (si: number, ei: number, file: File) => void
  onPickExercise: (si: number, ei: number) => void
  onPickExerciseForAlternative: (si: number, ei: number, addFn: (name: string) => Promise<void>) => void
  onOpenAlternatives: (si: number, ei: number) => void
  onToggleSuperset: (si: number, ei: number) => void
  onMoveSession: (fromSi: number, toSi: number) => void
  onMoveExercise: (fromSi: number, fromEi: number, toSi: number, toEi: number) => void
  supersetGroupColors: Record<string, string>
  programId?: string
  exerciseRefSetter: (key: string) => (el: HTMLDivElement | null) => void
  makeExDragId: (si: number, ei: number) => string
  sessionDropId: (si: number) => string
  clientId?: string
  selectedExercises: { si: number; ei: number }[]
  onToggleSelectExercise: (si: number, ei: number) => void
  onAddPatternClick: (si: number) => void
}

export default function EditorPane({
  meta,
  sessions,

  error,
  uploadingKey,
  highlightKey,
  intelligenceResult,
  morphoConnected,
  morphoDate,
  templateId,
  alertsFor,
  sessionMode,
  onMetaChange,
  onSessionModeChange,
  onUpdateSession,
  onUpdateExercise,
  onRemoveExercise,
  onAddExercise,
  onDuplicateSession,
  onRemoveSession,
  onAddSession,
  onImageUpload,
  onPickExercise,
  onPickExerciseForAlternative,
  onOpenAlternatives,
  onToggleSuperset,
  onMoveSession,
  onMoveExercise,
  supersetGroupColors,
  programId,
  exerciseRefSetter,
  makeExDragId,
  sessionDropId,
  clientId,
  selectedExercises,
  onToggleSelectExercise,
  onAddPatternClick,
}: Props) {
  type TrendEntry = { trend: 'progression' | 'stagnation' | 'overtraining' | null; suggestion: string | null }
  const [trendMap, setTrendMap] = useState<Record<string, TrendEntry>>({})

  // Morpho coherence — fetch latest analysis once per client (verdicts + traits)
  const [verdictMap, setVerdictMap] = useState<Map<BiomechMovementPattern, PatternVerdict> | null>(null)
  const [morphoTraits, setMorphoTraits] = useState<MorphoTraits | null>(null)
  useEffect(() => {
    if (!clientId) { setVerdictMap(null); setMorphoTraits(null); return }
    let alive = true
    fetch(`/api/clients/${clientId}/morpho/analyses?limit=1&offset=0`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        const result = d.analyses?.[0]?.analysis_result
        if (result && isMorphoV2(result)) {
          setVerdictMap(buildVerdictMap(result.biomech.pattern_verdicts ?? []))
          setMorphoTraits(extractMorphoTraits(result))
        }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [clientId])

  const fetchTrend = useCallback(async (exerciseName: string) => {
    if (!clientId || !exerciseName.trim()) return
    if (exerciseName in trendMap) return
    try {
      const res = await fetch(
        `/api/clients/${clientId}/performance/${encodeURIComponent(exerciseName)}`
      )
      if (!res.ok) return
      const data = await res.json()
      setTrendMap(prev => ({ ...prev, [exerciseName]: { trend: data.trend, suggestion: data.suggestion } }))
    } catch {
      // non-blocking
    }
  }, [clientId, trendMap])

  useEffect(() => {
    if (!clientId) return
    const names = sessions.flatMap(s => s.exercises.map(e => e.name)).filter(n => n.trim())
    const unique = Array.from(new Set(names))
    unique.forEach(name => fetchTrend(name))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, sessions])

  const presentPatterns = Array.from(new Set(
    sessions.flatMap(s => s.exercises.map(e => e.movement_pattern).filter((p): p is string => !!p))
  ))

  const scheduledSessionCount = getSessionsPerWeek(sessions)
  const trainingDays = getTrainingDaysPerWeek(sessions)

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#121212]">
      {/* Sticky sub-header: template meta + save button */}
      <div className="shrink-0 border-b-[0.3px] border-white/[0.06] px-6 py-3 space-y-3">
        {/* Name */}
        <input
          value={meta.name}
          onChange={e => onMetaChange({ name: e.target.value })}
          placeholder="Nom du template..."
          className="w-full bg-transparent text-[15px] font-semibold text-white placeholder:text-white/20 outline-none"
        />

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={meta.goal}
            onChange={e => onMetaChange({ goal: e.target.value })}
            className="h-7 rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none min-w-0"
          >
            {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select
            value={meta.level}
            onChange={e => onMetaChange({ level: e.target.value })}
            className="h-7 rounded-lg bg-[#0a0a0a] border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-2 outline-none min-w-0"
          >
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <div className="flex items-center gap-1 shrink-0" title="Calculé automatiquement selon le nombre de séances">
            <span className="w-9 h-7 bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/50 flex items-center justify-center font-mono">
              {meta.frequency}
            </span>
            <span className="text-[10px] text-white/30 whitespace-nowrap">séances/sem</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              value={meta.weeks}
              onChange={e => onMetaChange({ weeks: Number(e.target.value) || 1 })}
              min={1} max={52}
              className="w-9 h-7 bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/70 px-1 outline-none font-mono text-center"
            />
            <span className="text-[10px] text-white/30 whitespace-nowrap">sem.</span>
          </div>

          {/* Session mode toggle */}
          <div className="flex items-center rounded-lg overflow-hidden border-[0.3px] border-white/[0.06] shrink-0">
            {(['day', 'cycle'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => onSessionModeChange(mode)}
                className={[
                  'h-7 px-3 text-[10px] font-semibold transition-colors',
                  sessionMode === mode
                    ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]',
                ].join(' ')}
              >
                {mode === 'day' ? 'Jours' : 'Cycle'}
              </button>
            ))}
          </div>

          {/* Morpho biomech indicators — pushed to the right */}
          {clientId && (
            <div className="ml-auto">
              <MorphoBiomechIndicators clientId={clientId} variant="compact" />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border-[0.3px] border-red-500/20 px-3 py-2">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Sessions + exercises scroll area */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pt-4 pb-40 space-y-4">
        {sessions.map((session, si) => {
          const summary = summarizeSession(session.exercises, meta.goal)
          const volumeValue = summary.estimatedVolumeKg > 0
            ? `${summary.partialVolume ? '≥' : '~'}${formatEstimatedVolume(summary.estimatedVolumeKg)}`
            : '—'

          return (
            <div
              key={si}
              className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.01]"
            >
            {/* Session header */}
            <div
              className={[
                'flex flex-wrap items-center gap-2 rounded-t-[11px] border-b-[0.3px] border-white/[0.06] bg-[#181818] px-3 py-2.5',
                session.open ? 'sticky top-0 z-20 shadow-[0_10px_24px_rgba(0,0,0,0.28)]' : '',
              ].join(' ')}
            >
              <button
                onClick={() => onUpdateSession(si, { open: !session.open })}
                className="p-0.5 text-white/30 hover:text-white/60 transition-colors"
              >
                {session.open
                  ? <ChevronUp size={14} />
                  : <ChevronDown size={14} />
                }
              </button>
              {/* Up/down arrows in cycle mode */}
              {sessionMode === 'cycle' && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => onMoveSession(si, si - 1)}
                    disabled={si === 0}
                    className="p-0.5 rounded text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp size={10} />
                  </button>
                  <button
                    onClick={() => onMoveSession(si, si + 1)}
                    disabled={si === sessions.length - 1}
                    className="p-0.5 rounded text-white/20 hover:text-white/60 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown size={10} />
                  </button>
                </div>
              )}
              <input
                value={session.name}
                onChange={e => onUpdateSession(si, { name: e.target.value })}
                placeholder={`Séance ${si + 1}`}
                className="min-w-[120px] flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/30 outline-none"
              />

              {session.open && (
                <div className="flex items-center gap-1">
                  <HeaderMetric
                    icon={<Clock3 size={10} />}
                    value={summary.durationMin > 0 ? `~${summary.durationMin} min` : '—'}
                    label="durée"
                    title="Durée estimée avec tempo, repos et transitions"
                  />
                  <HeaderMetric
                    icon={<Layers size={10} />}
                    value={`${summary.totalSets} sér.`}
                    label="séries"
                  />
                  <HeaderMetric
                    icon={<Repeat2 size={10} />}
                    value={`${summary.totalReps} reps`}
                    label="reps"
                    title="Répétitions estimées à partir du milieu de chaque plage"
                  />
                  <HeaderMetric
                    icon={<Weight size={10} />}
                    value={volumeValue}
                    label="volume"
                    title={
                      summary.partialVolume
                        ? 'Tonnage partiel : certaines charges courantes ne sont pas encore disponibles'
                        : 'Tonnage estimé : charge courante × répétitions prévues'
                    }
                  />
                </div>
              )}

              {/* Compact multi-select (day mode only) */}
              {sessionMode === 'day' && (
                <SessionDayPicker
                  selectedDays={session.days_of_week ?? []}
                  onChange={days => onUpdateSession(si, {
                    days_of_week: days,
                    day_of_week: days[0] ?? null,
                  })}
                />
              )}
              {/* Cycle badge */}
              {sessionMode === 'cycle' && (
                <span className="text-[10px] font-mono text-white/25 shrink-0">
                  S{si + 1}
                </span>
              )}
              <button
                type="button"
                onClick={() => onDuplicateSession(si)}
                className="p-1.5 rounded-lg text-white/25 hover:text-[#1f8a65] hover:bg-[#1f8a65]/10 transition-colors"
                aria-label={`Dupliquer ${session.name || `la séance ${si + 1}`}`}
                title="Dupliquer la séance"
              >
                <Copy size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveSession(si)}
                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors text-[11px]"
                aria-label={`Supprimer ${session.name || `la séance ${si + 1}`}`}
                title="Supprimer la séance"
              >
                ×
              </button>
            </div>

            {/* Exercises */}
            {session.open && (
              <DroppableSession id={sessionDropId(si)} className="p-4 space-y-3">
                <SortableContext
                  items={session.exercises.map((_, ei) => makeExDragId(si, ei))}
                  strategy={verticalListSortingStrategy}
                >
                  {session.exercises.map((ex, ei) => {
                    const groupIndices = ex.group_id
                      ? session.exercises.reduce<number[]>((indices, exercise, index) => {
                          if (exercise.group_id === ex.group_id) indices.push(index)
                          return indices
                        }, [])
                      : [ei]
                    const blockStart = groupIndices[0]
                    const blockEnd = groupIndices[groupIndices.length - 1]
                    const previousInSameGroup = !!(
                      ex.group_id && session.exercises[ei - 1]?.group_id === ex.group_id
                    )
                    const nextInSameGroup = !!(
                      ex.group_id && session.exercises[ei + 1]?.group_id === ex.group_id
                    )

                    return (
                      <ExerciseCard
                        key={ei}
                        dragId={makeExDragId(si, ei)}
                        exercise={ex}
                        si={si}
                        ei={ei}
                        isHighlighted={highlightKey === `${si}-${ei}`}
                        isUploading={uploadingKey === `${si}-${ei}`}
                        alerts={alertsFor(si, ei)}
                        templateId={templateId}
                        supersetGroupColor={ex.group_id ? supersetGroupColors[ex.group_id] : undefined}
                        groupSize={groupIndices.length}
                        previousInSameGroup={previousInSameGroup}
                        nextInSameGroup={nextInSameGroup}
                        onUpdate={patch => onUpdateExercise(si, ei, patch)}
                        onRemove={() => onRemoveExercise(si, ei)}
                        onImageUpload={file => onImageUpload(si, ei, file)}
                        onPickExercise={() => onPickExercise(si, ei)}
                        onPickExerciseForAlternative={addFn => onPickExerciseForAlternative(si, ei, addFn)}
                        onOpenAlternatives={() => onOpenAlternatives(si, ei)}
                        onToggleSuperset={() => onToggleSuperset(si, ei)}
                        exerciseRef={exerciseRefSetter(`${si}-${ei}`)}
                        isFirst={si === 0 && blockStart === 0}
                        isLast={si === sessions.length - 1 && blockEnd === session.exercises.length - 1}
                        performanceTrend={trendMap[ex.name]?.trend ?? null}
                        performanceSuggestion={trendMap[ex.name]?.suggestion ?? null}
                        morphoCoherence={(verdictMap || morphoTraits) ? computeCoherence(ex, verdictMap, morphoTraits) : undefined}
                        isSelected={selectedExercises.some(s => s.si === si && s.ei === ei)}
                        onToggleSelect={() => onToggleSelectExercise(si, ei)}
                        clientId={clientId}
                        onMoveUp={() => {
                          if (blockStart > 0) {
                            const previousExercise = session.exercises[blockStart - 1]
                            const previousBlockStart = previousExercise.group_id
                              ? session.exercises.findIndex(
                                  item => item.group_id === previousExercise.group_id,
                                )
                              : blockStart - 1
                            onMoveExercise(si, ei, si, previousBlockStart)
                          } else if (si > 0) {
                            onMoveExercise(
                              si,
                              ei,
                              si - 1,
                              sessions[si - 1].exercises.length,
                            )
                          }
                        }}
                        onMoveDown={() => {
                          if (blockEnd < session.exercises.length - 1) {
                            const nextExercise = session.exercises[blockEnd + 1]
                            const nextBlockEnd = nextExercise.group_id
                              ? session.exercises.reduce(
                                  (lastIndex, item, index) =>
                                    item.group_id === nextExercise.group_id
                                      ? index
                                      : lastIndex,
                                  blockEnd + 1,
                                )
                              : blockEnd + 1
                            onMoveExercise(si, ei, si, nextBlockEnd)
                          } else if (si < sessions.length - 1) {
                            onMoveExercise(si, ei, si + 1, 0)
                          }
                        }}
                      />
                    )
                  })}
                </SortableContext>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAddExercise(si)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-[0.3px] border-dashed border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/[0.15] transition-colors text-[11px]"
                  >
                    <Plus size={12} />
                    Ajouter un exercice
                  </button>
                  <button
                    onClick={() => onAddPatternClick(si)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-[0.3px] border-dashed border-white/[0.08] text-[#1f8a65]/70 hover:text-[#1f8a65] hover:border-[#1f8a65]/40 transition-colors text-[11px]"
                  >
                    <Layers size={12} />
                    Ajouter un pattern
                  </button>
                </div>
              </DroppableSession>
            )}
            </div>
          )
        })}

        {/* Add session */}
        <button
          onClick={onAddSession}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-[0.3px] border-dashed border-white/[0.06] text-white/25 hover:text-white/50 hover:border-white/[0.12] transition-colors text-[12px]"
        >
          <Plus size={13} />
          Ajouter une séance
        </button>

      </div>
    </div>
  )
}

function DroppableSession({
  id, children, className,
}: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className={className}>{children}</div>
}
