'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Clock, Dumbbell, Flag, MoreHorizontal, Plus, Search, Sparkles, X } from 'lucide-react'
import exerciseCatalog from '@/data/exercise-catalog.json'
import ExerciseBlock, { type ExerciseBlockExercise } from '@/components/client/smart/ExerciseBlock'
import type { SetRowData, SetType } from '@/components/client/smart/SetRow'
import useBodyScrollLock, { resetBodyScrollLock } from '@/components/client/useBodyScrollLock'
import type { FlexWorkoutExerciseRow, FlexWorkoutRelation, FlexWorkoutSessionRow, FlexWorkoutSetRow } from '@/lib/training/flexTraining/types'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'
import { getDefaultTempo } from '@/lib/training/tempo'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type { SetRecommendation } from '@/lib/training/setRecommendation'
import { getExerciseHistoryEntries, indexExerciseHistoryEntry } from '@/lib/training/exerciseHistoryKey'
import {
  buildWorkoutCoachingCues,
  buildWorkoutHistoryReferences,
  recommendFollowingWorkoutSet,
  workoutSetKey,
  type WorkoutHistoryEntry,
  type WorkoutHistoryIndex,
} from '@/lib/training/workoutIntelligence'

type CatalogExercise = {
  id: string
  name: string
  gifUrl?: string
  muscleGroup?: string
  exerciseType?: string
  movementPattern?: string | null
  equipment?: string[]
  isCompound?: boolean
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
}

type FlexExerciseState = FlexWorkoutExerciseRow & {
  display_name: string
  sets: FlexWorkoutSetRow[]
}

type CustomExerciseDraft = {
  name: string
  muscleGroup: string
  movementPattern: string
  equipment: string
  primaryMuscles: string
  secondaryMuscles: string
  isCompound: boolean
  unilateral: boolean
}

const catalog = exerciseCatalog as CatalogExercise[]

const UUIDISH_NAME_RE = /^[0-9a-f]{8}(?:[ -][0-9a-f]{4}){3}[ -][0-9a-f]{12}$/i
const LIBRARY_PAGE_SIZE = 24

const MOVEMENT_PATTERN_OPTIONS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat_pattern',
  'hip_hinge',
  'knee_flexion',
  'knee_extension',
  'calf_raise',
  'elbow_flexion',
  'elbow_extension',
  'lateral_raise',
  'core_flex',
  'core_anti_flex',
  'core_rotation',
] as const

function formatTime(sec: number) {
  const abs = Math.abs(sec)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60).toString().padStart(h > 0 ? 2 : 1, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  const formatted = h > 0 ? `${h}:${m}:${s}` : `${m.padStart(2, '0')}:${s}`
  return sec < 0 ? `-${formatted}` : formatted
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function resolveCatalogDisplayName(entry: CatalogExercise) {
  const trimmed = entry.name?.trim() ?? ''
  if (!trimmed || UUIDISH_NAME_RE.test(trimmed)) return null
  return trimmed
}

type PreparedCatalogExercise = CatalogExercise & {
  displayName: string
  searchIndex: string
}

const preparedCatalog: PreparedCatalogExercise[] = catalog
  .map((entry) => {
    const displayName = resolveCatalogDisplayName(entry)
    if (!displayName) return null

    return {
      ...entry,
      displayName,
      searchIndex: normalizeSearchText([
        displayName,
        entry.muscleGroup,
        entry.primaryMuscle,
        ...(entry.primaryMuscles ?? []),
        ...(entry.secondaryMuscles ?? []),
        entry.exerciseType,
        entry.movementPattern,
      ].filter(Boolean).join(' ')),
    }
  })
  .filter(Boolean) as PreparedCatalogExercise[]

const preparedMuscleGroups = Array.from(
  new Set(preparedCatalog.map((entry) => entry.muscleGroup).filter(Boolean)),
) as string[]

const preparedMovementPatterns = Array.from(
  new Set(preparedCatalog.map((entry) => entry.movementPattern).filter(Boolean)),
) as string[]

function resolveExerciseBlock(exercise: FlexExerciseState): ExerciseBlockExercise {
  const setCount = new Set(exercise.sets.map((set) => set.set_number)).size
  const firstSet = exercise.sets[0]
  return {
    id: exercise.id,
    name: exercise.display_name,
    sets: Math.max(setCount, 1),
    reps: firstSet?.reps != null ? String(firstSet.reps) : '—',
    rest_sec: firstSet?.rest_seconds ?? null,
    rir: firstSet?.rir ?? null,
    target_rir: firstSet?.rir ?? null,
    image_url: exercise.image_url ?? null,
    tempo: firstSet?.tempo ?? null,
    movement_pattern: exercise.movement_pattern ?? null,
    weight_increment_kg: 2.5,
  }
}

function mapSetRow(set: FlexWorkoutSetRow, exerciseName: string): SetRowData {
  return {
    exercise_id: set.exercise_log_id,
    exercise_name: exerciseName,
    set_number: set.set_number,
    side: set.side,
    set_type: set.set_type,
    planned_reps: set.reps != null ? String(set.reps) : '',
    actual_reps: set.reps != null ? String(set.reps) : '',
    actual_weight_kg: set.weight != null ? String(set.weight) : '',
    completed: set.completed,
    rir_actual: set.rir != null ? String(set.rir) : '',
    rest_sec: set.rest_seconds ?? null,
    rest_sec_actual: set.rest_seconds ?? null,
  }
}

function resolveRelationLabel(relation: FlexWorkoutRelation | null, t: ReturnType<typeof useClientT>['t']) {
  if (relation === 'replace') return t('logger.free.relation.replace')
  if (relation === 'bonus') return t('logger.free.relation.bonus')
  return t('logger.free.relation.free')
}

function relationDescription(relation: FlexWorkoutRelation | null, t: ReturnType<typeof useClientT>['t']) {
  if (relation === 'replace') return t('logger.free.relationDesc.replace')
  if (relation === 'bonus') return t('logger.free.relationDesc.bonus')
  return t('logger.free.relationDesc.free')
}

export default function FlexSessionLogger({
  session,
  initialExercises,
}: {
  session: FlexWorkoutSessionRow
  initialExercises: FlexExerciseState[]
}) {
  const router = useRouter()
  const { t } = useClientT()
  const [exercises, setExercises] = useState<FlexExerciseState[]>(initialExercises)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [saveProgress, setSaveProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null)
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialExercises.map((exercise) => [exercise.id, exercise.notes ?? ''])),
  )
  const [progressionTarget, setProgressionTarget] = useState<{ exId: string; name: string } | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<any | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyIndex, setHistoryIndex] = useState<WorkoutHistoryIndex>({})
  const [loadedHistoryNames, setLoadedHistoryNames] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<Record<string, SetRecommendation>>({})
  const [prSets, setPrSets] = useState<Set<string>>(new Set())
  const [manuallyEdited, setManuallyEdited] = useState<Set<string>>(new Set())
  const [sessionNote, setSessionNote] = useState(session.notes ?? '')
  const [sessionTitle, setSessionTitle] = useState(t('logger.free.title'))
  const [sessionTitleDraft, setSessionTitleDraft] = useState(t('logger.free.title'))
  const [perceivedDifficulty, setPerceivedDifficulty] = useState(
    session.perceived_difficulty != null ? String(session.perceived_difficulty) : '',
  )
  const [globalRir, setGlobalRir] = useState(session.global_rir != null ? String(session.global_rir) : '')

  const hasBlockingOverlay =
    sessionMenuOpen ||
    showFinishConfirm ||
    showLibrary ||
    showCustom ||
    showRename ||
    progressionTarget !== null

  useBodyScrollLock(hasBlockingOverlay)

  useEffect(() => {
    const storageKey = `flex-session-title:${session.id}`
    const savedTitle = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
    const nextTitle = savedTitle?.trim() || t('logger.free.title')
    setSessionTitle(nextTitle)
    setSessionTitleDraft(nextTitle)
  }, [session.id, t])

  // ── Saving progress simulation ──
  useEffect(() => {
    if (saveState !== 'saving') {
      setSaveProgress(0)
      return
    }
    const duration = 6000 // 6 secondes
    const start = Date.now()
    const interval = setInterval(() => {
      const elapsedSave = Date.now() - start
      const pct = Math.min(Math.round((elapsedSave / duration) * 99), 99)
      setSaveProgress(pct)
    }, 50)
    return () => clearInterval(interval)
  }, [saveState])

  useEffect(() => {
    if (!progressionTarget) {
      setExerciseHistory(null)
      return
    }
    setHistoryLoading(true)
    fetch(`/api/client/exercise-history?name=${encodeURIComponent(progressionTarget.name)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setExerciseHistory(data))
      .catch(() => setExerciseHistory(null))
      .finally(() => setHistoryLoading(false))
  }, [progressionTarget])

  const exerciseHistoryNames = useMemo(
    () => Array.from(new Set(exercises.map((exercise) => exercise.display_name).filter(Boolean))).sort(),
    [exercises],
  )

  useEffect(() => {
    const missingNames = exerciseHistoryNames.filter((name) => !loadedHistoryNames.includes(name))
    if (missingNames.length === 0) return

    let cancelled = false
    Promise.all(missingNames.map(async (name) => {
      const response = await fetch(`/api/client/exercise-history?name=${encodeURIComponent(name)}`)
      if (!response.ok) return { name, data: null }
      return { name, data: await response.json().catch(() => null) }
    })).then((results) => {
      if (cancelled) return
      setHistoryIndex((prev) => {
        const next: WorkoutHistoryIndex = { ...prev }
        for (const result of results) {
          for (const sessionEntry of result.data?.sessions ?? []) {
            for (const set of sessionEntry.sets ?? []) {
              indexExerciseHistoryEntry(next, result.name, {
                weight: Number.isFinite(Number(set.weight_kg)) ? Number(set.weight_kg) : null,
                reps: Number.isFinite(Number(set.reps)) ? Number(set.reps) : null,
                rir: set.rir != null && Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
                side: set.side ?? 'bilateral',
                set_number: set.set_number ?? null,
                completed_at: sessionEntry.date ?? null,
              })
            }
          }
        }
        return next
      })
      setLoadedHistoryNames((prev) => Array.from(new Set([...prev, ...results.map((result) => result.name)])))
    }).catch(() => {
      if (!cancelled) setLoadedHistoryNames((prev) => Array.from(new Set([...prev, ...missingNames])))
    })

    return () => {
      cancelled = true
    }
  }, [exerciseHistoryNames, loadedHistoryNames])

  const summary = useMemo(() => summarizeFlexWorkoutSession(session, exercises), [session, exercises])
  const totalSets = exercises.flatMap((exercise) => exercise.sets).length
  const completedCount = exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed).length
  const progress = totalSets > 0 ? completedCount / totalSets : 0
  const allDone = totalSets > 0 && completedCount === totalSets
  const activeSetKey = useMemo(() => {
    for (const exercise of exercises) {
      const nextSet = exercise.sets.find((set) => !set.completed)
      if (nextSet) return workoutSetKey(nextSet.exercise_log_id, nextSet.set_number, nextSet.side)
    }
    return null
  }, [exercises])
  const relationLabel = resolveRelationLabel(session.relation_to_planned_workout, t)

  const flexSetSnapshots = useMemo(
    () => exercises.flatMap((exercise) => exercise.sets.map((set) => mapSetRow(set, exercise.display_name))),
    [exercises],
  )

  const resolveFlexTargetRir = useCallback((exercise: ExerciseBlockExercise, setNumber: number): number | null => {
    const source = exercises.find((entry) => entry.id === exercise.id)
    return source?.sets.find((set) => set.set_number === setNumber)?.rir
      ?? source?.sets.find((set) => set.rir !== null)?.rir
      ?? null
  }, [exercises])

  const flexExerciseSnapshots = useMemo(
    () => exercises.map((exercise) => resolveExerciseBlock(exercise)),
    [exercises],
  )

  const historyReferences = useMemo(() => buildWorkoutHistoryReferences({
    sets: flexSetSnapshots,
    exercises: flexExerciseSnapshots,
    historyIndex,
    goal: 'hypertrophy',
    resolveTargetRir: (exercise, setNumber) => resolveFlexTargetRir(exercise as ExerciseBlockExercise, setNumber),
  }), [flexSetSnapshots, flexExerciseSnapshots, historyIndex, resolveFlexTargetRir])

  const coachingCues = useMemo(() => buildWorkoutCoachingCues({
    sets: flexSetSnapshots,
    exercises: flexExerciseSnapshots,
    resolveTargetRir: (exercise, setNumber) => resolveFlexTargetRir(exercise as ExerciseBlockExercise, setNumber),
    t: t as (key: string) => string,
  }), [flexSetSnapshots, flexExerciseSnapshots, resolveFlexTargetRir, t])

  function leaveFlexWorkout(href: string) {
    resetBodyScrollLock()
    router.push(href)
  }

  async function patchExercise(exerciseLogId: string, patch: Partial<FlexWorkoutExerciseRow>) {
    const response = await fetch(`/api/client/flex-workouts/${session.id}/exercises/${exerciseLogId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.updateExercise'))
    setExercises((prev) => prev.map((exercise) => exercise.id === exerciseLogId
      ? {
          ...exercise,
          ...data.exercise,
          display_name: data.exercise.custom_exercise_name ?? exercise.display_name,
          sets: exercise.sets,
        }
      : exercise))
  }

  async function createCatalogExercise(entry: CatalogExercise) {
    if (swapTarget) {
      await patchExercise(swapTarget, {
        exercise_id: entry.id,
        custom_exercise_name: entry.name,
        muscle_groups: Array.from(new Set([...(entry.primaryMuscles ?? []), ...(entry.secondaryMuscles ?? [])])),
        movement_pattern: entry.movementPattern ?? null,
        equipment: entry.equipment ?? [],
        primary_muscles: entry.primaryMuscles ?? [],
        secondary_muscles: entry.secondaryMuscles ?? [],
        is_compound: entry.isCompound ?? false,
        unilateral: entry.unilateral ?? false,
        image_url: entry.gifUrl ?? null,
      } as Partial<FlexWorkoutExerciseRow>)
      setSwapTarget(null)
      return
    }

    const response = await fetch(`/api/client/flex-workouts/${session.id}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise_id: entry.id,
        movement_pattern: entry.movementPattern ?? null,
        equipment: entry.equipment ?? [],
        primary_muscles: entry.primaryMuscles ?? [],
        secondary_muscles: entry.secondaryMuscles ?? [],
        is_compound: entry.isCompound ?? false,
        unilateral: entry.unilateral ?? false,
        image_url: entry.gifUrl ?? null,
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.addExercise'))

    const nextExercise: FlexExerciseState = {
      ...data.exercise,
      display_name: data.exercise.custom_exercise_name ?? entry.name,
      sets: [],
    }

    setExercises((prev) => [...prev, nextExercise].sort((a, b) => a.order_index - b.order_index))
  }

  async function createCustomExercise(draft: CustomExerciseDraft) {
    const primaryMuscles = draft.primaryMuscles.split(',').map((value) => value.trim()).filter(Boolean)
    const secondaryMuscles = draft.secondaryMuscles.split(',').map((value) => value.trim()).filter(Boolean)
    const muscleGroups = Array.from(new Set([draft.muscleGroup, ...primaryMuscles, ...secondaryMuscles].filter(Boolean)))

    if (swapTarget) {
      await patchExercise(swapTarget, {
        exercise_id: null,
        custom_exercise_name: draft.name.trim(),
        muscle_groups: muscleGroups,
        movement_pattern: draft.movementPattern || null,
        equipment: draft.equipment.split(',').map((value) => value.trim()).filter(Boolean),
        primary_muscles: primaryMuscles,
        secondary_muscles: secondaryMuscles,
        is_compound: draft.isCompound,
        unilateral: draft.unilateral,
        image_url: null,
      } as Partial<FlexWorkoutExerciseRow>)
      setSwapTarget(null)
      return
    }

    const response = await fetch(`/api/client/flex-workouts/${session.id}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custom_exercise_name: draft.name.trim(),
        muscle_groups: muscleGroups,
        movement_pattern: draft.movementPattern || null,
        equipment: draft.equipment.split(',').map((value) => value.trim()).filter(Boolean),
        primary_muscles: primaryMuscles,
        secondary_muscles: secondaryMuscles,
        is_compound: draft.isCompound,
        unilateral: draft.unilateral,
        image_url: null,
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.createCustomExercise'))

    const nextExercise: FlexExerciseState = {
      ...data.exercise,
      display_name: data.exercise.custom_exercise_name ?? draft.name.trim(),
      sets: [],
    }

    setExercises((prev) => [...prev, nextExercise].sort((a, b) => a.order_index - b.order_index))
  }

  async function deleteExercise(exerciseLogId: string) {
    const response = await fetch(`/api/client/flex-workouts/${session.id}/exercises/${exerciseLogId}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.deleteExercise'))
    setExercises((prev) => prev.filter((exercise) => exercise.id !== exerciseLogId))
  }

  async function createSet(exerciseLogId: string) {
    const exercise = exercises.find((entry) => entry.id === exerciseLogId)
    if (!exercise) return
    const nextSetNumber = (exercise.sets.reduce((max, set) => Math.max(max, set.set_number), 0)) + 1
    const sides: Array<'left' | 'right' | 'bilateral'> = exercise.unilateral ? ['right', 'left'] : ['bilateral']

    const createdSets = await Promise.all(sides.map(async (side) => {
      const response = await fetch(`/api/client/flex-workouts/${session.id}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_log_id: exerciseLogId,
          set_number: nextSetNumber,
          side,
          set_type: 'working',
          completed: false,
          tempo: getDefaultTempo(exercise.movement_pattern ?? null, 'hypertrophy'),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? t('flex.error.addSet'))
      return data.set as FlexWorkoutSetRow
    }))

    setExercises((prev) => prev.map((entry) => entry.id === exerciseLogId
      ? {
          ...entry,
          sets: [...entry.sets, ...createdSets].sort((a, b) => {
            if (a.set_number !== b.set_number) return a.set_number - b.set_number
            return a.side.localeCompare(b.side)
          }),
        }
      : entry))
  }

  async function patchSet(exerciseLogId: string, setId: string, patch: Partial<FlexWorkoutSetRow>) {
    const response = await fetch(`/api/client/flex-workouts/${session.id}/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.updateSet'))

    setExercises((prev) => prev.map((entry) => entry.id === exerciseLogId
      ? { ...entry, sets: entry.sets.map((set) => set.id === setId ? data.set : set) }
      : entry))

    return data.set as FlexWorkoutSetRow
  }

  function buildNextExercisesWithSet(exerciseLogId: string, updatedSet: FlexWorkoutSetRow) {
    return exercises.map((entry) => entry.id === exerciseLogId
      ? { ...entry, sets: entry.sets.map((set) => set.id === updatedSet.id ? updatedSet : set) }
      : entry)
  }

  function triggerFlexRecommendation(updatedSet: FlexWorkoutSetRow, nextExercises: FlexExerciseState[]) {
    const exercise = nextExercises.find((entry) => entry.id === updatedSet.exercise_log_id)
    if (!exercise) return

    const completedSet = mapSetRow(updatedSet, exercise.display_name)
    const nextSets = nextExercises.flatMap((entry) => entry.sets.map((set) => mapSetRow(set, entry.display_name)))
    const nextExerciseSnapshots = nextExercises.map((entry) => resolveExerciseBlock(entry))
    const result = recommendFollowingWorkoutSet({
      completedSet,
      sets: nextSets,
      exercises: nextExerciseSnapshots,
      historyIndex,
      goal: 'hypertrophy',
      level: 'intermediate',
      manuallyEdited,
      resolveTargetRir: (snapshot, setNumber) => {
        const source = nextExercises.find((entry) => entry.id === snapshot.id)
        return source?.sets.find((set) => set.set_number === setNumber)?.rir
          ?? source?.sets.find((set) => set.rir !== null)?.rir
          ?? null
      },
    })

    if (!result) return
    setRecommendations((prev) => ({ ...prev, [result.nextKey]: result.recommendation }))
  }

  function detectFlexPr(updatedSet: FlexWorkoutSetRow, exerciseName: string) {
    const reps = Number(updatedSet.reps)
    const weight = Number(updatedSet.weight)
    if (!Number.isFinite(reps) || !Number.isFinite(weight) || reps <= 0 || weight <= 0) return

    const historyBest = getExerciseHistoryEntries(historyIndex, exerciseName).reduce((best, entry) => {
      if (entry.weight === null || entry.reps === null) return best
      if (!best) return entry
      if (entry.weight > (best.weight ?? 0)) return entry
      if (entry.weight === best.weight && entry.reps > (best.reps ?? 0)) return entry
      return best
    }, null as WorkoutHistoryEntry | null)

    const isNewPr = !historyBest ||
      weight > (historyBest.weight ?? 0) ||
      (weight === historyBest.weight && reps > (historyBest.reps ?? 0))

    if (isNewPr) {
      setPrSets((prev) => new Set(prev).add(workoutSetKey(updatedSet.exercise_log_id, updatedSet.set_number, updatedSet.side)))
    }
  }

  async function deleteSet(exerciseLogId: string, setId: string) {
    const response = await fetch(`/api/client/flex-workouts/${session.id}/sets/${setId}`, { method: 'DELETE' })
    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error ?? t('flex.error.deleteSet'))
    setExercises((prev) => prev.map((entry) => entry.id === exerciseLogId
      ? { ...entry, sets: entry.sets.filter((set) => set.id !== setId) }
      : entry))
  }

  async function finishSession() {
    setSaveState('saving')
    setErrorMsg(null)
    const submitStartTime = Date.now()
    try {
      const noteUpdates = exercises
        .filter((exercise) => (exerciseNotes[exercise.id] ?? '') !== (exercise.notes ?? ''))
        .map((exercise) =>
          patchExercise(exercise.id, {
            notes: exerciseNotes[exercise.id]?.trim() ? exerciseNotes[exercise.id].trim() : null,
          }),
        )

      if (noteUpdates.length > 0) {
        await Promise.all(noteUpdates)
      }

      const response = await fetch(`/api/client/flex-workouts/${session.id}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: sessionNote.trim() || null,
          perceived_difficulty: perceivedDifficulty === '' ? null : Number(perceivedDifficulty),
          global_rir: globalRir === '' ? null : Number(globalRir),
          relation_to_planned_workout: session.relation_to_planned_workout,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? t('common.error'))

      const elapsedSave = Date.now() - submitStartTime
      if (elapsedSave < 6000) {
        await new Promise(resolve => setTimeout(resolve, 6000 - elapsedSave))
      }
      setSaveProgress(100)
      await new Promise(resolve => setTimeout(resolve, 300))

      leaveFlexWorkout(data?.legacySessionId ? `/client/programme/recap/${data.legacySessionId}` : `/client/flex-workout/recap/${session.id}`)
    } catch (error) {
      setSaveState('error')
      setErrorMsg(error instanceof Error ? error.message : t('common.unknownError'))
    } finally {
      setSaveState('idle')
    }
  }

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      <header
        className="fixed inset-x-0 top-0 z-40 bg-[#0d0d0d]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => leaveFlexWorkout('/client/programme')}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 active:scale-95 transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white">{t('logger.free.title')}</p>
            <p className="mt-0.5 text-[15px] font-semibold text-white">{sessionTitle}</p>
            <LiveElapsedText startedAt={session.started_at} className="text-[13px] font-mono font-bold text-white/82 tabular-nums" />
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#3b82f6]/12 px-2 py-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#93c5fd]">
              {relationLabel}
            </span>
            <button
              onClick={() => setSessionMenuOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 active:scale-95 transition-all"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
        <div className="h-[2px] bg-white/[0.06] mx-4 mb-2 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#60a5fa] transition-all duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="pb-2 text-center text-[10px] text-white/25 font-barlow-condensed uppercase tracking-[0.1em]">
          {t('logger.set.validatedCount', { done: completedCount, total: Math.max(totalSets, 0) })}
        </p>
      </header>

      {saveState === 'error' && errorMsg ? (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-[11px] text-red-300" style={{ marginTop: 'calc(env(safe-area-inset-top) + 88px)' }}>{errorMsg}</div>
      ) : null}

      <main
        className="flex flex-col gap-3 px-4 pb-28"
        style={{ paddingTop: saveState === 'error' && errorMsg ? '16px' : 'calc(env(safe-area-inset-top) + 104px)' }}
      >
        <div className="rounded-2xl bg-[#111111] px-4 py-3">
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#60a5fa]">Flex training</p>
          <p className="mt-1 text-[12px] text-white/45">{relationDescription(session.relation_to_planned_workout, t)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <LiveElapsedPill startedAt={session.started_at} />
            <StatPill icon={<Dumbbell size={11} />} label={`${exercises.length} ex.`} />
            <StatPill icon={<Flag size={11} />} label={t('logger.sets.totalOnly', { n: summary.total_sets })} />
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-2xl bg-[#111111] px-4 py-10 text-center">
            <p className="text-[16px] font-semibold text-white">{t('logger.free.empty.title')}</p>
            <p className="mt-2 text-[12px] text-white/35">{t('logger.free.empty.desc')}</p>
            <button
              onClick={() => setShowLibrary(true)}
              className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-5 font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] text-[#080808] active:scale-[0.98]"
            >
              <Plus size={14} />
              {t('logger.add.exercise')}
            </button>
          </div>
        ) : (
          exercises.map((exercise) => (
            <div key={exercise.id}>
              <ExerciseBlock
                exercise={resolveExerciseBlock(exercise)}
                activeSetKey={activeSetKey}
                sets={exercise.sets.map((set) => mapSetRow(set, exercise.display_name))}
                recommendations={recommendations}
                historyReferences={historyReferences}
                prSets={prSets}
                coachingCues={coachingCues}
                onValidateSet={(exerciseId, setNum, side, reps, weight, rir) => {
                  const targetSet = exercise.sets.find((set) => set.exercise_log_id === exerciseId && set.set_number === setNum && set.side === side)
                  if (!targetSet) return
                  void patchSet(exerciseId, targetSet.id, {
                    reps: reps === '' ? null : Number(reps),
                    weight: weight === '' ? null : Number(weight),
                    rir: rir === '' ? null : Number(rir),
                    completed: true,
                  }).then((updatedSet) => {
                    const nextExercises = buildNextExercisesWithSet(exerciseId, updatedSet)
                    triggerFlexRecommendation(updatedSet, nextExercises)
                    detectFlexPr(updatedSet, exercise.display_name)
                  }).catch((error) => setErrorMsg(error instanceof Error ? error.message : t('common.unknownError')))
                }}
                onDeleteSet={(exerciseId, setNum, side) => {
                  const targetSet = exercise.sets.find((set) => set.exercise_log_id === exerciseId && set.set_number === setNum && set.side === side)
                  if (!targetSet) return
                  void deleteSet(exerciseId, targetSet.id)
                }}
                onChangeSet={(exerciseId, setNum, side, patch) => {
                  const targetSet = exercise.sets.find((set) => set.exercise_log_id === exerciseId && set.set_number === setNum && set.side === side)
                  if (!targetSet) return
                  setManuallyEdited((prev) => new Set(prev).add(workoutSetKey(exerciseId, setNum, side)))
                  void patchSet(exerciseId, targetSet.id, {
                    reps: patch.actual_reps !== undefined ? (patch.actual_reps === '' ? null : Number(patch.actual_reps)) : undefined,
                    weight: patch.actual_weight_kg !== undefined ? (patch.actual_weight_kg === '' ? null : Number(patch.actual_weight_kg)) : undefined,
                    rir: patch.rir_actual !== undefined ? (patch.rir_actual === '' ? null : Number(patch.rir_actual)) : undefined,
                    completed: patch.completed,
                    set_type: patch.set_type as SetType | undefined,
                  })
                }}
                onAddSet={(exerciseId) => { void createSet(exerciseId) }}
                onSwap={(exerciseId) => { setSwapTarget(exerciseId); setShowLibrary(true) }}
                onRest={() => {}}
                onNote={(exerciseId) => setShowNoteInput((prev) => prev === exerciseId ? null : exerciseId)}
                onTempo={() => {}}
                onDeleteExercise={(exerciseId) => { void deleteExercise(exerciseId) }}
                onOpenProgression={(exerciseId, name) => setProgressionTarget({ exId: exerciseId, name })}
                resolveTargetRir={(setNumber) => resolveFlexTargetRir(resolveExerciseBlock(exercise), setNumber)}
              />

              {showNoteInput === exercise.id ? (
                <div className="mt-1 px-1">
                  <textarea
                    autoFocus
                    rows={2}
                    value={exerciseNotes[exercise.id] ?? ''}
                    onChange={(event) => setExerciseNotes((prev) => ({ ...prev, [exercise.id]: event.target.value }))}
                    onBlur={() => {
                      void patchExercise(exercise.id, { notes: exerciseNotes[exercise.id] ?? null })
                    }}
                    placeholder={t('logger.note.placeholder')}
                    className="w-full resize-none rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none"
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#0d0d0d] px-4 pt-4"
        style={{ paddingBottom: '16px' }}
      >
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            onClick={() => setShowLibrary(true)}
            className="flex flex-1 items-center justify-between rounded-xl bg-white/[0.04] pl-5 pr-2 py-1.5"
          >
            <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-white/85">{t('logger.add.exercise')}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
              <Plus size={15} className="text-white/80" />
            </div>
          </button>
          <button
            onClick={() => setShowFinishConfirm(true)}
            disabled={saveState === 'saving' || !allDone}
            className="flex flex-1 items-center justify-between rounded-xl bg-[#f2f2f2] pl-5 pr-2 py-1.5 disabled:opacity-40"
          >
            <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-[#080808]">{t('logger.finish')}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.15]">
              <Sparkles size={15} className="text-[#080808]" />
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {sessionMenuOpen ? (
          <>
            <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSessionMenuOpen(false)} />
            <motion.div
              className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl bg-[#111111]"
              style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
              exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            >
              <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
              <div className="pt-4 divide-y divide-white/[0.05]">
                <button onClick={() => { setSessionTitleDraft(sessionTitle); setShowRename(true); setSessionMenuOpen(false) }} className="w-full px-6 py-4 text-left text-[15px] font-medium text-white active:bg-white/[0.04]">
                  {t('logger.free.rename')}
                </button>
                <button onClick={() => { setShowLibrary(true); setSessionMenuOpen(false) }} className="w-full px-6 py-4 text-left text-[15px] font-medium text-white active:bg-white/[0.04]">
                  {t('logger.add.exercise')}
                </button>
                <button onClick={() => { setShowCustom(true); setSessionMenuOpen(false) }} className="w-full px-6 py-4 text-left text-[15px] font-medium text-white active:bg-white/[0.04]">
                  {t('logger.create.customExercise')}
                </button>
                <button onClick={() => { setSessionMenuOpen(false); setShowFinishConfirm(true) }} className="w-full px-6 py-4 text-left text-[15px] font-medium text-red-400 active:bg-white/[0.04]">
                  {t('logger.finish')}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {showLibrary ? (
        <LibrarySheet
          onClose={() => {
            setShowLibrary(false)
            setSwapTarget(null)
          }}
          onCreateCustom={() => {
            setShowLibrary(false)
            setShowCustom(true)
          }}
          onSelect={(entry) => {
            void createCatalogExercise(entry)
              .then(() => {
                setShowLibrary(false)
                setSwapTarget(null)
              })
              .catch((error) => setErrorMsg(error instanceof Error ? error.message : t('common.unknownError')))
          }}
        />
      ) : null}

      {showCustom ? (
        <CustomExerciseSheet
          onClose={() => setShowCustom(false)}
          onCreate={(draft) => {
            void createCustomExercise(draft)
              .then(() => setShowCustom(false))
              .catch((error) => setErrorMsg(error instanceof Error ? error.message : t('common.unknownError')))
          }}
        />
      ) : null}

      {showRename ? (
        <RenameSessionSheet
          value={sessionTitleDraft}
          onChange={setSessionTitleDraft}
          onClose={() => setShowRename(false)}
          onSave={() => {
            const nextTitle = sessionTitleDraft.trim() || t('logger.free.title')
            setSessionTitle(nextTitle)
            setSessionTitleDraft(nextTitle)
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(`flex-session-title:${session.id}`, nextTitle)
            }
            setShowRename(false)
          }}
        />
      ) : null}

      <AnimatePresence>
        {showFinishConfirm ? (
          <>
            <motion.div className="fixed inset-0 z-[75] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishConfirm(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[80] rounded-t-2xl bg-[#111111] px-5 pt-4"
              style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            >
              <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
              <p className="text-[18px] font-bold text-white">{t('logger.free.finish.title')}</p>
              <p className="mt-2 text-[12px] text-white/35">{t('logger.free.finish.desc')}</p>
              <div className="mt-4 space-y-3">
                <TextField
                  label={t('logger.free.note')}
                  value={sessionNote}
                  onChange={setSessionNote}
                  placeholder={t('logger.free.note.placeholder')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label={t('logger.free.difficulty')}
                    value={perceivedDifficulty}
                    onChange={setPerceivedDifficulty}
                    placeholder="7"
                  />
                  <TextField
                    label={t('logger.free.globalRir')}
                    value={globalRir}
                    onChange={setGlobalRir}
                    placeholder="2"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowFinishConfirm(false)}
                  className="h-11 flex-1 rounded-xl bg-white/[0.05] px-4 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/78"
                >
                  Continuer
                </button>
                <button
                  onClick={() => void finishSession()}
                  className="h-11 flex-1 rounded-xl bg-[#f2f2f2] px-4 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808]"
                >
                  Valider
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {progressionTarget ? (() => {
          const currentExercise = exercises.find((exercise) => exercise.id === progressionTarget.exId)
          const currentDone = currentExercise?.sets.filter((set) => set.completed) ?? []
          const bestCurrentWeight = currentDone.length > 0
            ? Math.max(...currentDone.map((set) => Number(set.weight) || 0))
            : null
          const sessions = exerciseHistory?.sessions ?? []
          const recentSessions = sessions.slice(-3).reverse()
          const sparkPoints = sessions.map((entry: any) => Number(entry.best_weight) || 0)
          const sparkMax = sparkPoints.length > 0 ? Math.max(...sparkPoints) : 0
          const sparkMin = sparkPoints.length > 0 ? Math.min(...sparkPoints) : 0
          const sparkRange = sparkMax - sparkMin || 1
          const sparkWidth = 280
          const sparkHeight = 48
          const sparkPadding = 4
          const sx = (index: number) => sparkPoints.length < 2 ? sparkWidth / 2 : sparkPadding + (index / (sparkPoints.length - 1)) * (sparkWidth - sparkPadding * 2)
          const sy = (value: number) => sparkHeight - sparkPadding - ((value - sparkMin) / sparkRange) * (sparkHeight - sparkPadding * 2)
          const sparkPath = sparkPoints.map((value, index) => `${index === 0 ? 'M' : 'L'} ${sx(index)} ${sy(value)}`).join(' ')
          const lastSession = sessions[sessions.length - 1]
          const delta = lastSession && bestCurrentWeight
            ? Math.round((bestCurrentWeight - Number(lastSession.best_weight || 0)) * 10) / 10
            : null

          return (
          <>
            <motion.div className="fixed inset-0 z-[85] bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setProgressionTarget(null)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[90] max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-[#111111] px-5 pt-4"
              style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black text-white">{progressionTarget.name}</p>
                  {exerciseHistory?.all_time_best > 0 ? (
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {t('logger.progress.allTimeBest')} · <span className="font-bold text-white/70">{exerciseHistory.all_time_best}kg</span>
                      {exerciseHistory.session_count > 0 ? <span className="ml-2 text-white/25">· {t('logger.sessionCount', { n: exerciseHistory.session_count })}</span> : null}
                    </p>
                  ) : null}
                </div>
                {delta !== null ? (
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-[12px] font-black tabular-nums ${delta >= 0 ? 'bg-[#5dba87]/20 text-[#5dba87]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}>
                    {delta >= 0 ? '+' : ''}{delta}kg
                  </span>
                ) : null}
              </div>
              {historyLoading ? (
                <p className="mt-4 text-[12px] text-white/35">Chargement…</p>
              ) : sessions.length ? (
                <>
                  {sparkPoints.length >= 2 ? (
                    <div className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{t('logger.progress.maxLoad')}</span>
                        {exerciseHistory?.progression !== 0 ? (
                          <span className={`text-[10px] font-bold tabular-nums ${exerciseHistory.progression > 0 ? 'text-[#5dba87]' : 'text-[#ef4444]'}`}>
                            {exerciseHistory.progression > 0 ? '+' : ''}{exerciseHistory.progression}kg total
                          </span>
                        ) : null}
                      </div>
                      <svg viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} className="w-full" style={{ height: 48 }}>
                        <path d={sparkPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
                        {sparkPoints.map((value, index) => (
                          <circle key={index} cx={sx(index)} cy={sy(value)} r="2.5" fill="#60a5fa" opacity={index === sparkPoints.length - 1 ? 1 : 0.5} />
                        ))}
                      </svg>
                      <div className="mt-0.5 flex justify-between text-[8px] font-mono text-white/25">
                        <span>{sparkPoints[0]}kg</span>
                        <span>{sparkPoints[sparkPoints.length - 1]}kg</span>
                      </div>
                    </div>
                  ) : null}

                  {currentDone.length > 0 ? (
                    <div className="mt-4 rounded-xl bg-white/[0.03] px-3 py-3">
                      <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{t('logger.progress.thisSession')}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {currentDone.map((set) => (
                          <span key={set.id} className="rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/70">
                            {set.reps ?? '—'} reps · {set.weight ?? '—'}kg{set.rir != null ? ` · RIR ${set.rir}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {recentSessions.map((entry: any) => (
                      <div key={`${entry.date}-${entry.session_name}`} className="rounded-xl bg-white/[0.04] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-[12px] font-semibold text-white">{entry.session_name || t('logger.session.single')}</p>
                          <span className="shrink-0 text-[11px] font-bold text-white/70">{entry.best_weight}kg</span>
                        </div>
                        <p className="mt-1 text-[11px] text-white/35">{entry.date}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-[12px] text-white/35">{t('programme.noHistory')}</p>
              )}
            </motion.div>
          </>
          )
        })() : null}
      </AnimatePresence>

      {/* ── Overlay de sauvegarde flouté plein écran ── */}
      <AnimatePresence>
        {saveState === 'saving' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl"
            style={{ touchAction: 'none' }}
          >
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo/logo-stryvr-silver.png"
                  alt="STRYVR Logo"
                  className="h-16 w-auto object-contain opacity-90"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-3xl font-black text-white/90 tracking-tight">
                  {saveProgress}%
                </span>
                <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.2em] text-white/35 animate-pulse">
                  {saveProgress === 100 ? t('logger.saving.completed') : t('logger.saving.progress')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-medium text-white/60">
      {icon}
      {label}
    </span>
  )
}

function useElapsedSeconds(startedAt: string) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const startAt = new Date(startedAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startAt) / 1000)))
    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [startedAt])

  return elapsed
}

function LiveElapsedText({ startedAt, className }: { startedAt: string; className?: string }) {
  const elapsed = useElapsedSeconds(startedAt)
  return <p className={className}>{formatTime(elapsed)}</p>
}

function LiveElapsedPill({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedSeconds(startedAt)
  return <StatPill icon={<Clock size={11} />} label={formatTime(elapsed)} />
}

function LibrarySheet({
  onClose,
  onSelect,
  onCreateCustom,
}: {
  onClose: () => void
  onSelect: (exercise: CatalogExercise) => void
  onCreateCustom: () => void
}) {
  const { t } = useClientT()
  const [search, setSearch] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [movementPattern, setMovementPattern] = useState('')
  const [resultLimit, setResultLimit] = useState(LIBRARY_PAGE_SIZE)
  const deferredSearch = useDeferredValue(search)
  const muscleGroups = preparedMuscleGroups
  const movementPatterns = preparedMovementPatterns

  useEffect(() => {
    setResultLimit(LIBRARY_PAGE_SIZE)
  }, [deferredSearch, muscleGroup, movementPattern])

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeSearchText(deferredSearch)
    return preparedCatalog.filter((entry) => {
      const matchesGroup = !muscleGroup || entry.muscleGroup === muscleGroup
      const matchesPattern = !movementPattern || entry.movementPattern === movementPattern
      const matchesSearch = !normalizedSearch || entry.searchIndex.includes(normalizedSearch)
      return matchesGroup && matchesPattern && matchesSearch
    })
  }, [deferredSearch, muscleGroup, movementPattern])

  const visibleResults = useMemo(() => filtered.slice(0, resultLimit), [filtered, resultLimit])
  const canLoadMore = filtered.length > resultLimit

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t('ui.close')} />
      <div className="relative max-h-[88dvh] w-full max-w-2xl rounded-t-2xl bg-[#111111] px-5 pt-4 pb-5">
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#60a5fa]">{t('logger.library.title')}</p>
            <p className="mt-1 text-[18px] font-bold text-white">{t('logger.library.addTitle')}</p>
            <p className="mt-1 text-[12px] text-white/35">{t('logger.library.desc')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40">
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#0a0a0a] px-3">
          <Search size={14} className="text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('logger.library.search')}
            className="h-12 w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white/20"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setMuscleGroup('')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${muscleGroup === '' ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/35'}`}
          >
            {t('common.all')}
          </button>
          {muscleGroups.map((group) => (
            <button
              key={group}
              onClick={() => setMuscleGroup(group)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${muscleGroup === group ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/35'}`}
            >
              {group}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setMovementPattern('')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${movementPattern === '' ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/35'}`}
          >
            {t('logger.library.allMoves')}
          </button>
          {movementPatterns.map((pattern) => (
            <button
              key={pattern}
              onClick={() => setMovementPattern(pattern)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${movementPattern === pattern ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/35'}`}
            >
              {pattern.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
          {visibleResults.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05]">
                  {entry.gifUrl ? (
                    <img
                      src={entry.gifUrl}
                      alt={entry.displayName}
                      width={48}
                      height={48}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[18px] text-white/15">💪</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-white">{entry.displayName}</p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {[entry.muscleGroup, entry.primaryMuscle, entry.exerciseType].filter(Boolean).join(' · ') || t('logger.library.title')}
                  </p>
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                <Plus size={14} className="text-white/60" />
              </div>
            </button>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white/[0.03] px-4 py-6 text-center">
              <p className="text-[13px] font-semibold text-white">{t('logger.library.none')}</p>
              <p className="mt-1 text-[11px] text-white/35">{t('logger.library.noneDesc')}</p>
            </div>
          ) : null}

          {canLoadMore ? (
            <button
              onClick={() => setResultLimit((value) => value + LIBRARY_PAGE_SIZE)}
              className="w-full rounded-xl bg-white/[0.04] px-4 py-3 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/70"
            >
              {t('logger.library.more')}
            </button>
          ) : null}
        </div>

        <button
          onClick={onCreateCustom}
          className="mt-4 h-11 w-full rounded-xl bg-white/[0.05] font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/80"
        >
          {t('logger.create.customExercise')}
        </button>
      </div>
    </div>
  )
}

function CustomExerciseSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (draft: CustomExerciseDraft) => void
}) {
  const { t } = useClientT()
  const [draft, setDraft] = useState<CustomExerciseDraft>({
    name: '',
    muscleGroup: '',
    movementPattern: '',
    equipment: '',
    primaryMuscles: '',
    secondaryMuscles: '',
    isCompound: false,
    unilateral: false,
  })

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t('ui.close')} />
      <div className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-[#111111] px-5 pt-4 pb-5">
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#60a5fa]">{t('logger.custom.title')}</p>
            <p className="mt-1 text-[18px] font-bold text-white">{t('logger.custom.createTitle')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40">
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <TextField label={t('logger.field.name')} value={draft.name} onChange={(value) => setDraft((prev) => ({ ...prev, name: value }))} placeholder={t('logger.placeholder.exerciseExample')} />
          <TextField label={t('logger.field.muscleGroup')} value={draft.muscleGroup} onChange={(value) => setDraft((prev) => ({ ...prev, muscleGroup: value }))} placeholder={t('logger.placeholder.back')} />
          <SelectField label={t('logger.field.movementType')} value={draft.movementPattern} onChange={(value) => setDraft((prev) => ({ ...prev, movementPattern: value }))}>
            <option value="">{t('logger.field.select')}</option>
            {MOVEMENT_PATTERN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
          <TextField label={t('logger.field.equipment')} value={draft.equipment} onChange={(value) => setDraft((prev) => ({ ...prev, equipment: value }))} placeholder={t('logger.placeholder.equipment')} />
          <TextField label={t('logger.field.primaryMuscles')} value={draft.primaryMuscles} onChange={(value) => setDraft((prev) => ({ ...prev, primaryMuscles: value }))} placeholder={t('logger.placeholder.primaryMuscles')} />
          <TextField label={t('logger.field.secondaryMuscles')} value={draft.secondaryMuscles} onChange={(value) => setDraft((prev) => ({ ...prev, secondaryMuscles: value }))} placeholder={t('logger.placeholder.secondaryMuscles')} />
          <div className="grid grid-cols-2 gap-2">
            <ToggleField label={t('logger.field.compound')} checked={draft.isCompound} onToggle={() => setDraft((prev) => ({ ...prev, isCompound: !prev.isCompound }))} />
            <ToggleField label={t('logger.field.unilateral')} checked={draft.unilateral} onToggle={() => setDraft((prev) => ({ ...prev, unilateral: !prev.unilateral }))} />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => onCreate(draft)}
            disabled={!draft.name.trim() || !draft.muscleGroup.trim()}
            className="h-11 flex-1 rounded-xl bg-[#f2f2f2] px-4 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808] disabled:opacity-40"
          >
            {t('logger.action.create')}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl bg-white/[0.05] px-5 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/78"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RenameSessionSheet({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: string
  onChange: (value: string) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useClientT()
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60">
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t('ui.close')} />
      <div className="relative w-full max-w-2xl rounded-t-2xl bg-[#111111] px-5 pt-4 pb-5">
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#60a5fa]">{t('logger.session.single')}</p>
            <p className="mt-1 text-[18px] font-bold text-white">{t('logger.free.rename')}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40">
            <X size={14} />
          </button>
        </div>

        <div className="mt-4">
          <TextField
            label={t('logger.field.name')}
            value={value}
            onChange={onChange}
            placeholder={t('logger.placeholder.sessionTitle')}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onSave}
            className="h-11 flex-1 rounded-xl bg-[#f2f2f2] px-4 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-[#080808]"
          >
            {t('common.save')}
          </button>
          <button
            onClick={onClose}
            className="h-11 rounded-xl bg-white/[0.05] px-5 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/78"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">{label}</p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl bg-[#0a0a0a] px-4 text-[14px] text-white outline-none placeholder:text-white/20"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl bg-[#0a0a0a] px-4 text-[14px] text-white outline-none"
      >
        {children}
      </select>
    </div>
  )
}

function ToggleField({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className={`rounded-xl px-4 py-3 text-left ${checked ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/55'}`}>
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em]">{label}</p>
    </button>
  )
}
