'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type Mode = 'personal' | 'coach'

interface ExerciseNotesPanelProps {
  mode: Mode
  exerciseKey: string
  exerciseName: string
  programExerciseId: string
  sessionLogId: string | null
  initialPersonalNote?: string
}

export default function ExerciseNotesPanel({
  mode, exerciseKey, exerciseName, programExerciseId, sessionLogId, initialPersonalNote = '',
}: ExerciseNotesPanelProps) {
  const [value, setValue] = useState(initialPersonalNote)
  const [saving, setSaving] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPersonal = mode === 'personal'

  useEffect(() => {
    setValue(initialPersonalNote)
  }, [initialPersonalNote, mode])

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  const save = (nextValue: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      if (!isPersonal && !sessionLogId) return
      setSaving(true)
      try {
        await fetch(isPersonal ? '/api/client/exercise-notes' : `/api/client/session-logs/${sessionLogId}/exercise-comments`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exercise_key: exerciseKey,
            exercise_name: exerciseName,
            ...(isPersonal ? { body: nextValue.trim() } : { program_exercise_id: programExerciseId, body: nextValue.trim() }),
          }),
        })
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  return (
    <div className="mt-1 px-1">
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/35">
          {isPersonal ? 'Ma note personnelle' : 'Commentaire au coach'}
        </p>
        {saving ? <Loader2 size={11} className="animate-spin text-white/35" /> : null}
      </div>
      <textarea
        autoFocus
        rows={3}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          setValue(nextValue)
          save(nextValue)
        }}
        disabled={!isPersonal && !sessionLogId}
        placeholder={isPersonal
          ? 'Ex. banc à 30°, poulie réglée à 6…'
          : 'Partagez un ressenti ou une question pour votre coach…'}
        className="w-full rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/20 disabled:opacity-50 resize-none"
      />
      {!isPersonal && !sessionLogId ? <p className="mt-1 px-1 text-[10px] text-white/30">Préparation du commentaire…</p> : null}
    </div>
  )
}
