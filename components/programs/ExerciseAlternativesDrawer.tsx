'use client'

import { useState, useMemo } from 'react'
import { X, ArrowLeftRight, Zap, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { scoreAlternatives } from '@/lib/programs/intelligence'
import type { BuilderExercise, TemplateMeta } from '@/lib/programs/intelligence'
import type { AlternativeScore } from '@/lib/programs/intelligence'
import { getCatalogEntryByName } from '@/lib/programs/intelligence/catalog-utils'

type ExerciseReplacementPatch = Partial<BuilderExercise> & {
  name: string
  image_url?: string | null
}

interface Props {
  exercise: BuilderExercise
  sessionExercises: BuilderExercise[]
  meta: TemplateMeta
  onReplace: (patch: ExerciseReplacementPatch) => void
  onClose: () => void
}

type CatalogBackedAlternative = AlternativeScore['entry'] & {
  primaryActivation?: number | null
  secondaryActivations?: number[]
  stabilizers?: string[]
  jointStressSpine?: number | null
  jointStressKnee?: number | null
  jointStressShoulder?: number | null
  globalInstability?: number | null
  coordinationDemand?: number | null
}

const FILTER_LABELS: Record<string, string> = {
  all: 'Toutes',
  same_equipment: 'Même équipement',
  different_equipment: 'Autre équipement',
  easier: 'Plus simple',
  harder: 'Plus difficile',
}

const MOVEMENT_PATTERNS = [
  { value: 'horizontal_push', label: 'Poussée horizontale' },
  { value: 'vertical_push', label: 'Poussée verticale' },
  { value: 'horizontal_pull', label: 'Tirage horizontal' },
  { value: 'vertical_pull', label: 'Tirage vertical' },
  { value: 'squat_pattern', label: 'Pattern squat' },
  { value: 'hip_hinge', label: 'Charnière hanche' },
  { value: 'elbow_flexion', label: 'Flexion coude (Biceps)' },
  { value: 'elbow_extension', label: 'Extension coude (Triceps)' },
  { value: 'lateral_raise', label: 'Élévation latérale' },
  { value: 'knee_flexion', label: 'Flexion genou' },
  { value: 'knee_extension', label: 'Extension genou' },
  { value: 'calf_raise', label: 'Extension mollets' },
  { value: 'core_flex', label: 'Flexion core' },
  { value: 'core_anti_flex', label: 'Gainage anti-flexion' },
  { value: 'core_rotation', label: 'Rotation core' },
  { value: 'carry', label: 'Porté (Carry)' },
  { value: 'scapular_elevation', label: 'Élévation scapulaire (Shrug)' },
  { value: 'hip_abduction', label: 'Abduction hanche' },
  { value: 'hip_adduction', label: 'Adduction hanche' },
  { value: 'shoulder_rotation', label: 'Rotation épaule' },
  { value: 'scapular_retraction', label: 'Rétraction scapulaire' },
  { value: 'scapular_protraction', label: 'Protraction scapulaire' },
]

const MUSCLE_OPTIONS = [
  { slug: 'quadriceps', label: 'Quadriceps' },
  { slug: 'fessiers', label: 'Fessiers' },
  { slug: 'ischio-jambiers', label: 'Ischio-jambiers' },
  { slug: 'pectoraux', label: 'Pectoraux' },
  { slug: 'dos', label: 'Dos' },
  { slug: 'epaules', label: 'Épaules' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'mollets', label: 'Mollets' },
  { slug: 'abdos', label: 'Abdos' },
  { slug: 'lombaires', label: 'Lombaires' },
]

export default function ExerciseAlternativesDrawer({ exercise, sessionExercises, meta, onReplace, onClose }: Props) {
  const [filter, setFilter] = useState<string>('all')
  const [view, setView] = useState<'alternatives' | 'create'>('alternatives')
  const [createForm, setCreateForm] = useState({
    name: '',
    movement_pattern: '',
    is_compound: false,
    muscles: [] as string[],
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function handleCreate() {
    if (!createForm.name.trim()) return
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/exercises/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: createForm.name.trim(),
        movement_pattern: createForm.movement_pattern || null,
        is_compound: createForm.is_compound,
        muscles: createForm.muscles,
        stimulus_coefficient: createForm.is_compound ? 0.72 : 0.50,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      onReplace({
        name: created.name,
        image_url: '',
        movement_pattern: created.movement_pattern ?? null,
        equipment_required: created.equipment ?? [],
        primary_muscles: created.muscles ?? [],
        secondary_muscles: [],
        is_compound: createForm.is_compound,
      })
    } else {
      const err = await res.json()
      setCreateError(err.error ?? 'Erreur lors de la création')
    }
    setCreating(false)
  }

  const alternatives = useMemo(() => {
    return scoreAlternatives(exercise, {
      equipmentArchetype: meta.equipment_archetype,
      goal: meta.goal,
      level: meta.level,
      sessionExercises,
    })
  }, [exercise, sessionExercises, meta])

  const filtered = useMemo((): AlternativeScore[] => {
    const origEquip = exercise.equipment_required
    switch (filter) {
      case 'same_equipment':
        return alternatives.filter(a => a.entry.equipment.some(e => origEquip.includes(e)))
      case 'different_equipment':
        return alternatives.filter(a => !a.entry.equipment.some(e => origEquip.includes(e)))
      case 'easier':
        return alternatives.filter(a => a.entry.stimulus_coefficient < 0.65)
      case 'harder':
        return alternatives.filter(a => a.entry.stimulus_coefficient > 0.80)
      default:
        return alternatives
    }
  }, [alternatives, filter, exercise.equipment_required])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-[420px] h-full bg-[#181818] border-l border-white/[0.06] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Alternatives à</p>
              <p className="text-[13px] font-bold text-white mt-0.5 truncate max-w-[300px]">{exercise.name}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-1 mt-3">
            <button
              type="button"
              onClick={() => setView('alternatives')}
              className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors ${view === 'alternatives' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'}`}
            >
              Alternatives
            </button>
            <button
              type="button"
              onClick={() => setView('create')}
              className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors ${view === 'create' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'}`}
            >
              + Créer
            </button>
          </div>
        </div>

        {/* Filters — visible only in alternatives view */}
        {view === 'alternatives' && (
          <div className="flex gap-1.5 px-4 py-3 border-b border-white/[0.06] overflow-x-auto">
            {Object.entries(FILTER_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition-colors ${
                  filter === key
                    ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                    : 'bg-white/[0.04] text-white/40 hover:text-white/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Create form */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 p-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Nom</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Hip Thrust Barre Surélevé"
                  className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Pattern</label>
                <select
                  value={createForm.movement_pattern}
                  onChange={e => setCreateForm(f => ({ ...f, movement_pattern: e.target.value }))}
                  className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none"
                >
                  <option value="">Sélectionner…</option>
                  {MOVEMENT_PATTERNS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Muscles</label>
                <div className="flex flex-wrap gap-1.5">
                  {MUSCLE_OPTIONS.map(m => {
                    const active = createForm.muscles.includes(m.slug)
                    return (
                      <button
                        key={m.slug}
                        type="button"
                        onClick={() => setCreateForm(f => ({
                          ...f,
                          muscles: active ? f.muscles.filter(s => s !== m.slug) : [...f.muscles, m.slug],
                        }))}
                        className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${active ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05]'}`}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateForm(f => ({ ...f, is_compound: !f.is_compound }))}
                  className={`w-8 h-5 rounded-full transition-colors relative ${createForm.is_compound ? 'bg-[#1f8a65]' : 'bg-white/[0.10]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${createForm.is_compound ? 'translate-x-3' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-[12px] text-white/60">Exercice composé</span>
              </div>
              {createError && <p className="text-[11px] text-red-400">{createError}</p>}
              <button
                type="button"
                onClick={handleCreate}
                disabled={!createForm.name.trim() || creating}
                className="h-10 rounded-xl bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 transition-colors"
              >
                {creating ? '…' : 'Créer et insérer'}
              </button>
            </div>
          </div>
        )}

        {/* List — visible only in alternatives view */}
        {view === 'alternatives' && <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <ArrowLeftRight size={20} className="text-white/20" />
              <p className="text-[12px] text-white/40">Aucune alternative pour ce filtre</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {filtered.map(alt => (
                <div key={alt.entry.id} className="flex gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                  {/* GIF thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/[0.04] shrink-0 relative">
                    <Image
                      src={alt.entry.gifUrl}
                      alt={alt.entry.name}
                      fill
                      className="object-cover"
                      unoptimized={alt.entry.gifUrl.endsWith('.gif')}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{alt.entry.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]/80">
                        {alt.label}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-white/40">
                        <Zap size={8} className="text-amber-400/60" />
                        {Math.round(alt.entry.stimulus_coefficient * 100)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5 truncate">
                      {alt.entry.muscles.slice(0, 3).join(', ')}
                    </p>
                  </div>

                  {/* Replace button */}
                  <button
                    type="button"
                    onClick={() => {
                      const catalog = getCatalogEntryByName(alt.entry.name)
                      const entry = alt.entry as CatalogBackedAlternative
                      onReplace(
                        {
                          name: entry.name,
                          image_url: entry.gifUrl,
                          movement_pattern: entry.movementPattern,
                          equipment_required: entry.equipment,
                          is_compound: entry.isCompound,
                          primary_muscles: entry.primaryMuscle ? [entry.primaryMuscle] : entry.muscles,
                          secondary_muscles: entry.secondaryMuscles ?? [],
                          plane: entry.plane ?? null,
                          mechanic: entry.mechanic ?? null,
                          unilateral: entry.unilateral ?? false,
                          primaryMuscle: entry.primaryMuscle ?? null,
                          primaryActivation: entry.primaryActivation ?? null,
                          secondaryMusclesDetail: entry.secondaryMuscles ?? [],
                          secondaryActivations: entry.secondaryActivations ?? [],
                          stabilizers: entry.stabilizers ?? [],
                          jointStressSpine: entry.jointStressSpine ?? null,
                          jointStressKnee: entry.jointStressKnee ?? null,
                          jointStressShoulder: entry.jointStressShoulder ?? null,
                          globalInstability: entry.globalInstability ?? null,
                          coordinationDemand: entry.coordinationDemand ?? null,
                          constraintProfile: alt.entry.constraintProfile ?? catalog?.constraintProfile ?? null,
                        },
                      )
                      onClose()
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[10px] font-bold shrink-0 hover:bg-[#1f8a65]/20 transition-colors self-center"
                  >
                    Remplacer
                    <ChevronRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}
