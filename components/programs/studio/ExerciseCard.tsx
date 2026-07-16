// components/programs/studio/ExerciseCard.tsx
'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import { calculateHRZones } from '@/lib/formulas'
import Image from 'next/image'
import {
  Trash2,
  Upload,
  Library,
  Link2,
  Link2Off,
  ChevronUp,
  ChevronDown,
  GripVertical,
  CheckSquare,
  Square,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import IntelligenceAlertBadge from '@/components/programs/IntelligenceAlertBadge'
import ExerciseClientAlternatives, { type ExerciseClientAlternativesHandle } from '@/components/programs/ExerciseClientAlternatives'
import { MorphoCoherenceBadge } from '@/components/morpho/MorphoCoherenceBadge'
import type { IntelligenceAlert } from '@/lib/programs/intelligence'
import type { CoherenceResult } from '@/lib/morpho/exerciseCoherence'
import {
  applyDefaultFieldToSetPrescriptions,
  normalizeSetPrescriptions,
  type PlannedSetType,
  type SetPrescription,
} from '@/lib/programs/setPrescriptions'

const MOVEMENT_PATTERNS = [
  { value: '', label: '— Pattern —' },
  { value: 'horizontal_push', label: 'Poussée horizontale' },
  { value: 'vertical_push', label: 'Poussée verticale' },
  { value: 'horizontal_pull', label: 'Tirage horizontal' },
  { value: 'vertical_pull', label: 'Tirage vertical' },
  { value: 'squat_pattern', label: 'Pattern squat' },
  { value: 'hip_hinge', label: 'Charnière hanche' },
  { value: 'knee_flexion', label: 'Flexion genou' },
  { value: 'knee_extension', label: 'Extension genou' },
  { value: 'calf_raise', label: 'Extension mollets' },
  { value: 'elbow_flexion', label: 'Flexion coude (Biceps)' },
  { value: 'elbow_extension', label: 'Extension coude (Triceps)' },
  { value: 'lateral_raise', label: 'Élévation latérale' },
  { value: 'hip_abduction', label: 'Abduction hanche' },
  { value: 'hip_adduction', label: 'Adduction hanche' },
  { value: 'shoulder_rotation', label: 'Rotation épaule' },
  { value: 'carry', label: 'Porté (Carry)' },
  { value: 'scapular_elevation', label: 'Élévation scapulaire (Shrug)' },
  { value: 'scapular_retraction', label: 'Rétraction scapulaire' },
  { value: 'scapular_protraction', label: 'Protraction scapulaire' },
  { value: 'core_anti_flex', label: 'Gainage anti-flexion' },
  { value: 'core_flex', label: 'Flexion core' },
  { value: 'core_rotation', label: 'Rotation core' },
]

const EQUIPMENT_ITEMS = [
  { value: 'bodyweight', label: 'Poids corps' },
  { value: 'band', label: 'Élastique' },
  { value: 'dumbbell', label: 'Haltère' },
  { value: 'barbell', label: 'Barre' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Poulie' },
  { value: 'smith', label: 'Smith' },
  { value: 'trx', label: 'TRX' },
  { value: 'ez_bar', label: 'Barre EZ' },
  { value: 'trap_bar', label: 'Trap Bar' },
]

const MUSCLE_GROUPS = [
  { slug: 'chest', label: 'Pectoraux' },
  { slug: 'shoulders', label: 'Épaules' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'abs', label: 'Abdos' },
  { slug: 'back_upper', label: 'Dos haut' },
  { slug: 'back_lower', label: 'Lombaires' },
  { slug: 'traps', label: 'Trapèzes' },
  { slug: 'quads', label: 'Quadriceps' },
  { slug: 'hamstrings', label: 'Ischios' },
  { slug: 'glutes', label: 'Fessiers' },
  { slug: 'calves', label: 'Mollets' },
]

export interface ExerciseData {
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  weight_increment_kg: number | null
  notes: string
  image_url: string | null
  movement_pattern: string | null
  equipment_required: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  is_compound: boolean | undefined
  is_unilateral: boolean
  tempo: string | null
  set_prescriptions?: SetPrescription[]
  group_id?: string
  dbId?: string
  primaryMuscle?: string | null
  constraintProfile?: string | null
  execution_type?: 'reps_rir' | 'time_rpe' | 'distance_rpe'
  target_hr_zone?: string | null
  target_rir?: number | null
}

interface Props {
  dragId: string
  exercise: ExerciseData
  si: number
  ei: number
  isHighlighted: boolean
  isUploading: boolean
  alerts: IntelligenceAlert[]
  templateId?: string
  supersetGroupColor?: string
  groupSize?: number
  nextInSameGroup?: boolean
  onUpdate: (patch: Partial<ExerciseData>) => void
  onRemove: () => void
  onImageUpload: (file: File) => void
  onPickExercise: () => void
  onPickExerciseForAlternative?: (addFn: (name: string) => Promise<void>) => void
  onOpenAlternatives: () => void
  onToggleSuperset?: () => void
  exerciseRef: (el: HTMLDivElement | null) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
  performanceTrend?: 'progression' | 'stagnation' | 'overtraining' | null
  performanceSuggestion?: string | null
  morphoCoherence?: CoherenceResult
  isSelected?: boolean
  onToggleSelect?: () => void
  clientId?: string
}

const TEMPO_PRESETS = [
  {
    label: 'Hypertrophie standard',
    value: '2-1-3-1',
    note: 'CON contrôlée (2s) → ISO contraction (1s) → ECC lente (3s) → pause étirement (1s)',
  },
  {
    label: 'Hypertrophie excentrique',
    value: '2-1-4-0',
    note: 'CON contrôlée (2s) → ISO contraction (1s) → ECC très lente (4s) → pas de pause',
  },
  {
    label: 'Force / Puissance',
    value: 'X-0-2-0',
    note: 'CON explosive (X) → ISO (0s) → ECC contrôlée (2s) → pas de pause',
  },
  {
    label: 'Endurance / Cardio',
    value: '2-0-2-0',
    note: 'Tempo modéré, soutenable sur hautes répétitions',
  },
  {
    label: 'Explosif pur',
    value: 'X-0-X-0',
    note: 'CON et ECC explosives — puissance athlétique',
  },
] as const

function detectPreset(tempo: string | null): string {
  if (!tempo) return ''
  const match = TEMPO_PRESETS.find(p => p.value === tempo)
  return match ? match.value : ''
}

const SUPERSET_COLORS = [
  '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316',
]

const SET_TYPE_OPTIONS: Array<{ value: PlannedSetType; label: string }> = [
  { value: null, label: '—' },
  { value: 'warmup', label: 'Échauff.' },
  { value: 'working', label: 'Travail' },
  { value: 'cooldown', label: 'Retour' },
  { value: 'dropset', label: 'Dégressive' },
]

export default function ExerciseCard({
  dragId,
  exercise,
  si,
  ei,
  isHighlighted,
  isUploading,
  alerts,
  templateId,
  supersetGroupColor,
  groupSize = 2,
  nextInSameGroup = false,
  onUpdate,
  onRemove,
  onImageUpload,
  onPickExercise,
  onPickExerciseForAlternative,
  onOpenAlternatives,
  onToggleSuperset,
  exerciseRef,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  performanceTrend,
  performanceSuggestion,
  morphoCoherence,
  isSelected,
  onToggleSelect,
  clientId,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const altRef = useRef<ExerciseClientAlternativesHandle>(null)
  const isInSuperset = !!exercise.group_id
  const setPrescriptions = normalizeSetPrescriptions(exercise.set_prescriptions, {
    sets: exercise.sets,
    reps: exercise.reps,
    rest_sec: exercise.rest_sec,
    rir: exercise.rir,
    execution_type: exercise.execution_type ?? 'reps_rir',
    target_hr_zone: exercise.target_hr_zone ?? null,
    target_rir: exercise.target_rir ?? null,
    tempo: exercise.tempo,
  })

  // ── Tempo selector state ──
  const [selectedPreset, setSelectedPreset] = useState<string>(() => detectPreset(exercise.tempo))
  useEffect(() => {
    setSelectedPreset(detectPreset(exercise.tempo))
  }, [exercise.tempo])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId })

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={(el) => { setNodeRef(el); exerciseRef(el) }}
      style={{
        ...dragStyle,
        ...(isInSuperset && supersetGroupColor ? {
          borderColor: `${supersetGroupColor}40`,
          boxShadow: `inset 3px 0 0 ${supersetGroupColor}`,
        } : {}),
      }}
      className={[
        'rounded-xl border-[0.3px] bg-white/[0.02] transition-all duration-200',
        isSelected ? 'border-[#1f8a65]/60 bg-[#1f8a65]/5 ring-1 ring-[#1f8a65]/30'
        : isHighlighted
          ? 'border-[#1f8a65]/60 ring-1 ring-[#1f8a65]/30'
          : isInSuperset
          ? 'border-transparent'
          : 'border-white/[0.06]',
      ].join(' ')}
    >
      {/* Superset / Triset / Giant Set badge */}
      {isInSuperset && (
        <div
          className="flex items-center gap-1.5 px-3 py-1 border-b-[0.3px]"
          style={{ borderBottomColor: `${supersetGroupColor}20` }}
        >
          <Link2 size={9} style={{ color: supersetGroupColor ?? '#f59e0b' }} />
          <span className="text-[9px] font-semibold" style={{ color: supersetGroupColor ?? '#f59e0b' }}>
            {groupSize === 2 ? 'SUPERSET' : groupSize === 3 ? 'TRISET' : 'SÉRIE GÉANTE'}
          </span>
        </div>
      )}

      <div className="p-3">
        <div className="grid grid-cols-[120px_1fr] gap-3">
          {/* Left column: image */}
          <div className="flex flex-col gap-2">
            {/* Image — primary CTA: opens catalogue if no image */}
            <div className="relative w-[120px] h-[120px] rounded-lg overflow-hidden bg-white/[0.03] border-[0.3px] border-white/[0.06] group">
              {exercise.image_url ? (
                <>
                  <Image
                    src={exercise.image_url}
                    alt={exercise.name}
                    fill
                    className="object-cover"
                    unoptimized={exercise.image_url.endsWith('.gif')}
                  />
                  {/* Hover overlay: upload */}
                  <div
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} className="text-white" />
                    <span className="text-[9px] text-white/70">Changer</span>
                  </div>
                </>
              ) : (
                /* No image: primary CTA = open catalogue */
                <button
                  type="button"
                  onClick={onPickExercise}
                  className="w-full h-full flex flex-col items-center justify-center gap-2 hover:bg-white/[0.04] transition-colors"
                >
                  <Library size={20} className="text-[#1f8a65]/60" />
                  <span className="text-[9px] font-medium text-[#1f8a65]/60 leading-tight text-center px-2">
                    Choisir depuis le catalogue
                  </span>
                </button>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#1f8a65] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onImageUpload(f)
                e.target.value = ''
              }}
            />
          </div>

          {/* Right column: name, sets/reps, muscles, notes */}
          <div className="flex flex-col gap-2 min-w-0">
            {/* Name row: drag handle + input + catalogue button + superset + delete */}
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/50 transition-colors shrink-0"
                title="Déplacer"
              >
                <GripVertical size={13} />
              </div>

              {onToggleSelect && (
                <button
                  type="button"
                  onClick={onToggleSelect}
                  className="text-white/45 hover:text-accent transition-colors shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare size={16} className="text-accent" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              )}

              <input
                value={exercise.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder={`Exercice ${ei + 1}`}
                className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-white placeholder:text-white/20 outline-none"
              />
              {/* Morpho coherence badge — cohérence pattern moteur ↔ morphologie */}
              {morphoCoherence && (
                <div className="shrink-0">
                  <MorphoCoherenceBadge coherence={morphoCoherence} />
                </div>
              )}
              {/* Catalogue button — always visible, primary action */}
              <button
                onClick={onPickExercise}
                title="Choisir depuis le catalogue"
                className="shrink-0 flex items-center gap-1 h-6 px-2 rounded-md bg-[#1f8a65]/10 text-[#1f8a65]/70 hover:bg-[#1f8a65]/20 hover:text-[#1f8a65] transition-colors"
              >
                <Library size={11} />
                <span className="text-[9px] font-semibold hidden sm:inline">Catalogue</span>
              </button>
              {/* Superset toggle */}
              {onToggleSuperset && (
                <button
                  onClick={onToggleSuperset}
                  title={
                    isInSuperset
                      ? nextInSameGroup
                        ? 'Retirer du groupe'
                        : 'Étendre le groupe vers l\'exercice suivant'
                      : 'Grouper avec l\'exercice suivant'
                  }
                  className={[
                    'shrink-0 p-1 rounded-md transition-colors',
                    isInSuperset
                      ? 'text-amber-400 hover:bg-amber-500/10'
                      : 'text-white/20 hover:text-white/50 hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  {isInSuperset ? <Link2 size={12} /> : <Link2Off size={12} />}
                </button>
              )}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={onMoveUp}
                  disabled={isFirst}
                  className="p-1 rounded text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Monter"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={isLast}
                  className="p-1 rounded text-white/20 hover:text-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  title="Descendre"
                >
                  <ChevronDown size={11} />
                </button>
              </div>
              <button
                onClick={onRemove}
                className="shrink-0 p-1 rounded-md text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Performance trend badge — only when clientId context is active */}
            {performanceTrend && (
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: performanceTrend === 'progression' ? '#1f8a65'
                      : performanceTrend === 'stagnation' ? '#f59e0b'
                      : '#ef4444',
                    backgroundColor: performanceTrend === 'progression' ? 'rgba(31,138,101,0.12)'
                      : performanceTrend === 'stagnation' ? 'rgba(245,158,11,0.12)'
                      : 'rgba(239,68,68,0.12)',
                  }}
                >
                  {performanceTrend === 'progression' ? '↗ Progression'
                    : performanceTrend === 'stagnation' ? '→ Stagnation'
                    : '↘ Surmenage'}
                </span>
                {performanceSuggestion && (
                  <span className="text-[10px] text-white/35 truncate max-w-[200px]" title={performanceSuggestion}>
                    {performanceSuggestion}
                  </span>
                )}
              </div>
            )}

            {/* Selector of execution type */}
            <div className="flex gap-1.5 mb-2 border-b border-white/[0.04] pb-1.5">
              {(['reps_rir', 'time_rpe', 'distance_rpe'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdate({ execution_type: t })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    (exercise.execution_type ?? 'reps_rir') === t
                      ? 'bg-accent text-white'
                      : 'bg-white/[0.04] text-white/45 hover:text-white'
                  }`}
                >
                  {t === 'reps_rir' ? 'Renforcement' : t === 'time_rpe' ? 'HIIT/Temps' : 'Distance'}
                </button>
              ))}
            </div>

            {/* Fetch client details for specific HR Zones if client context is available */}
            {(() => {
              const { data: clientRes } = useSWR(clientId ? `/api/clients/${clientId}` : null, (url) => fetch(url).then(r => r.json()));
              const client = clientRes?.client;

              const hrZones = useMemo(() => {
                if (!client) return null;
                const dob = client.date_of_birth;
                const gender = client.gender === 'female' ? 'female' : 'male';
                const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 30;
                return calculateHRZones({ age, gender });
              }, [client]);

              const isCardio = (exercise.execution_type ?? 'reps_rir') !== 'reps_rir';
              const rpeLabel = (exercise.execution_type ?? 'reps_rir') === 'reps_rir' ? 'RIR' : 'RPE';
              const repsLabel = (exercise.execution_type ?? 'reps_rir') === 'time_rpe' ? 'Durée' : (exercise.execution_type ?? 'reps_rir') === 'distance_rpe' ? 'Distance' : 'Répétitions';
              const repsPlaceholder = (exercise.execution_type ?? 'reps_rir') === 'time_rpe' ? '30s' : (exercise.execution_type ?? 'reps_rir') === 'distance_rpe' ? '2 km' : '8-12';

              return (
                <>
                  {/* Sets / Reps / Rest / RIR */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Séries', value: String(exercise.sets), key: 'sets', type: 'number' },
                      { label: repsLabel, value: exercise.reps, key: 'reps', type: 'text' },
                      { label: 'Repos', value: exercise.rest_sec != null ? String(exercise.rest_sec) : '', key: 'rest_sec', type: 'number' },
                      { label: rpeLabel, value: (isCardio ? exercise.target_rir : exercise.rir) != null ? String(isCardio ? exercise.target_rir : exercise.rir) : '', key: 'rir_rpe', type: 'number' },
                    ].map(f => (
                      <div key={f.key} className="min-w-0">
                        <label className="block text-[9px] text-white/30 mb-0.5 truncate">{f.label}</label>
                        <input
                          type={f.type}
                          step={f.key === 'rir_rpe' ? 0.5 : undefined}
                          value={f.value}
                          placeholder={f.key === 'reps' ? repsPlaceholder : f.key === 'rir_rpe' ? (isCardio ? '8' : '2') : ''}
                          onChange={e => {
                            const v = e.target.value
                            if (f.key === 'sets') {
                              const nextSets = Math.max(1, Number(v) || 1)
                              onUpdate({
                                sets: nextSets,
                                set_prescriptions: normalizeSetPrescriptions(exercise.set_prescriptions, {
                                  sets: nextSets,
                                  reps: exercise.reps,
                                  rest_sec: exercise.rest_sec,
                                  rir: exercise.rir,
                                  tempo: exercise.tempo,
                                }),
                              })
                            } else if (f.key === 'reps') {
                              onUpdate({
                                reps: v,
                                set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                  setPrescriptions,
                                  'reps',
                                  exercise.reps,
                                  v,
                                ),
                              })
                            } else if (f.key === 'rest_sec') {
                              const nextRest = v ? Number(v) : null
                              onUpdate({
                                rest_sec: nextRest,
                                set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                  setPrescriptions,
                                  'rest_sec',
                                  exercise.rest_sec,
                                  nextRest,
                                ),
                              })
                            } else if (f.key === 'rir_rpe') {
                              const val = v ? Number(v) : null
                              if (isCardio) {
                                onUpdate({
                                  target_rir: val,
                                  rir: val,
                                })
                              } else {
                                onUpdate({
                                  rir: val,
                                  set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                    setPrescriptions,
                                    'rir',
                                    exercise.rir,
                                    val,
                                  ),
                                })
                              }
                            }
                          }}
                          className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-1.5 py-1 outline-none font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Target HR Zone recommendation selector */}
                  {isCardio && (
                    <div className="mt-2 pt-2 border-t border-white/[0.04]">
                      <label className="block text-[9px] text-white/30 mb-1">
                        Zone Cardiaque Recommandée
                      </label>
                      <select
                        value={exercise.target_hr_zone ?? ''}
                        onChange={e => onUpdate({ target_hr_zone: e.target.value || null })}
                        className="w-full bg-[#0a0a0a] text-white/80 text-[11px] rounded-md border-[0.3px] border-white/[0.06] px-1.5 py-1 outline-none"
                      >
                        <option value="">— Sans zone spécifique —</option>
                        {hrZones ? hrZones.zones.map(z => (
                          <option key={z.zone} value={`Zone ${z.zone}`}>
                            Zone {z.zone} ({z.name}) : {z.bpm} BPM
                          </option>
                        )) : (
                          <>
                            <option value="Zone 1">Zone 1 (Récupération Active)</option>
                            <option value="Zone 2">Zone 2 (Endurance de Base)</option>
                            <option value="Zone 3">Zone 3 (Aérobie)</option>
                            <option value="Zone 4">Zone 4 (Seuil Lactique)</option>
                    <option value="Zone 6">Zone 6 (Anaérobie)</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}
                </>
              );
            })()}

            {(!exercise.execution_type || exercise.execution_type === 'reps_rir') && (
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                {/* Tempo d'exécution */}
                {(() => {
                  const activePreset = TEMPO_PRESETS.find(p => p.value === selectedPreset)
                  return (
                    <div>
                      <label className="block text-[9px] text-white/30 mb-0.5">
                        Tempo (CON – ISO – ECC – PAUSE)
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={e => {
                          const v = e.target.value
                          setSelectedPreset(v)
                          if (v) {
                            onUpdate({
                              tempo: v,
                              set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                setPrescriptions,
                                'tempo',
                                exercise.tempo,
                                v,
                              ),
                            })
                          }
                        }}
                        className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/85 px-1 py-0.5 outline-none mb-1"
                      >
                        <option value="" disabled>— Sélectionner un tempo —</option>
                        {TEMPO_PRESETS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>

                      {activePreset && (
                        <p className="text-[9px] text-white/30 mt-1 leading-normal italic">
                          {activePreset.note}
                        </p>
                      )}
                    </div>
                  )
                })()}

                {/* Palier de surcharge progressive */}
                <div>
                  <label className="block text-[9px] text-white/30 mb-0.5">Kilo / overload</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={exercise.weight_increment_kg != null ? String(exercise.weight_increment_kg) : ''}
                    onChange={e => {
                      const v = e.target.value
                      onUpdate({ weight_increment_kg: v ? Number(v) : null })
                    }}
                    placeholder="2.5"
                    className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-1.5 py-1 outline-none font-mono"
                  />
                  <p className="text-[9px] text-white/20 leading-relaxed mt-1">
                    Charge ajoutée quand le haut de fourchette est atteint sur toutes les séries.
                  </p>
                </div>
              </div>
            )}

            {(!exercise.execution_type || exercise.execution_type === 'reps_rir') && (
              <div className="rounded-lg border-[0.3px] border-white/[0.06] bg-[#0a0a0a] p-2.5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Prescription par série
                    </p>
                    <p className="text-[9px] text-white/20 leading-relaxed mt-0.5">
                      Personnalisez les répétitions, le repos ou le RIR pour chaque série individuellement (ex: pyramide).
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[450px]">
                    <div className="grid grid-cols-6 gap-2 mb-1.5 pb-1 border-b border-white/[0.04]">
                      {['Série', 'Répétitions', 'Repos', 'RIR', 'Tempo', 'Type de série'].map((label) => (
                        <span key={label} className="text-[8px] font-bold uppercase tracking-wider text-white/30">{label}</span>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {setPrescriptions.map((row, index) => (
                        <div key={index} className="grid grid-cols-6 gap-2 items-center">
                          <span className="text-[10px] font-mono text-white/40">#{index + 1}</span>

                          <input
                            value={row.reps ?? ''}
                            onChange={e => {
                              const next = [...setPrescriptions]
                              next[index] = { ...row, reps: e.target.value }
                              onUpdate({
                                set_prescriptions: next,
                                reps: index === 0 ? e.target.value : exercise.reps,
                              })
                            }}
                            className="bg-[#121212] rounded-md border-[0.3px] border-white/[0.06] text-[10px] text-white/80 px-1 py-0.5 outline-none font-mono"
                          />

                          <input
                            type="number"
                            value={row.rest_sec ?? ''}
                            onChange={e => {
                              const next = [...setPrescriptions]
                              next[index] = { ...row, rest_sec: e.target.value ? Number(e.target.value) : null }
                              onUpdate({
                                set_prescriptions: next,
                                rest_sec: index === 0 ? (e.target.value ? Number(e.target.value) : null) : exercise.rest_sec,
                              })
                            }}
                            className="bg-[#121212] rounded-md border-[0.3px] border-white/[0.06] text-[10px] text-white/80 px-1 py-0.5 outline-none font-mono"
                          />

                          <input
                            type="number"
                            value={row.rir ?? ''}
                            onChange={e => {
                              const next = [...setPrescriptions]
                              next[index] = { ...row, rir: e.target.value ? Number(e.target.value) : null }
                              onUpdate({
                                set_prescriptions: next,
                                rir: index === 0 ? (e.target.value ? Number(e.target.value) : null) : exercise.rir,
                              })
                            }}
                            className="bg-[#121212] rounded-md border-[0.3px] border-white/[0.06] text-[10px] text-white/80 px-1 py-0.5 outline-none font-mono"
                          />

                          <select
                            value={TEMPO_PRESETS.some(p => p.value === row.tempo) ? row.tempo ?? '' : ''}
                            onChange={e => {
                              const next = [...setPrescriptions]
                              next[index] = { ...row, tempo: e.target.value || null }
                              onUpdate({
                                set_prescriptions: next,
                                tempo: index === 0 ? e.target.value : exercise.tempo,
                              })
                            }}
                            className="bg-[#121212] rounded-md border-[0.3px] border-white/[0.06] text-[9px] text-white/70 px-1 py-0.5 outline-none"
                          >
                            <option value="">Tempo exercice</option>
                            {TEMPO_PRESETS.map(p => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>

                          <select
                            value={row.set_type ?? ''}
                            onChange={e => {
                              const next = [...setPrescriptions]
                              next[index] = {
                                ...row,
                                set_type: (e.target.value || null) as PlannedSetType,
                              }
                              onUpdate({ set_prescriptions: next })
                            }}
                            className="bg-[#121212] rounded-md border-[0.3px] border-white/[0.06] text-[9px] text-white/70 px-1 py-0.5 outline-none font-medium"
                          >
                            <option value="">Normale</option>
                            <option value="warmup">Échauffement</option>
                            <option value="working">Travail</option>
                            <option value="dropset">Série dégressive</option>
                            <option value="cooldown">Retour au calme</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Unilatéral toggle */}
            <button
              type="button"
              onClick={() => onUpdate({ is_unilateral: !exercise.is_unilateral })}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md border-[0.3px] text-[10px] font-semibold transition-colors ${
                exercise.is_unilateral
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50'
              }`}
            >
              <span className={`w-3 h-3 rounded-full border flex-shrink-0 ${exercise.is_unilateral ? 'bg-blue-400 border-blue-400' : 'border-white/20'}`} />
              Unilatéral (G + D par série)
            </button>

            {/* Notes */}
            <textarea
              value={exercise.notes}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Notes coach..."
              rows={2}
              className="w-full bg-[#0a0a0a] rounded-lg border-[0.3px] border-white/[0.06] text-[11px] text-white/60 placeholder:text-white/20 px-2 py-1.5 outline-none resize-none"
            />

            {/* Intelligence alerts */}
            {alerts.length > 0 && (
              <IntelligenceAlertBadge
                alerts={alerts}
                onOpenAlternatives={onOpenAlternatives}
              />
            )}

            {/* Client alternatives (edit mode) */}
            {templateId && exercise.dbId && (
              <ExerciseClientAlternatives
                ref={altRef}
                templateId={templateId}
                exerciseId={exercise.dbId}
                onRequestAddFromCatalog={() => {
                  onPickExerciseForAlternative?.(
                    (name) => altRef.current?.addAlternative(name) ?? Promise.resolve()
                  )
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
