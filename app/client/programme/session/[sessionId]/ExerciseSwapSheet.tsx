'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { scoreAlternatives } from '@/lib/programs/intelligence'
import type { BuilderExercise } from '@/lib/programs/intelligence'
import { getCatalogEntryByName, getBiomechData } from '@/lib/programs/intelligence/catalog-utils'

interface Exercise {
  id: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string | null
  image_url: string | null
  is_unilateral: boolean
  primary_muscles?: string[]
  secondary_muscles?: string[]
  movement_pattern?: string | null
}

interface Props {
  exercise: Exercise
  allExercises: Exercise[]
  equipmentArchetype?: string
  onSwap: (exerciseName: string) => void
  onClose: () => void
}

const QUALITY_LABEL: Record<number, { textKey: string; color: string }> = {
  0: { textKey: 'swap.badge.recommended', color: 'text-[#f2f2f2] bg-[#f2f2f2]/10' },
  1: { textKey: 'swap.badge.similar',   color: 'text-blue-400 bg-blue-400/10' },
  2: { textKey: 'swap.badge.alternative', color: 'text-white/50 bg-white/[0.06]' },
}

export default function ExerciseSwapSheet({
  exercise,
  allExercises,
  equipmentArchetype = 'commercial_gym',
  onSwap,
  onClose,
}: Props) {
  const { t } = useClientT()
  const catalogMeta = getCatalogEntryByName(exercise.name)
  const biomech = getBiomechData(exercise.name)

  const builderExercise: BuilderExercise = {
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    rest_sec: exercise.rest_sec,
    rir: exercise.rir,
    notes: exercise.notes ?? '',
    movement_pattern: exercise.movement_pattern ?? catalogMeta?.movementPattern ?? null,
    equipment_required: [],
    primary_muscles:
      exercise.primary_muscles?.length
        ? exercise.primary_muscles
        : catalogMeta?.primaryMuscle
          ? [catalogMeta.primaryMuscle]
          : [],
    secondary_muscles: exercise.secondary_muscles ?? catalogMeta?.secondaryMuscles ?? [],
    primaryMuscle: catalogMeta?.primaryMuscle ?? biomech?.primaryMuscle ?? null,
    constraintProfile: catalogMeta?.constraintProfile ?? biomech?.constraintProfile ?? null,
    plane: catalogMeta?.plane ?? biomech?.plane ?? null,
    mechanic: catalogMeta?.mechanic ?? biomech?.mechanic ?? null,
    primaryActivation: biomech?.primaryActivation ?? null,
  }

  const sessionBuilderExercises: BuilderExercise[] = allExercises.map(ex => ({
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    rest_sec: ex.rest_sec,
    rir: ex.rir,
    notes: ex.notes ?? '',
    movement_pattern: ex.movement_pattern ?? null,
    equipment_required: [],
    primary_muscles: ex.primary_muscles ?? [],
    secondary_muscles: ex.secondary_muscles ?? [],
  }))

  const alternatives = useMemo(
    () =>
      scoreAlternatives(builderExercise, {
        equipmentArchetype,
        goal: 'hypertrophy',
        level: 'intermediate',
        sessionExercises: sessionBuilderExercises,
      }).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.name, exercise.movement_pattern, JSON.stringify(exercise.primary_muscles), equipmentArchetype],
  )

  function handleUse(name: string) {
    onSwap(name)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[#111111] rounded-t-2xl">
        <div className="w-10 h-1 bg-white/[0.12] rounded-full mx-auto mt-3 mb-1" />

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{t('swap.changeExercise')}</p>
            <p className="text-[15px] font-bold text-white leading-tight mt-0.5 truncate">{exercise.name}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/40"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[11px] text-white/30 px-4 pb-3">
          {t('swap.temporaryReplace')}
        </p>

        <div className="flex flex-col gap-2 px-4 pb-4">
          {alternatives.length === 0 && (
            <p className="text-[12px] text-white/30 py-4 text-center">
              {t('swap.none')}
            </p>
          )}
          {alternatives.map((alt, idx) => {
            const badge = QUALITY_LABEL[idx] ?? QUALITY_LABEL[2]
            const gifUrl = alt.entry.gifUrl ?? null
            return (
              <div
                key={alt.entry.slug}
                className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-3 py-2.5"
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/[0.04] flex items-center justify-center">
                  {gifUrl ? (
                    <Image
                      src={gifUrl}
                      alt={alt.entry.name}
                      width={48}
                      height={48}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[20px] opacity-20">💪</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white leading-tight line-clamp-2">{alt.entry.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full ${badge.color}`}>
                      {t(badge.textKey as never)}
                    </span>
                    {alt.label && alt.label !== 'Alternative' && (
                      <span className="text-[10px] text-white/30">{alt.label}</span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => handleUse(alt.entry.name)}
                  className="shrink-0 h-9 px-3 rounded-xl bg-[#f2f2f2] text-[11px] font-black uppercase tracking-[0.08em] text-[#080808] active:scale-95 transition-transform"
                >
                  {t('swap.use')}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
