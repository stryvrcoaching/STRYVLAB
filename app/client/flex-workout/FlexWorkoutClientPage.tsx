'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resetBodyScrollLock } from '@/components/client/useBodyScrollLock'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type {
  FlexWorkoutExerciseRow,
  FlexWorkoutSessionRow,
  FlexWorkoutSetRow,
} from '@/lib/training/flexTraining/types'
import FlexSessionLogger from './FlexSessionLogger'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ExerciseState = FlexWorkoutExerciseRow & {
  sets: FlexWorkoutSetRow[]
  display_name: string
}

function mapSessionResponse(
  exercises: Array<
    FlexWorkoutExerciseRow & {
      display_name?: string
      flex_workout_sets?: FlexWorkoutSetRow[]
      sets?: FlexWorkoutSetRow[]
    }
  >,
): ExerciseState[] {
  return exercises
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((exercise) => ({
      ...exercise,
      display_name: exercise.display_name ?? exercise.custom_exercise_name ?? 'Exercice',
      sets: (exercise.sets ?? exercise.flex_workout_sets ?? []).slice().sort((a, b) => {
        if (a.set_number !== b.set_number) return a.set_number - b.set_number
        return a.side.localeCompare(b.side)
      }),
    }))
}

export default function FlexWorkoutClientPage({
  initialSessionId,
  plannedWorkoutId,
}: {
  initialSessionId: string | null
  plannedWorkoutId: string | null
}) {
  const { t } = useClientT()
  const router = useRouter()
  const [session, setSession] = useState<FlexWorkoutSessionRow | null>(null)
  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const normalizedPlannedWorkoutId = plannedWorkoutId && UUID_RE.test(plannedWorkoutId)
    ? plannedWorkoutId
    : null

  useEffect(() => {
    resetBodyScrollLock()
    return () => {
      resetBodyScrollLock()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startSession(sourceWorkoutId: string | null) {
      const startResponse = await fetch('/api/client/flex-workouts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relation_to_planned_workout: 'unknown',
          source_workout_id: sourceWorkoutId,
        }),
      })
      const startData = await startResponse.json().catch(() => null)
      if (!startResponse.ok) {
        throw new Error(startData?.error ?? t('flex.error.startSession'))
      }

      return startData
    }

    async function loadOrStart() {
      setLoading(true)
      setError(null)

      try {
        if (initialSessionId) {
          const response = await fetch(`/api/client/flex-workouts/${initialSessionId}`)
          const data = await response.json().catch(() => null)
          if (!response.ok) throw new Error(data?.error ?? t('flex.error.loadSession'))

          if (!cancelled) {
            setSession(data.session)
            setExercises(mapSessionResponse(data.exercises ?? []))
          }
          return
        }

        let startData: any
        try {
          startData = await startSession(normalizedPlannedWorkoutId)
        } catch (error) {
          if (normalizedPlannedWorkoutId) {
            startData = await startSession(null)
          } else {
            throw error
          }
        }

        if (!cancelled) {
          setSession(startData.session)
          setExercises(mapSessionResponse(startData.exercises ?? []))
          if (startData.session?.id) {
            router.replace(`/client/flex-workout?sessionId=${startData.session.id}${normalizedPlannedWorkoutId ? `&sourceWorkoutId=${normalizedPlannedWorkoutId}` : ''}`)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('common.unknownError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadOrStart()
    return () => {
      cancelled = true
    }
  }, [initialSessionId, normalizedPlannedWorkoutId, retryKey, router])

  if (session) {
    return <FlexSessionLogger session={session} initialExercises={exercises} />
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#121212]">
        <div className="mx-auto max-w-lg px-5 pt-24">
          <div className="overflow-hidden rounded-xl bg-white/[0.02] p-5">
            <div className="h-3 w-28 animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-4 h-8 w-44 animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-8 space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
              <div className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
              <div className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#121212] px-5 pt-24">
      <div className="mx-auto max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-4">
        <p className="text-[12px] font-semibold text-red-300">{t('flex.error.openSession')}</p>
        {error ? <p className="mt-1 text-[12px] text-red-200/80">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setRetryKey((value) => value + 1)}
            className="h-10 rounded-xl bg-white/[0.08] px-4 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white"
          >
            {t('common.retry')}
          </button>
          <button
            onClick={() => router.push('/client/programme')}
            className="h-10 rounded-xl bg-white/[0.04] px-4 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/78"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    </div>
  )
}
