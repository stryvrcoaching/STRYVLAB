// components/programs/studio/EditorPane.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import ExerciseCard, { type ExerciseData } from './ExerciseCard'
import { MorphoBiomechIndicators } from '@/components/morpho/MorphoBiomechIndicators'
import { isMorphoV2, type BiomechMovementPattern, type PatternVerdict } from '@/lib/morpho/types'
import { buildVerdictMap, computeCoherence } from '@/lib/morpho/exerciseCoherence'
import { extractMorphoTraits, type MorphoTraits } from '@/lib/morpho/morphoTraits'
import type { IntelligenceResult, IntelligenceAlert } from '@/lib/programs/intelligence'
import { getSessionsPerWeek, getTrainingDaysPerWeek } from '@/lib/programs/frequency'

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

const EQUIPMENT_ARCHETYPES = [
  { value: '', label: '— Non spécifié —' },
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'home_dumbbells', label: 'Domicile — Haltères' },
  { value: 'home_full', label: 'Domicile — Complet' },
  { value: 'home_rack', label: 'Rack à domicile' },
  { value: 'functional_box', label: 'Box / Fonctionnel' },
  { value: 'commercial_gym', label: 'Salle de sport' },
]

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
        {sessions.map((session, si) => (
          <div
            key={si}
            className="rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.01] overflow-hidden"
          >
            {/* Session header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b-[0.3px] border-white/[0.06]">
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
                className="flex-1 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/30 outline-none"
              />
              {/* Day of week pills — multi-select (day mode only) */}
              {sessionMode === 'day' && (
                <div className="flex items-center gap-1">
                  {DAYS.map((d, idx) => {
                    const dow = idx + 1
                    const active = (session.days_of_week ?? []).includes(dow)
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const current = session.days_of_week ?? []
                          const next = active
                            ? current.filter(x => x !== dow)
                            : [...current, dow].sort((a, b) => a - b)
                          onUpdateSession(si, { days_of_week: next, day_of_week: next[0] ?? null })
                        }}
                        className={[
                          'w-7 h-7 rounded-md text-[9px] font-medium transition-colors',
                          active
                            ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                            : 'text-white/25 hover:text-white/50 hover:bg-white/[0.04]',
                        ].join(' ')}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
              {/* Cycle badge */}
              {sessionMode === 'cycle' && (
                <span className="text-[10px] font-mono text-white/25 shrink-0">
                  S{si + 1}
                </span>
              )}
              <button
                onClick={() => onRemoveSession(si)}
                className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors text-[11px]"
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
                  {session.exercises.map((ex, ei) => (
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
                      groupSize={ex.group_id ? session.exercises.filter(e => e.group_id === ex.group_id).length : undefined}
                      nextInSameGroup={!!(ex.group_id && session.exercises[ei + 1]?.group_id === ex.group_id)}
                      onUpdate={patch => onUpdateExercise(si, ei, patch)}
                      onRemove={() => onRemoveExercise(si, ei)}
                      onImageUpload={file => onImageUpload(si, ei, file)}
                      onPickExercise={() => onPickExercise(si, ei)}
                      onPickExerciseForAlternative={addFn => onPickExerciseForAlternative(si, ei, addFn)}
                      onOpenAlternatives={() => onOpenAlternatives(si, ei)}
                      onToggleSuperset={() => onToggleSuperset(si, ei)}
                      exerciseRef={exerciseRefSetter(`${si}-${ei}`)}
                      isFirst={si === 0 && ei === 0}
                      isLast={si === sessions.length - 1 && ei === session.exercises.length - 1}
                      performanceTrend={trendMap[ex.name]?.trend ?? null}
                      performanceSuggestion={trendMap[ex.name]?.suggestion ?? null}
                      morphoCoherence={(verdictMap || morphoTraits) ? computeCoherence(ex, verdictMap, morphoTraits) : undefined}
                      isSelected={selectedExercises.some(s => s.si === si && s.ei === ei)}
                      onToggleSelect={() => onToggleSelectExercise(si, ei)}
                      clientId={clientId}
                      onMoveUp={() => {
                        if (ei > 0) {
                          onMoveExercise(si, ei, si, ei - 1)
                        } else if (si > 0) {
                          const prevSessionExCount = sessions[si - 1].exercises.length
                          onMoveExercise(si, ei, si - 1, prevSessionExCount)
                        }
                      }}
                      onMoveDown={() => {
                        if (ei < session.exercises.length - 1) {
                          onMoveExercise(si, ei, si, ei + 1)
                        } else if (si < sessions.length - 1) {
                          onMoveExercise(si, ei, si + 1, 0)
                        }
                      }}
                    />
                  ))}
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
        ))}

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
