'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { MoreHorizontal, Plus, BarChart2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import SetRow, { type SetRowData, type SetType } from './SetRow'
import SetTypeSelector from './SetTypeSelector'
import ExerciseContextMenu from './ExerciseContextMenu'
import type { SetRecommendation } from '@/lib/training/setRecommendation'
import { useClientT } from '@/components/client/ClientI18nProvider'

export interface ExerciseBlockExercise {
  id: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  target_rir: number | null
  image_url: string | null
  tempo: string | null
  movement_pattern: string | null
  weight_increment_kg?: number | null
}

interface ExerciseBlockProps {
  exercise: ExerciseBlockExercise
  sets: SetRowData[]
  recommendations: Record<string, SetRecommendation>
  prSets: Set<string>
  coachingCues: Record<string, string | null>
  inSuperset?: boolean
  onValidateSet: (exId: string, setNum: number, side: string, reps: string, weight: string, rir: string) => void
  onDeleteSet: (exId: string, setNum: number, side: string) => void
  onChangeSet: (exId: string, setNum: number, side: string, patch: Partial<SetRowData>) => void
  onAddSet: (exId: string) => void
  onSwap: (exId: string) => void
  onRest: (exId: string) => void
  onNote: (exId: string) => void
  onTempo: (exId: string) => void
  onDeleteExercise: (exId: string) => void
  onOpenProgression: (exId: string, exerciseName: string) => void
}

function recKey(exerciseId: string, setNumber: number, side: string): string {
  return `${exerciseId}_set${setNumber}_${side}`
}

export default function ExerciseBlock({
  exercise,
  sets,
  recommendations,
  prSets,
  coachingCues,
  inSuperset = false,
  onValidateSet,
  onDeleteSet,
  onChangeSet,
  onAddSet,
  onSwap,
  onRest,
  onNote,
  onTempo,
  onDeleteExercise,
  onOpenProgression,
}: ExerciseBlockProps) {
  const { t } = useClientT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [typeSelectorFor, setTypeSelectorFor] = useState<{ setNum: number; side: string } | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const activeSetRef = useRef<HTMLDivElement>(null)

  const firstActiveSet = sets.find(s => !s.completed)

  // Build working set index map for display numbers
  let workingCounter = 0
  const workingIndexMap: Record<string, number> = {}
  for (const s of sets) {
    if (s.set_type === 'working') {
      workingCounter++
      workingIndexMap[`${s.set_number}_${s.side}`] = workingCounter
    }
  }

  const effectiveRir = exercise.target_rir ?? exercise.rir
  // Tempo available if coach set it OR auto-default exists (movement_pattern present)
  const hasTempo = !!(exercise.tempo || exercise.movement_pattern)

  const inner = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 pb-2">
        {exercise.image_url ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="shrink-0 w-14 h-14 rounded-xl overflow-hidden active:scale-[0.96] transition-transform"
          >
            <Image
              src={exercise.image_url}
              alt={exercise.name}
              width={56}
              height={56}
              unoptimized={exercise.image_url.endsWith('.gif')}
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/[0.04] shrink-0 flex items-center justify-center">
            <span className="text-white/10 text-[22px]">💪</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white leading-tight">{exercise.name}</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {effectiveRir !== null ? t('logger.ex.sets.reps.rir', { sets: String(exercise.sets), reps: String(exercise.reps), rir: String(effectiveRir) }) : t('logger.ex.sets.reps', { sets: String(exercise.sets), reps: String(exercise.reps) })}
          </p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.08] active:scale-95 transition-all"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-3 pb-1">
        <span className="shrink-0 min-w-[28px] text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">{t('logger.set')}</span>
        <span className="shrink-0 w-[46px] text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Repos</span>
        <span className="flex-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Reps</span>
        <span className="flex-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">kg</span>
        {effectiveRir !== null && effectiveRir !== undefined && (
          <span className="shrink-0 min-w-[22px] text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">RIR</span>
        )}
        {hasTempo && (
          <span className="shrink-0 w-7 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 text-center">Tempo</span>
        )}
        <span className="shrink-0 w-8" />
      </div>

      {/* Sets */}
      <div className="px-3 pb-2 flex flex-col gap-1.5">
        {sets.map(s => {
          const key = recKey(s.exercise_id, s.set_number, s.side)
          const rec = recommendations[key]
          const isActive = !s.completed && firstActiveSet?.set_number === s.set_number && firstActiveSet?.side === s.side
          const wi = s.set_type === 'working' ? (workingIndexMap[`${s.set_number}_${s.side}`] ?? null) : null

          return (
            <div
              key={key}
              ref={isActive ? activeSetRef : undefined}
              style={isActive ? { borderRadius: '12px', boxShadow: '0 0 0 1px rgba(45,122,98,0.45)' } : undefined}
            >
              <SetRow
                set={s}
                workingIndex={wi}
                recReps={rec ? String(rec.reps) : undefined}
                recWeight={rec ? String(rec.weight_kg) : undefined}
                targetRir={effectiveRir}
                recRir={rec ? null : null}
                isPR={prSets.has(key)}
                coachingCue={coachingCues[key] ?? null}
                hasTempoGuide={isActive && hasTempo}
                onValidate={(reps, weight, rir) => onValidateSet(s.exercise_id, s.set_number, s.side, reps, weight, rir)}
                onDelete={() => onDeleteSet(s.exercise_id, s.set_number, s.side)}
                onChange={patch => onChangeSet(s.exercise_id, s.set_number, s.side, patch)}
                onTypePress={() => setTypeSelectorFor({ setNum: s.set_number, side: s.side })}
                onTempoPress={() => onTempo(exercise.id)}
              />
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pt-1 pb-3">
        <button
          onClick={() => onAddSet(exercise.id)}
          className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/60 font-medium active:scale-95 transition-all"
        >
          <Plus size={13} />
          Ajouter une série
        </button>
        <button
          onClick={() => onOpenProgression(exercise.id, exercise.name)}
          className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 active:scale-95 transition-all"
        >
          <BarChart2 size={13} />
        </button>
      </div>

      {/* Image lightbox */}
      <AnimatePresence>
        {lightboxOpen && exercise.image_url && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-5 right-5 h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.08] text-white/60"
            >
              <X size={16} />
            </button>
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 26 } }}
              exit={{ scale: 0.88, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="max-w-[90vw] max-h-[80vh] rounded-2xl overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={exercise.image_url}
                alt={exercise.name}
                className="max-w-[90vw] max-h-[80vh] object-contain"
              />
            </motion.div>
            <p className="absolute bottom-8 left-0 right-0 text-center text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30">{exercise.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu */}
      <ExerciseContextMenu
        open={menuOpen}
        hasTempo={hasTempo}
        onSwap={() => onSwap(exercise.id)}
        onRest={() => onRest(exercise.id)}
        onNote={() => onNote(exercise.id)}
        onTempo={() => onTempo(exercise.id)}
        onDelete={() => onDeleteExercise(exercise.id)}
        onClose={() => setMenuOpen(false)}
      />

      {/* Set type selector */}
      <SetTypeSelector
        open={typeSelectorFor !== null}
        current={
          typeSelectorFor
            ? (sets.find(s => s.set_number === typeSelectorFor.setNum && s.side === typeSelectorFor.side)?.set_type ?? 'working')
            : 'working'
        }
        onSelect={(type: SetType) => {
          if (typeSelectorFor) {
            onChangeSet(exercise.id, typeSelectorFor.setNum, typeSelectorFor.side, { set_type: type })
          }
        }}
        onClose={() => setTypeSelectorFor(null)}
      />
    </>
  )

  if (inSuperset) {
    return <div>{inner}</div>
  }

  return (
    <div className="bg-[#111111] rounded-2xl overflow-hidden">
      {inner}
    </div>
  )
}
