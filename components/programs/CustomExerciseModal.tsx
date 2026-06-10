'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Check, Upload } from 'lucide-react'

const STEPS = ['Média', 'Identité', 'Classification', 'Muscles', 'Biomécanique', 'Confirmation'] as const
type Step = 0 | 1 | 2 | 3 | 4 | 5

interface FormData {
  mediaUrl: string
  mediaType: 'image' | 'gif' | 'video' | ''
  name: string
  description: string
  muscleGroup: string
  movementPattern: string
  plane: 'sagittal' | 'frontal' | 'transverse' | ''
  mechanic: 'isolation' | 'compound' | 'isometric' | 'plyometric' | ''
  unilateral: boolean
  equipment: string[]
  isCompound: boolean
  primaryMuscle: string
  primaryActivation: number
  secondaryMusclesDetail: string[]
  secondaryActivations: number[]
  stabilizers: string[]
  jointStressSpine: number
  jointStressKnee: number
  jointStressShoulder: number
  globalInstability: number
  coordinationDemand: number
  constraintProfile: string
}

const initialForm: FormData = {
  mediaUrl: '', mediaType: '',
  name: '', description: '', muscleGroup: '',
  movementPattern: '', plane: '', mechanic: '', unilateral: false, equipment: [], isCompound: false,
  primaryMuscle: '', primaryActivation: 0.75, secondaryMusclesDetail: [], secondaryActivations: [], stabilizers: [],
  jointStressSpine: 3, jointStressKnee: 3, jointStressShoulder: 3, globalInstability: 3, coordinationDemand: 3, constraintProfile: '',
}

interface CreatedExercise {
  name: string
  mediaUrl: string
  mediaType: string
  muscleGroup: string
  movementPattern: string
  equipment: string[]
  isCompound: boolean
  primaryMuscle: string
  primaryActivation: number
  jointStressSpine: number
  jointStressKnee: number
  jointStressShoulder: number
  globalInstability: number
  coordinationDemand: number
  constraintProfile: string
}

interface Props {
  onClose: () => void
  onCreated: (exercise: CreatedExercise) => void
}

export default function CustomExerciseModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(patch: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    if (step === 0) return !!form.mediaUrl && !!form.mediaType
    if (step === 1) return form.name.trim().length >= 2 && !!form.muscleGroup
    if (step === 2) return !!form.movementPattern && !!form.plane && !!form.mechanic && form.equipment.length > 0
    if (step === 3) return !!form.primaryMuscle && form.primaryActivation > 0
    if (step === 4) return !!form.constraintProfile
    return true
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          muscle_group: form.muscleGroup,
          media_url: form.mediaUrl,
          media_type: form.mediaType,
          movement_pattern: form.movementPattern,
          plane: form.plane,
          mechanic: form.mechanic,
          unilateral: form.unilateral,
          equipment: form.equipment,
          is_compound: form.isCompound,
          primary_muscle: form.primaryMuscle,
          primary_activation: form.primaryActivation,
          secondary_muscles_detail: form.secondaryMusclesDetail,
          secondary_activations: form.secondaryActivations,
          stabilizers: form.stabilizers,
          joint_stress_spine: form.jointStressSpine,
          joint_stress_knee: form.jointStressKnee,
          joint_stress_shoulder: form.jointStressShoulder,
          global_instability: form.globalInstability,
          coordination_demand: form.coordinationDemand,
          constraint_profile: form.constraintProfile,
          stimulus_coefficient: form.primaryActivation,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erreur lors de la création')
      }
      onCreated({
        name: form.name,
        mediaUrl: form.mediaUrl,
        mediaType: form.mediaType,
        muscleGroup: form.muscleGroup,
        movementPattern: form.movementPattern,
        equipment: form.equipment,
        isCompound: form.isCompound,
        primaryMuscle: form.primaryMuscle,
        primaryActivation: form.primaryActivation,
        jointStressSpine: form.jointStressSpine,
        jointStressKnee: form.jointStressKnee,
        jointStressShoulder: form.jointStressShoulder,
        globalInstability: form.globalInstability,
        coordinationDemand: form.coordinationDemand,
        constraintProfile: form.constraintProfile,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-[#181818] rounded-2xl w-full max-w-lg border-[0.3px] border-white/[0.06] flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[0.3px] border-white/[0.06]">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">Étape {step + 1}/{STEPS.length}</p>
            <h2 className="text-[13px] font-semibold text-white mt-0.5">{STEPS[step]}</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="h-[2px] bg-white/[0.06]">
          <motion.div
            className="h-full bg-[#1f8a65]"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && <StepMedia form={form} update={update} />}
              {step === 1 && <StepIdentity form={form} update={update} />}
              {step === 2 && <StepClassification form={form} update={update} />}
              {step === 3 && <StepMuscles form={form} update={update} />}
              {step === 4 && <StepBiomech form={form} update={update} />}
              {step === 5 && <StepConfirm form={form} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && <p className="px-5 pb-2 text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-[0.3px] border-white/[0.06]">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 text-[12px] font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Retour
          </button>
          {step < 5 ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={!canAdvance()}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1f8a65] px-4 text-[12px] font-bold text-white hover:bg-[#217356] transition-colors disabled:opacity-40"
            >
              Suivant <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1f8a65] px-4 text-[12px] font-bold text-white hover:bg-[#217356] transition-colors disabled:opacity-40"
            >
              {saving ? '...' : <><Check size={14} /> Créer l&apos;exercice</>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function StepMedia({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/exercises/custom/upload-media', { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json()
      setUploadError(d.error ?? 'Erreur upload')
      setUploading(false)
      return
    }
    const { url, mediaType } = await res.json()
    update({ mediaUrl: url, mediaType })
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-white/50">Ajoutez une image, un GIF de démonstration, ou une vidéo.</p>
      {form.mediaUrl ? (
        <div className="relative rounded-xl overflow-hidden bg-white/[0.02] border-[0.3px] border-white/[0.06]">
          {form.mediaType === 'video' ? (
            <video src={form.mediaUrl} className="w-full max-h-48 object-cover" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.mediaUrl} alt="preview" className="w-full max-h-48 object-contain" />
          )}
          <button
            onClick={() => update({ mediaUrl: '', mediaType: '' })}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white/70 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-3 h-40 rounded-xl border border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors">
          {uploading ? (
            <span className="text-[12px] text-white/40">Upload en cours...</span>
          ) : (
            <>
              <Upload size={20} className="text-white/25" />
              <span className="text-[12px] text-white/40">Glissez ou cliquez pour uploader</span>
              <span className="text-[10px] text-white/25">JPG, PNG, WebP, GIF, MP4, WebM — max 50MB</span>
            </>
          )}
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </label>
      )}
      {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
    </div>
  )
}

const MUSCLE_GROUPS_OPTIONS = [
  { value: 'abdos', label: 'Abdominaux' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'dos', label: 'Dos' },
  { value: 'epaules', label: 'Épaules' },
  { value: 'fessiers', label: 'Fessiers' },
  { value: 'ischio-jambiers', label: 'Ischio-jambiers' },
  { value: 'mollets', label: 'Mollets' },
  { value: 'pectoraux', label: 'Pectoraux' },
  { value: 'quadriceps', label: 'Quadriceps' },
  { value: 'triceps', label: 'Triceps' },
]

const MOVEMENT_PATTERNS_OPTIONS = [
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
  { value: 'core_anti_flex', label: 'Gainage anti-flexion' },
  { value: 'core_flex', label: 'Flexion core' },
  { value: 'core_rotation', label: 'Rotation core' },
  { value: 'carry', label: 'Porté (Carry)' },
  { value: 'scapular_elevation', label: 'Élévation scapulaire' },
  { value: 'hip_abduction', label: 'Abduction hanche' },
  { value: 'hip_adduction', label: 'Adduction hanche' },
  { value: 'shoulder_rotation', label: 'Rotation épaule' },
  { value: 'scapular_retraction', label: 'Rétraction scapulaire' },
  { value: 'scapular_protraction', label: 'Protraction scapulaire' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'band', label: 'Élastique' },
  { value: 'dumbbell', label: 'Haltères' },
  { value: 'barbell', label: 'Barre' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Poulie' },
  { value: 'smith', label: 'Smith Machine' },
  { value: 'trx', label: 'TRX / Sangles' },
  { value: 'ez_bar', label: 'Barre EZ' },
]

const CONSTRAINT_PROFILES = [
  { value: 'free_weight', label: 'Poids libre' },
  { value: 'cable_constant', label: 'Câble (tension constante)' },
  { value: 'machine_stability', label: 'Machine guidée' },
  { value: 'bodyweight_pull', label: 'Poids du corps (traction)' },
  { value: 'variable_resistance', label: 'Résistance variable (élastique)' },
  { value: 'strict_isolation', label: 'Isolation stricte' },
  { value: 'anti_extension', label: 'Anti-extension (gainage)' },
  { value: 'coordination_core', label: 'Coordination core' },
  { value: 'unilateral_instability', label: 'Instabilité unilatérale' },
]

const MUSCLE_OPTIONS = [
  { value: 'biceps_brachii', label: 'Biceps' },
  { value: 'brachialis', label: 'Brachial antérieur' },
  { value: 'brachioradialis', label: 'Brachio-radial' },
  { value: 'triceps_brachii', label: 'Triceps' },
  { value: 'pectoralis_major', label: 'Grand pectoral' },
  { value: 'pectoralis_minor', label: 'Petit pectoral' },
  { value: 'deltoid_anterior', label: 'Deltoïde antérieur' },
  { value: 'deltoid_lateral', label: 'Deltoïde latéral' },
  { value: 'deltoid_posterior', label: 'Deltoïde postérieur' },
  { value: 'trapezius', label: 'Trapèze' },
  { value: 'rhomboids', label: 'Rhomboïdes' },
  { value: 'latissimus_dorsi', label: 'Grand dorsal' },
  { value: 'spine_erectors', label: 'Érecteurs du rachis' },
  { value: 'gluteus_maximus', label: 'Grand fessier' },
  { value: 'gluteus_medius', label: 'Moyen fessier' },
  { value: 'gluteus_minimus', label: 'Petit fessier' },
  { value: 'quadriceps', label: 'Quadriceps' },
  { value: 'hamstrings', label: 'Ischio-jambiers' },
  { value: 'gastrocnemius', label: 'Gastrocnémien' },
  { value: 'soleus', label: 'Soléaire' },
  { value: 'rectus_abdominis', label: 'Droit abdominal' },
  { value: 'obliques', label: 'Obliques' },
  { value: 'transverse_abdominis', label: 'Transverse' },
  { value: 'core', label: 'Sangle abdominale' },
]

function StepIdentity({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Nom de l&apos;exercice *</label>
        <input
          value={form.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="Ex: Curl Concentré Haltère"
          className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white placeholder:text-white/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Groupe musculaire principal *</label>
        <select
          value={form.muscleGroup}
          onChange={e => update({ muscleGroup: e.target.value })}
          className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none"
        >
          <option value="">— Choisir —</option>
          {MUSCLE_GROUPS_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Description (optionnelle)</label>
        <textarea
          value={form.description}
          onChange={e => update({ description: e.target.value })}
          rows={2}
          placeholder="Notes sur l'exécution..."
          className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 outline-none resize-none"
        />
      </div>
    </div>
  )
}

function StepClassification({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  function toggleEquipment(val: string) {
    const current = form.equipment
    update({ equipment: current.includes(val) ? current.filter(e => e !== val) : [...current, val] })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Pattern de mouvement *</label>
        <select value={form.movementPattern} onChange={e => update({ movementPattern: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {MOVEMENT_PATTERNS_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Plan *</label>
          <select value={form.plane} onChange={e => update({ plane: e.target.value as FormData['plane'] })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-3 text-[13px] text-white/80 outline-none">
            <option value="">—</option>
            <option value="sagittal">Sagittal</option>
            <option value="frontal">Frontal</option>
            <option value="transverse">Transverse</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Mécanique *</label>
          <select value={form.mechanic} onChange={e => update({ mechanic: e.target.value as FormData['mechanic'], isCompound: e.target.value === 'compound' })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-3 text-[13px] text-white/80 outline-none">
            <option value="">—</option>
            <option value="isolation">Isolation</option>
            <option value="compound">Composé</option>
            <option value="isometric">Isométrique</option>
            <option value="plyometric">Pliométrique</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 border-[0.3px] border-white/[0.06]">
        <span className="text-[12px] text-white/70">Exercice unilatéral</span>
        <button
          onClick={() => update({ unilateral: !form.unilateral })}
          className={`w-10 h-5 rounded-full transition-colors ${form.unilateral ? 'bg-[#1f8a65]' : 'bg-white/10'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${form.unilateral ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Équipement requis * (au moins 1)</label>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_OPTIONS.map(eq => (
            <button
              key={eq.value}
              onClick={() => toggleEquipment(eq.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                form.equipment.includes(eq.value)
                  ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                  : 'bg-white/[0.04] text-white/40 hover:text-white/60'
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepMuscles({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  function toggleSecondary(muscle: string) {
    if (form.secondaryMusclesDetail.includes(muscle)) {
      const idx = form.secondaryMusclesDetail.indexOf(muscle)
      update({
        secondaryMusclesDetail: form.secondaryMusclesDetail.filter(m => m !== muscle),
        secondaryActivations: form.secondaryActivations.filter((_, i) => i !== idx),
      })
    } else if (form.secondaryMusclesDetail.length < 3) {
      update({
        secondaryMusclesDetail: [...form.secondaryMusclesDetail, muscle],
        secondaryActivations: [...form.secondaryActivations, 0.15],
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Muscle primaire *</label>
        <select value={form.primaryMuscle} onChange={e => update({ primaryMuscle: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {MUSCLE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">
          Activation primaire : <span className="text-[#1f8a65]">{form.primaryActivation.toFixed(2)}</span>
        </label>
        <input type="range" min={0.3} max={0.98} step={0.01} value={form.primaryActivation}
          onChange={e => update({ primaryActivation: parseFloat(e.target.value) })}
          className="w-full accent-[#1f8a65]" />
        <div className="flex justify-between text-[9px] text-white/25 mt-1"><span>0.30 (faible)</span><span>0.98 (max)</span></div>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Muscles secondaires (max 3, optionnel)</label>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_OPTIONS.filter(m => m.value !== form.primaryMuscle).map(m => (
            <button key={m.value} onClick={() => toggleSecondary(m.value)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
                form.secondaryMusclesDetail.includes(m.value) ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/35 hover:text-white/55'
              }`}
            >{m.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepBiomech({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  const sliders: { key: keyof FormData; label: string; max: number; low: string; high: string }[] = [
    { key: 'jointStressSpine', label: 'Stress rachis', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'jointStressKnee', label: 'Stress genou', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'jointStressShoulder', label: 'Stress épaule', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'globalInstability', label: 'Instabilité globale', max: 9, low: '1 — stable', high: '9 — très instable' },
    { key: 'coordinationDemand', label: 'Demande coordination', max: 9, low: '1 — simple', high: '9 — complexe' },
  ]

  return (
    <div className="space-y-5">
      {sliders.map(({ key, label, max, low, high }) => (
        <div key={key}>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">
            {label} : <span className="text-white">{form[key] as number}</span>/{max}
          </label>
          <input type="range" min={1} max={max} step={1} value={form[key] as number}
            onChange={e => update({ [key]: parseInt(e.target.value) } as Partial<FormData>)}
            className="w-full accent-[#1f8a65]" />
          <div className="flex justify-between text-[9px] text-white/25 mt-1"><span>{low}</span><span>{high}</span></div>
        </div>
      ))}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Profil de contrainte *</label>
        <select value={form.constraintProfile} onChange={e => update({ constraintProfile: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {CONSTRAINT_PROFILES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
    </div>
  )
}

function StepConfirm({ form }: { form: FormData }) {
  const rows: [string, string][] = [
    ['Nom', form.name],
    ['Groupe', form.muscleGroup],
    ['Pattern', form.movementPattern],
    ['Plan', form.plane],
    ['Mécanique', form.mechanic],
    ['Unilatéral', form.unilateral ? 'Oui' : 'Non'],
    ['Équipement', form.equipment.join(', ')],
    ['Muscle primaire', `${form.primaryMuscle} (${form.primaryActivation.toFixed(2)})`],
    ['Stress rachis / genou / épaule', `${form.jointStressSpine} / ${form.jointStressKnee} / ${form.jointStressShoulder}`],
    ['Instabilité / Coordination', `${form.globalInstability} / ${form.coordinationDemand}`],
    ['Profil contrainte', form.constraintProfile],
  ]

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-white/50 mb-3">Vérifiez les informations avant de créer l&apos;exercice.</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04]">
          <span className="text-[11px] text-white/40 shrink-0">{label}</span>
          <span className="text-[11px] text-white/80 text-right">{value || '—'}</span>
        </div>
      ))}
    </div>
  )
}
