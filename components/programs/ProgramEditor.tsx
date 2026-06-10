'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, GripVertical, ImagePlus, X, Library, TrendingUp } from 'lucide-react'
import Image from 'next/image'
import ExercisePicker from './ExercisePicker'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const MUSCLE_GROUPS: { slug: string; label: string }[] = [
  { slug: 'chest',      label: 'Pectoraux' },
  { slug: 'shoulders',  label: 'Épaules' },
  { slug: 'biceps',     label: 'Biceps' },
  { slug: 'triceps',    label: 'Triceps' },
  { slug: 'abs',        label: 'Abdos' },
  { slug: 'back_upper', label: 'Dos (haut)' },
  { slug: 'back_lower', label: 'Lombaires' },
  { slug: 'traps',      label: 'Trapèzes' },
  { slug: 'quads',      label: 'Quadriceps' },
  { slug: 'hamstrings', label: 'Ischios' },
  { slug: 'glutes',     label: 'Fessiers' },
  { slug: 'calves',     label: 'Mollets' },
]

interface Exercise {
  id?: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string
  position: number
  image_url: string | null
  // Double progression
  target_rir: number | null
  weight_increment_kg: number
  primary_muscles: string[]
  secondary_muscles: string[]
}

interface Session {
  id?: string
  name: string
  day_of_week: number | null
  position: number
  notes: string
  exercises: Exercise[]
  open: boolean
}

interface Program {
  id?: string
  name: string
  description: string
  weeks: number
  sessions: Session[]
}

interface Props {
  clientId: string
  initial?: Program & { id: string }
  onSaved?: (program: any) => void
  onCancel?: () => void
}

function emptyExercise(position: number): Exercise {
  return { name: '', sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '', position, image_url: null, target_rir: 2, weight_increment_kg: 2.5, primary_muscles: [], secondary_muscles: [] }
}

function emptySession(position: number): Session {
  return { name: '', day_of_week: null, position, notes: '', exercises: [emptyExercise(0)], open: true }
}

export default function ProgramEditor({ clientId, initial, onSaved, onCancel }: Props) {
  const [program, setProgram] = useState<Program>(() =>
    initial
      ? {
          ...initial,
          sessions: (initial.sessions ?? (initial as any).program_sessions ?? []).map((s: any) => ({
            ...s,
            open: false,
            exercises: (s.program_exercises ?? s.exercises ?? [])
              .sort((a: any, b: any) => a.position - b.position)
              .map((e: any) => ({
                ...e,
                image_url: e.image_url ?? null,
                target_rir: e.target_rir ?? e.rir ?? 2,
                weight_increment_kg: e.weight_increment_kg ?? 2.5,
                primary_muscles: e.primary_muscles ?? [],
                secondary_muscles: e.secondary_muscles ?? [],
              })),
          })),
        }
      : { name: '', description: '', weeks: 4, sessions: [emptySession(0)] }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [pickerTarget, setPickerTarget] = useState<{ si: number; ei: number } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleImageUpload(si: number, ei: number, file: File) {
    const key = `${si}-${ei}`
    setUploadingKey(key)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/program-templates/exercises/upload-image', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Erreur upload'); return }
      updateExercise(si, ei, { image_url: d.url })
    } catch {
      setError('Erreur réseau lors de l\'upload')
    } finally {
      setUploadingKey(null)
    }
  }

  function updateProgram(patch: Partial<Program>) {
    setProgram(p => ({ ...p, ...patch }))
  }

  function addSession() {
    setProgram(p => ({
      ...p,
      sessions: [...p.sessions, emptySession(p.sessions.length)],
    }))
  }

  function removeSession(i: number) {
    setProgram(p => ({ ...p, sessions: p.sessions.filter((_, idx) => idx !== i) }))
  }

  function updateSession(i: number, patch: Partial<Session>) {
    setProgram(p => {
      const sessions = [...p.sessions]
      sessions[i] = { ...sessions[i], ...patch }
      return { ...p, sessions }
    })
  }

  function addExercise(si: number) {
    setProgram(p => {
      const sessions = [...p.sessions]
      sessions[si] = {
        ...sessions[si],
        exercises: [...sessions[si].exercises, emptyExercise(sessions[si].exercises.length)],
      }
      return { ...p, sessions }
    })
  }

  function removeExercise(si: number, ei: number) {
    setProgram(p => {
      const sessions = [...p.sessions]
      sessions[si] = { ...sessions[si], exercises: sessions[si].exercises.filter((_, idx) => idx !== ei) }
      return { ...p, sessions }
    })
  }

  function updateExercise(si: number, ei: number, patch: Partial<Exercise>) {
    setProgram(p => {
      const sessions = [...p.sessions]
      const exercises = [...sessions[si].exercises]
      exercises[ei] = { ...exercises[ei], ...patch }
      sessions[si] = { ...sessions[si], exercises }
      return { ...p, sessions }
    })
  }

  async function handleSave() {
    setError('')
    if (!program.name.trim()) { setError('Le nom du programme est requis.'); return }
    if (program.sessions.some(s => !s.name.trim())) { setError('Chaque séance doit avoir un nom.'); return }
    if (program.sessions.some(s => s.exercises.some(e => !e.name.trim()))) { setError('Chaque exercice doit avoir un nom.'); return }

    setSaving(true)
    try {
      let programId = initial?.id

      if (!programId) {
        // Create program
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, name: program.name, description: program.description, weeks: program.weeks }),
        })
        const d = await res.json()
        if (!res.ok) { setError(d.error); return }
        programId = d.program.id
      } else {
        // Update program meta
        await fetch(`/api/programs/${programId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: program.name, description: program.description, weeks: program.weeks }),
        })
      }

      // Save sessions sequentially
      for (let si = 0; si < program.sessions.length; si++) {
        const session = program.sessions[si]
        let sessionId = session.id
        if (!sessionId) {
          const res = await fetch(`/api/programs/${programId}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: session.name, day_of_week: session.day_of_week, position: si, notes: session.notes }),
          })
          const d = await res.json()
          if (!res.ok) { setError(d.error); return }
          sessionId = d.session.id
        } else {
          await fetch(`/api/programs/${programId}/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: session.name, day_of_week: session.day_of_week, position: si, notes: session.notes }),
          })
        }

        // Bulk replace exercises
        await fetch(`/api/programs/${programId}/sessions/${sessionId}/exercises`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exercises: session.exercises }),
        })
      }

      // Fetch saved program to return
      const res = await fetch(`/api/programs?client_id=${clientId}`)
      const d = await res.json()
      onSaved?.(d.programs?.[0])
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Programme meta */}
      <div className="bg-[#181818] rounded-xl p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-white text-sm">Informations du programme</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-white/45 uppercase tracking-wider block mb-1">Nom du programme *</label>
            <input
              value={program.name}
              onChange={e => updateProgram({ name: e.target.value })}
              placeholder="ex: PPL Hypertrophie S1"
              className="w-full px-3 py-2 bg-white/[0.04] rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/45 uppercase tracking-wider block mb-1">Durée (semaines)</label>
            <input
              type="number"
              min={1}
              max={52}
              value={program.weeks}
              onChange={e => updateProgram({ weeks: parseInt(e.target.value) || 4 })}
              className="w-full px-3 py-2 bg-white/[0.04] rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/45 uppercase tracking-wider block mb-1">Description</label>
            <input
              value={program.description}
              onChange={e => updateProgram({ description: e.target.value })}
              placeholder="Optionnel"
              className="w-full px-3 py-2 bg-white/[0.04] rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="flex flex-col gap-3">
        {program.sessions.map((session, si) => (
          <div key={si} className="bg-[#181818] rounded-xl overflow-hidden">
            {/* Session header */}
            <div className="flex items-center gap-2 p-4 border-b border-white/40">
              <GripVertical size={14} className="text-white/45 shrink-0" />
              <input
                value={session.name}
                onChange={e => updateSession(si, { name: e.target.value })}
                placeholder="Nom de la séance (ex: Push A)"
                className="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder-secondary/40"
              />
              {/* Day picker */}
              <div className="flex gap-1">
                {DAYS.map((d, di) => (
                  <button
                    key={di}
                    type="button"
                    onClick={() => updateSession(si, { day_of_week: session.day_of_week === di + 1 ? null : di + 1 })}
                    className={`w-6 h-6 rounded text-[9px] font-bold transition-colors ${
                      session.day_of_week === di + 1
                        ? 'bg-accent text-white'
                        : 'bg-white/[0.04] text-white/45 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => updateSession(si, { open: !session.open })}
                className="text-white/45 hover:text-white"
              >
                {session.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              <button
                type="button"
                onClick={() => removeSession(si)}
                className="text-white/45 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Exercises */}
            {session.open && (
              <div className="p-4 flex flex-col gap-3">
                {session.exercises.map((ex, ei) => (
                  <div key={ei} className="bg-white/[0.04] rounded-lg p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={ex.name}
                        onChange={e => updateExercise(si, ei, { name: e.target.value })}
                        placeholder="Nom de l'exercice *"
                        className="flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder-secondary/40"
                      />
                      <button type="button" onClick={() => removeExercise(si, ei)} className="text-white/45 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {/* Ligne 1 — prescription de base */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">Séries</label>
                        <input
                          type="number"
                          min={1}
                          value={ex.sets}
                          onChange={e => updateExercise(si, ei, { sets: parseInt(e.target.value) || 3 })}
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">Reps</label>
                        <input
                          value={ex.reps}
                          onChange={e => updateExercise(si, ei, { reps: e.target.value })}
                          placeholder="8-12"
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">Repos (s)</label>
                        <input
                          type="number"
                          min={0}
                          value={ex.rest_sec ?? ''}
                          onChange={e => updateExercise(si, ei, { rest_sec: parseInt(e.target.value) || null })}
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">RIR</label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={ex.rir ?? ''}
                          onChange={e => updateExercise(si, ei, { rir: parseInt(e.target.value) ?? null })}
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-accent/40"
                        />
                      </div>
                    </div>

                    {/* Ligne 2 — double progression */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <TrendingUp size={10} className="text-accent shrink-0" />
                      <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Progression</span>
                      <div className="flex-1 h-px bg-accent/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">RIR Cible</label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={ex.target_rir ?? ''}
                          onChange={e => updateExercise(si, ei, { target_rir: e.target.value === '' ? null : parseInt(e.target.value) })}
                          placeholder="2"
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-violet-400/40"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-white/45 uppercase block mb-0.5">Incrément (kg)</label>
                        <input
                          type="number"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={ex.weight_increment_kg}
                          onChange={e => updateExercise(si, ei, { weight_increment_kg: parseFloat(e.target.value) || 2.5 })}
                          className="w-full bg-[#181818] rounded px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-violet-400/40"
                        />
                      </div>
                    </div>
                    {/* ── Muscles ── */}
                    <div className="border-t border-white/[0.06] pt-2 flex flex-col gap-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">Muscles principaux</p>
                      <div className="flex flex-wrap gap-1">
                        {MUSCLE_GROUPS.map(({ slug, label }) => {
                          const active = ex.primary_muscles.includes(slug)
                          return (
                            <button key={slug} type="button"
                              onClick={() => {
                                const next = active ? ex.primary_muscles.filter(m => m !== slug) : [...ex.primary_muscles, slug]
                                const sec = ex.secondary_muscles.filter(m => m !== slug)
                                updateExercise(si, ei, { primary_muscles: next, secondary_muscles: sec })
                              }}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${active ? 'bg-[#1f8a65]/20 text-[#1f8a65]' : 'bg-white/[0.04] text-white/35 hover:text-white/60 hover:bg-white/[0.07]'}`}
                            >{label}</button>
                          )
                        })}
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mt-0.5">Muscles secondaires</p>
                      <div className="flex flex-wrap gap-1">
                        {MUSCLE_GROUPS.map(({ slug, label }) => {
                          const isPrimary = ex.primary_muscles.includes(slug)
                          const isSecondary = ex.secondary_muscles.includes(slug)
                          return (
                            <button key={slug} type="button" disabled={isPrimary}
                              onClick={() => {
                                const next = isSecondary ? ex.secondary_muscles.filter(m => m !== slug) : [...ex.secondary_muscles, slug]
                                updateExercise(si, ei, { secondary_muscles: next })
                              }}
                              className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${isPrimary ? 'opacity-20 cursor-not-allowed bg-white/[0.02] text-white/20' : isSecondary ? 'bg-[#1f8a65]/10 text-[#1f8a65]/60 border border-[#1f8a65]/20' : 'bg-white/[0.04] text-white/35 hover:text-white/60 hover:bg-white/[0.07]'}`}
                            >{label}</button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Image exercice */}
                    <div className="border-t border-white/30 pt-2">
                      {ex.image_url ? (
                        <div className="relative rounded overflow-hidden group inline-block w-full">
                          <Image
                            src={ex.image_url}
                            alt={ex.name || 'Exercice'}
                            width={0}
                            height={0}
                            sizes="(max-width: 768px) 100vw, 400px"
                            className="w-full h-auto rounded"
                            unoptimized={ex.image_url.endsWith('.gif')}
                          />
                          <button
                            type="button"
                            onClick={() => updateExercise(si, ei, { image_url: null })}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Supprimer l'image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPickerTarget({ si, ei })}
                            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:opacity-80 transition-opacity bg-accent/10 px-2.5 py-1.5 rounded-lg"
                          >
                            <Library size={12} />
                            Bibliothèque
                          </button>
                          <span className="text-white/45/40 text-[10px]">ou</span>
                          <input
                            ref={el => { fileInputRefs.current[`${si}-${ei}`] = el }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f) handleImageUpload(si, ei, f)
                              e.target.value = ''
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingKey === `${si}-${ei}`}
                            onClick={() => fileInputRefs.current[`${si}-${ei}`]?.click()}
                            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {uploadingKey === `${si}-${ei}`
                              ? <><Loader2 size={12} className="animate-spin" />Upload…</>
                              : <><ImagePlus size={12} />Importer</>
                            }
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      value={ex.notes}
                      onChange={e => updateExercise(si, ei, { notes: e.target.value })}
                      placeholder="Notes (optionnel)"
                      className="bg-transparent text-xs text-white/45 outline-none placeholder-secondary/30 border-t border-white/30 pt-2"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addExercise(si)}
                  className="flex items-center gap-1.5 text-xs text-white/45 hover:text-accent transition-colors py-1"
                >
                  <Plus size={13} />
                  Ajouter un exercice
                </button>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addSession}
          className="flex items-center gap-2 text-sm text-white/45 hover:text-accent transition-colors py-2"
        >
          <Plus size={15} />
          Ajouter une séance
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Exercise picker modal */}
      {pickerTarget && (
        <ExercisePicker
          onSelect={({ name, gifUrl }) => {
            const { si, ei } = pickerTarget
            updateExercise(si, ei, {
              name: name,
              image_url: gifUrl,
            })
            setPickerTarget(null)
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-white/45 hover:text-white px-4 py-2"
          >
            Annuler
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent text-white text-sm font-bold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Enregistrement…' : 'Enregistrer le programme'}
        </button>
      </div>
    </div>
  )
}
