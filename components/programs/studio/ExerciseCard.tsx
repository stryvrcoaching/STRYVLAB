// components/programs/studio/ExerciseCard.tsx
'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Trash2, Upload, Library, Link2, Link2Off, ChevronUp, ChevronDown, GripVertical,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import IntelligenceAlertBadge from '@/components/programs/IntelligenceAlertBadge'
import ExerciseClientAlternatives, { type ExerciseClientAlternativesHandle } from '@/components/programs/ExerciseClientAlternatives'
import { MorphoCoherenceBadge } from '@/components/morpho/MorphoCoherenceBadge'
import type { IntelligenceAlert } from '@/lib/programs/intelligence'
import type { CoherenceResult } from '@/lib/morpho/exerciseCoherence'
import { parseTempo } from '@/lib/training/tempo'
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
  {
    label: 'Manuel',
    value: '__manual__',
    note: '',
  },
] as const

function detectPreset(tempo: string | null): string {
  if (!tempo) return '2-1-3-1'
  const match = TEMPO_PRESETS.find(p => p.value === tempo && p.value !== '__manual__')
  return match ? match.value : '__manual__'
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
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const altRef = useRef<ExerciseClientAlternativesHandle>(null)
  const isInSuperset = !!exercise.group_id
  const setPrescriptions = normalizeSetPrescriptions(exercise.set_prescriptions, {
    sets: exercise.sets,
    reps: exercise.reps,
    rest_sec: exercise.rest_sec,
    rir: exercise.rir,
    tempo: exercise.tempo,
  })

  // ── Tempo selector state ──
  const [selectedPreset, setSelectedPreset] = useState<string>(() => detectPreset(exercise.tempo))
  const [manualValue, setManualValue]       = useState<string>(exercise.tempo ?? '')
  const [manualError, setManualError]       = useState(false)

  useEffect(() => {
    setSelectedPreset(detectPreset(exercise.tempo))
    if (exercise.tempo && !TEMPO_PRESETS.find(p => p.value === exercise.tempo)) {
      setManualValue(exercise.tempo)
    }
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
        isHighlighted
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

            {/* Sets / Reps / Rest / RIR */}
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'Séries', value: String(exercise.sets), key: 'sets', type: 'number' },
                { label: 'Répétitions', value: exercise.reps, key: 'reps', type: 'text' },
                { label: 'Repos', value: exercise.rest_sec != null ? String(exercise.rest_sec) : '', key: 'rest_sec', type: 'number' },
                { label: 'RIR', value: exercise.rir != null ? String(exercise.rir) : '', key: 'rir', type: 'number' },
              ].map(f => (
                <div key={f.key} className="min-w-0">
                  <label className="block text-[9px] text-white/30 mb-0.5 truncate">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
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
                      } else if (f.key === 'rir') {
                        const nextRir = v ? Number(v) : null
                        onUpdate({
                          rir: nextRir,
                          set_prescriptions: applyDefaultFieldToSetPrescriptions(
                            setPrescriptions,
                            'rir',
                            exercise.rir,
                            nextRir,
                          ),
                        })
                      }
                    }}
                    className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-1.5 py-1 outline-none font-mono"
                  />
                </div>
              ))}
            </div>

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
                        setManualError(false)
                        if (v !== '__manual__') {
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
                      className="w-full bg-[#0a0a0a] rounded-md border-[0.3px] border-white/[0.06] text-[11px] text-white/80 px-1.5 py-1 outline-none cursor-pointer"
                    >
                      {TEMPO_PRESETS.map(p => (
                        <option key={p.value} value={p.value} className="bg-[#0a0a0a]">
                          {p.value === '__manual__' ? 'Manuel...' : `${p.label}  ·  ${p.value}`}
                        </option>
                      ))}
                    </select>
                    {activePreset && activePreset.note && (
                      <p className="text-[9px] text-white/25 leading-relaxed mt-0.5">
                        {activePreset.note}
                      </p>
                    )}
                    {selectedPreset === '__manual__' && (
                      <div className="mt-1">
                        <input
                          type="text"
                          value={manualValue}
                          onChange={e => {
                            setManualValue(e.target.value)
                            setManualError(false)
                          }}
                          onBlur={() => {
                            const v = manualValue.trim().toUpperCase()
                            if (!v) {
                              onUpdate({
                                tempo: null,
                                set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                  setPrescriptions,
                                  'tempo',
                                  exercise.tempo,
                                  null,
                                ),
                              })
                              setManualError(false)
                              return
                            }
                            if (parseTempo(v) !== null) {
                              onUpdate({
                                tempo: v,
                                set_prescriptions: applyDefaultFieldToSetPrescriptions(
                                  setPrescriptions,
                                  'tempo',
                                  exercise.tempo,
                                  v,
                                ),
                              })
                              setManualValue(v)
                              setManualError(false)
                            } else {
                              setManualError(true)
                            }
                          }}
                          placeholder="ex: 2-2-3-1"
                          className={`w-full bg-[#0a0a0a] rounded-md border-[0.3px] text-[11px] text-white/80 placeholder:text-white/20 px-1.5 py-1 outline-none font-mono ${
                            manualError ? 'border-red-500/40' : 'border-white/[0.06]'
                          }`}
                        />
                        {manualError && (
                          <p className="text-[9px] text-red-400/60 mt-0.5">
                            Format attendu : 2-2-3-1  (chiffre ou X par phase)
                          </p>
                        )}
                      </div>
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

            <div className="rounded-lg border-[0.3px] border-white/[0.06] bg-[#0a0a0a] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Prescription par série
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/25">
                    Chaque ligne hérite du défaut coach puis peut être ajustée indépendamment.
                  </p>
                </div>
              </div>

              <div className="mb-1 grid grid-cols-[64px_minmax(0,1fr)_88px_72px_120px_124px] gap-1.5 px-1">
                {['Série', 'Répétitions', 'Repos', 'RIR', 'Tempo', 'Type de série'].map((label) => (
                  <div
                    key={label}
                    className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/28"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {setPrescriptions.map((row, index) => (
                  <div
                    key={`set-prescription-${index}`}
                    className="grid grid-cols-[64px_minmax(0,1fr)_88px_72px_120px_124px] gap-1.5"
                  >
                    <div className="flex items-center rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.03] px-2 text-[10px] font-semibold text-white/55">
                      Série {row.set_number}
                    </div>
                    <input
                      type="text"
                      value={row.reps}
                      onChange={(e) => {
                        const next = [...setPrescriptions]
                        next[index] = { ...row, reps: e.target.value }
                        onUpdate({
                          reps: index === 0 ? e.target.value : exercise.reps,
                          set_prescriptions: next,
                        })
                      }}
                      placeholder="8-12"
                      className="w-full rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-white/80 outline-none font-mono"
                    />
                    <input
                      type="number"
                      value={row.rest_sec ?? ''}
                      onChange={(e) => {
                        const next = [...setPrescriptions]
                        next[index] = { ...row, rest_sec: e.target.value ? Number(e.target.value) : null }
                        onUpdate({
                          rest_sec: index === 0 ? (e.target.value ? Number(e.target.value) : null) : exercise.rest_sec,
                          set_prescriptions: next,
                        })
                      }}
                      placeholder="90"
                      className="w-full rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-white/80 outline-none font-mono"
                    />
                    <input
                      type="number"
                      value={row.rir ?? ''}
                      onChange={(e) => {
                        const next = [...setPrescriptions]
                        next[index] = { ...row, rir: e.target.value ? Number(e.target.value) : null }
                        onUpdate({
                          rir: index === 0 ? (e.target.value ? Number(e.target.value) : null) : exercise.rir,
                          set_prescriptions: next,
                        })
                      }}
                      placeholder="2"
                      className="w-full rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-white/80 outline-none font-mono"
                    />
                    <input
                      type="text"
                      value={row.tempo ?? ''}
                      onChange={(e) => {
                        const next = [...setPrescriptions]
                        next[index] = { ...row, tempo: e.target.value || null }
                        onUpdate({
                          tempo: index === 0 ? (e.target.value || null) : exercise.tempo,
                          set_prescriptions: next,
                        })
                      }}
                      placeholder="2-1-3-1"
                      className="w-full rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-white/80 outline-none font-mono"
                    />
                    <select
                      value={row.set_type ?? ''}
                      onChange={(e) => {
                        const value = (e.target.value || null) as PlannedSetType
                        const next = [...setPrescriptions]
                        next[index] = { ...row, set_type: value }
                        onUpdate({ set_prescriptions: next })
                      }}
                      className="w-full rounded-md border-[0.3px] border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[10px] text-white/75 outline-none"
                    >
                      {SET_TYPE_OPTIONS.map((option) => (
                        <option key={option.value ?? 'none'} value={option.value ?? ''} className="bg-[#0a0a0a]">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

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
