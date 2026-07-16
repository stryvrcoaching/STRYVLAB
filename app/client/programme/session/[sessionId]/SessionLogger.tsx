'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertCircle, RefreshCw,
  Clock, X, Flag, MoreHorizontal, RefreshCw as Rotate, Plus, Search
} from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'
import ExerciseSwapSheet from './ExerciseSwapSheet'
import exerciseCatalog from '@/data/exercise-catalog.json'

const CyclePhasePill = dynamic(() => import('@/components/client/cycle/CyclePhasePill'), { ssr: false })
import ClientAlternativesSheet from '@/components/client/ClientAlternativesSheet'
import type { SetRecommendation } from '@/lib/training/setRecommendation'
import type { HistoryReferenceSelection } from '@/lib/training/historyReference'
import { getCatalogEntryByName } from '@/lib/programs/intelligence/catalog-utils'
import { getExerciseHistoryEntries } from '@/lib/training/exerciseHistoryKey'
import {
  averagePlannedReps,
  buildWorkoutCoachingCues,
  buildWorkoutHistoryReferences,
  formatWorkoutWeight as formatWeight,
  recommendFollowingWorkoutSet,
  workoutSetKey as recKey,
} from '@/lib/training/workoutIntelligence'
import { getDefaultTempo, parseTempo } from '@/lib/training/tempo'
import { estimateSessionDurationMin } from '@/lib/training/sessionDuration'
import { findFirstIncompleteWorkoutSetKey } from '@/lib/training/workoutSequence'
import { sendClientMutation } from '@/lib/client/offline-mutations'
import { showRestEndingSoonNotification } from '@/lib/client/restNotification'
import { shouldStartPrescribedRest } from '@/lib/training/restPolicy'
import type { PlannedSetType, SetPrescription } from '@/lib/programs/setPrescriptions'
import TempoGuideModal from '@/components/client/TempoGuideModal'
import PrepTimeModal, { getPrepTime, hasPrepTimeConfigured, getHapticsEnabled } from '@/components/client/PrepTimeModal'
import ExerciseBlock, { type ExerciseBlockExercise } from '@/components/client/smart/ExerciseBlock'
import SupersetContextMenu from '@/components/client/smart/SupersetContextMenu'
import useBodyScrollLock, { resetBodyScrollLock } from '@/components/client/useBodyScrollLock'
import { motion, AnimatePresence } from 'framer-motion'
import type { SetRowData, SetType } from '@/components/client/smart/SetRow'
import { TRAINING_ACCENT } from '@/lib/nutrition/ui-colors'
import { REST_END_BUFFER_SEC } from '@/lib/training/restMetrics'

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
const REST_VISUAL_GREEN = TRAINING_ACCENT
const REST_TOUCH_START_OFFSET_SEC = 5
const REST_MODAL_REOPEN_MS = 10_000
const REST_READY_BUFFER_MS = 5_000
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

// ─── Types ──────────────────────────────────────────────────────────────────

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
  target_rir: number | null
  current_weight_kg: number | null
  rep_min: number | null
  rep_max: number | null
  progressive_overload_enabled: boolean
  weight_increment_kg?: number | null
  primary_muscles?: string[]
  secondary_muscles?: string[]
  group_id?: string | null
  clientAlternatives?: string[]
  tempo?: string | null
  movement_pattern?: string | null
  set_prescriptions?: SetPrescription[] | null
  isCustom?: boolean
  execution_type?: 'reps_rir' | 'time_rpe' | 'distance_rpe'
  target_hr_zone?: string | null
}

type ExerciseSwapOverride = { name: string; image_url: string | null }

function resolveExerciseForBlock(
  ex: Exercise,
  swapped: Record<string, ExerciseSwapOverride>,
): ExerciseBlockExercise {
  const swap = swapped[ex.id]
  return {
    ...ex,
    name: swap?.name ?? ex.name,
    image_url: swap?.image_url ?? ex.image_url,
  } as ExerciseBlockExercise
}

function displayNameForExercise(ex: Exercise, swapped: Record<string, ExerciseSwapOverride>): string {
  return swapped[ex.id]?.name ?? ex.name
}

function resolveExerciseTargetRir(exercise: Exercise, setNumber: number): number | null {
  return exercise.set_prescriptions?.find((entry) => entry.set_number === setNumber)?.rir
    ?? exercise.target_rir
    ?? exercise.rir
    ?? null
}

function resolveExerciseTempo(exercise: Exercise, setNumber: number, goal: string): string | null {
  const fallbackTempo = exercise.tempo ?? getDefaultTempo(exercise.movement_pattern ?? null, goal)
  return exercise.set_prescriptions?.find((entry) => entry.set_number === setNumber)?.tempo
    ?? fallbackTempo
    ?? null
}

interface SetLog {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  set_type: SetType
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
  notes: string
  rest_sec_actual: number | null
  rest_sec: number | null
  primary_muscles: string[]
  secondary_muscles: string[]
  tempo_used: string | null
}

interface LastPerf {
  weight: number | null
  reps: number | null
  rir?: number | null
  side?: string | null
  set_number?: number | null
  completed_at?: string | null
}

type HistoryReference = HistoryReferenceSelection

interface Props {
  clientId: string
  sessionId: string
  session: { id: string; name: string; programId: string }
  exercises: Exercise[]
  lastPerformance: Record<string, LastPerf[]>
  goal: string
  level: string
  clientWeight?: number
  clientGender?: string | null
}

type SaveState = 'idle' | 'saving' | 'error'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialSets(exercises: Exercise[], goal: string): SetLog[] {
  const sets: SetLog[] = []
  for (const ex of exercises) {
    const resolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
    const plannedRows = Array.isArray(ex.set_prescriptions) && ex.set_prescriptions.length > 0
      ? ex.set_prescriptions
      : Array.from({ length: ex.sets }, (_, index) => ({
          set_number: index + 1,
          reps: ex.reps,
          rest_sec: ex.rest_sec,
          rir: ex.rir,
          tempo: ex.tempo ?? null,
          set_type: null as PlannedSetType,
        }))

    for (let i = 0; i < plannedRows.length; i++) {
      const planned = plannedRows[i]
      const plannedTempo = planned.tempo ?? resolvedTempo
      const plannedType = planned.set_type ?? 'working'
      if (ex.is_unilateral) {
        for (const side of ['right', 'left'] as const) {
          sets.push({
            exercise_id: ex.id,
            exercise_name: ex.name,
            set_number: planned.set_number ?? i + 1,
            side,
            set_type: plannedType,
            planned_reps: planned.reps ?? ex.reps,
            actual_reps: '',
            actual_weight_kg: ex.current_weight_kg !== null ? String(ex.current_weight_kg) : '',
            completed: false,
            rir_actual: '',
            notes: '',
            rest_sec_actual: null,
            rest_sec: planned.rest_sec ?? ex.rest_sec,
            primary_muscles: ex.primary_muscles ?? [],
            secondary_muscles: ex.secondary_muscles ?? [],
            tempo_used: plannedTempo,
          })
        }
      } else {
        sets.push({
          exercise_id: ex.id,
          exercise_name: ex.name,
          set_number: planned.set_number ?? i + 1,
          side: 'bilateral',
          set_type: plannedType,
          planned_reps: planned.reps ?? ex.reps,
          actual_reps: '',
          actual_weight_kg: ex.current_weight_kg !== null ? String(ex.current_weight_kg) : '',
          completed: false,
          rir_actual: '',
          notes: '',
          rest_sec_actual: null,
          rest_sec: planned.rest_sec ?? ex.rest_sec,
          primary_muscles: ex.primary_muscles ?? [],
          secondary_muscles: ex.secondary_muscles ?? [],
          tempo_used: plannedTempo,
        })
      }
    }
  }
  return sets
}

function formatTime(sec: number) {
  const abs = Math.abs(sec)
  const m = Math.floor(abs / 60).toString().padStart(2, '0')
  const s = (abs % 60).toString().padStart(2, '0')
  return sec < 0 ? `-${m}:${s}` : `${m}:${s}`
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

function resolveReps(ex: Exercise): number {
  const n = parseInt(ex.reps, 10)
  if (!isNaN(n) && String(n) === ex.reps.trim()) return n
  if (ex.rep_min !== null && ex.rep_min > 0) return ex.rep_min
  return 8
}

// Hydration formula for resistance training
// Base rate: 10 ml/kg/hr — empirically calibrated on practical targets
// (No peer-reviewed coefficients exist specifically for strength training;
//  literature gap confirmed by Baker 2023 + ACSM 2007 which target cardio only)
const BASE_ML_KG_HR = 10

// Goal → metabolic demand coefficient
const GOAL_HYDRATION_COEFF: Record<string, number> = {
  strength: 0.85,   // heavy loads, long rest, lower sustained HR
  hypertrophy: 1.00,
  recomp: 1.05,
  fat_loss: 1.15,
  endurance: 1.30,
}

// Muscle group size → metabolic heat produced during resistance training
// Lower body compound (quads/glutes/hamstrings) produces 1.5–2× more heat than isolation
const LOWER_BODY_KEYWORDS = [
  'quad', 'quadricep', 'hamstring', 'ischio', 'glute', 'fessier',
  'hip flexor', 'fléchisseur', 'adductor', 'abducteur', 'adducteur', 'leg',
]
const UPPER_COMPOUND_KEYWORDS = [
  'back', 'dos', 'lat', 'latissimus', 'grand dorsal', 'rhomboid', 'rhomboïde',
  'trap', 'trapèze', 'chest', 'pectoral', 'shoulder', 'épaule', 'delt', 'deltoïde',
]
// isolation default: biceps, triceps, forearms, abs, calves, obliques, core

function getMuscleCoefficient(muscle: string): number {
  const m = muscle.toLowerCase()
  if (LOWER_BODY_KEYWORDS.some(k => m.includes(k))) return 1.20
  if (UPPER_COMPOUND_KEYWORDS.some(k => m.includes(k))) return 1.05
  return 0.90 // isolation
}

function computeSessionMuscleCoeff(exercises: Exercise[]): number {
  const scores: number[] = []
  for (const ex of exercises) {
    for (const muscle of (ex.primary_muscles ?? [])) {
      scores.push(getMuscleCoefficient(muscle))
    }
  }
  if (scores.length === 0) return 1.00
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function calcHydrationPlan(weightKg: number, durationMin: number, goal: string, exercises: Exercise[]) {
  const goalCoeff = GOAL_HYDRATION_COEFF[goal] ?? 1.00
  const muscleCoeff = computeSessionMuscleCoeff(exercises)
  const rawMl = BASE_ML_KG_HR * goalCoeff * muscleCoeff * weightKg * (durationMin / 60)
  const totalMl = Math.max(200, Math.round(rawMl / 50) * 50)
  const intervalMin = 15
  const sips = Math.max(1, Math.floor(durationMin / intervalMin))
  // Round to nearest 25ml — more practical than 10ml precision
  const mlPerSip = Math.max(100, Math.round(totalMl / sips / 25) * 25)
  return { totalMl, intervalMin, mlPerSip, durationMin }
}

function parseSetForApi(s: SetLog) {
  const reps = s.actual_reps !== '' ? parseInt(s.actual_reps, 10) : null
  const weight = s.actual_weight_kg !== '' ? parseFloat(s.actual_weight_kg) : null
  const rir = s.rir_actual !== '' ? parseInt(s.rir_actual, 10) : null
  return {
    ...s,
    exercise_id: /^[0-9a-f-]{36}$/i.test(s.exercise_id) ? s.exercise_id : null,
    set_type: s.set_type,
    actual_reps: reps !== null && !isNaN(reps) ? reps : null,
    actual_weight_kg: weight !== null && !isNaN(weight) ? weight : null,
    rir_actual: rir !== null && !isNaN(rir) ? rir : null,
    planned_reps: s.planned_reps || null,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SessionLogger({ clientId, sessionId, session, exercises, lastPerformance, goal, level, clientWeight, clientGender }: Props) {
  const router = useRouter()
  const { t, lang } = useClientT()
  const [sessionExercises, setSessionExercises] = useState<Exercise[]>(exercises)
  const [sets, setSets] = useState<SetLog[]>(() => buildInitialSets(exercises, goal))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [saveProgress, setSaveProgress] = useState(0)
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({})
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null)
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const [swappedExercises, setSwappedExercises] = useState<Record<string, ExerciseSwapOverride>>({})
  const [altSheetTarget, setAltSheetTarget] = useState<number | null>(null)
  const [tempoGuideTarget, setTempoGuideTarget] = useState<{
    tempo: string; reps: number; exerciseId: string; setNumber: number; side: 'left' | 'right' | 'bilateral'; exerciseName: string; prepSeconds: number; hapticsEnabled: boolean
  } | null>(null)
  const [prepTimeTarget, setPrepTimeTarget] = useState<{
    tempo: string; reps: number; exerciseId: string; setNumber: number; side: 'left' | 'right' | 'bilateral'; exerciseName: string
  } | null>(null)
  const [recommendations, setRecommendations] = useState<Record<string, SetRecommendation>>({})
  const [manuallyEdited, setManuallyEdited] = useState<Set<string>>(new Set())

  // ── New states for redesign ──
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [progressionTarget, setProgressionTarget] = useState<{ exId: string; name: string } | null>(null)
  const [exHistory, setExHistory] = useState<{
    sessions: { date: string; session_name: string; sets: { set_number: number; weight_kg: number; reps: number; rir: number | null }[]; best_weight: number }[]
    all_time_best: number
    progression: number
    session_count: number
  } | null>(null)
  const [exHistoryLoading, setExHistoryLoading] = useState(false)
  const [cycleState, setCycleState] = useState<CycleState | null>(null)

  useEffect(() => {
    fetch('/api/client/cycle/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cycleState) setCycleState(data.cycleState) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!progressionTarget) { setExHistory(null); return }
    setExHistoryLoading(true)
    fetch(`/api/client/exercise-history?name=${encodeURIComponent(progressionTarget.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setExHistory(data ?? null) })
      .catch(() => { setExHistory(null) })
      .finally(() => setExHistoryLoading(false))
  }, [progressionTarget])
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<Set<string>>(new Set())
  const [dissolvedGroupIds, setDissolvedGroupIds] = useState<Set<string>>(new Set())
  const [supersetMenuFor, setSupersetMenuFor] = useState<string | null>(null)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)
  const [footerHeight, setFooterHeight] = useState(132)

  // ── Live save ──
  const sessionLogIdRef = useRef<string | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DRAFT_KEY = `draft_session_log_id_${sessionId}`

  // ── PR Detection ──
  const [prSets, setPrSets] = useState<Set<string>>(new Set())
  const [prFlash, setPrFlash] = useState<string | null>(null)

  // ── Hydratation ──
  const [showHydrationIntro, setShowHydrationIntro] = useState(true)
  const [showHydration, setShowHydration] = useState(false)
  const [sipsConsumed, setSipsConsumed] = useState(0)
  const hydrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const HYDRATION_INTERVAL_MS = 15 * 60 * 1000

  const hydrationPlan = useMemo(() => {
    // Gender affects only the weight fallback (literature: gender diff is mass-driven)
    const fallback = clientGender === 'female' ? 60 : 75
    const w = clientWeight ?? fallback
    const durationMin = estimateSessionDurationMin(sessionExercises, goal)
    return calcHydrationPlan(w, durationMin, goal, sessionExercises)
  }, [clientWeight, clientGender, sessionExercises, goal])

  // ── Bouton Terminer — appui long ──
  const [longPressProgress, setLongPressProgress] = useState(0)
  const longPressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressStartRef = useRef<number | null>(null)
  const LONG_PRESS_DURATION = 3000

  // ── Rest timer ──
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null)
  const [restPrescribed, setRestPrescribed] = useState<number | null>(null)
  const [restElapsed, setRestElapsed] = useState(0)
  const [restModalOpen, setRestModalOpen] = useState(false)
  const [pendingRestSet, setPendingRestSet] = useState<{ exId: string; setNum: number; side: string } | null>(null)

  const hasBlockingOverlay =
    swapTarget !== null ||
    altSheetTarget !== null ||
    sessionMenuOpen ||
    showLibrary ||
    showCustom ||
    progressionTarget !== null ||
    supersetMenuFor !== null ||
    showFinishConfirm ||
    showHydrationIntro ||
    showHydration ||
    prepTimeTarget !== null ||
    tempoGuideTarget !== null

  useEffect(() => {
    resetBodyScrollLock()
    return () => {
      resetBodyScrollLock()
    }
  }, [])

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        activeInputRef.current = true
      }
    }
    const handleFocusOut = () => {
      activeInputRef.current = false
    }
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!footerRef.current) return
    const updateFooterHeight = () => {
      setFooterHeight(footerRef.current?.offsetHeight ?? 132)
    }
    updateFooterHeight()
    const observer = new ResizeObserver(() => {
      updateFooterHeight()
    })
    observer.observe(footerRef.current)
    return () => observer.disconnect()
  }, [])

  useBodyScrollLock(hasBlockingOverlay)
  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restNotificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restNotificationKeyRef = useRef<string | null>(null)
  const restSuppressUiUntilRef = useRef<number>(0)
  const activeInputRef = useRef(false)
  const tempoActiveRef = useRef(false)

  // ── Derived ──
  const completedCount = sets.filter(s => s.completed).length
  const totalSets = sets.length
  const progress = totalSets > 0 ? completedCount / totalSets : 0
  const allDone = completedCount === totalSets && totalSets > 0
  const remainingSets = totalSets - completedCount
  const activeSetKey = useMemo(() => {
    return findFirstIncompleteWorkoutSetKey(sessionExercises, sets, dissolvedGroupIds)
  }, [sessionExercises, sets, dissolvedGroupIds])

  const restRemaining = restPrescribed !== null ? restPrescribed - restElapsed : null
  const isOvertime = restRemaining !== null && restRemaining < 0
  const overtimeLabel = isOvertime ? formatTime(restRemaining!) : null
  const isRestBlinking = restRemaining !== null && restRemaining > 0 && restRemaining <= 5
  const restProgress = restPrescribed !== null && restPrescribed > 0
    ? Math.max(0, Math.min(restElapsed / restPrescribed, 1))
    : 0
  const restVisualColor = REST_VISUAL_GREEN
  const restOverlayOpacity = isOvertime ? 0.36 : 0.14 + restProgress * 0.42

  // ── Exercise groups ──
  const exerciseGroups: Exercise[][] = useMemo(() => {
    const groups: Exercise[][] = []
    const seenGroupIds = new Set<string>()
    for (const ex of sessionExercises) {
      if (ex.group_id) {
        if (!seenGroupIds.has(ex.group_id)) {
          seenGroupIds.add(ex.group_id)
          groups.push(sessionExercises.filter(e => e.group_id === ex.group_id))
        }
      } else {
        groups.push([ex])
      }
    }
    return groups
  }, [sessionExercises])

  function shouldStartRestAfterSet(
    exId: string,
    setNum: number,
    _side: string,
    nextSets: SetLog[],
  ) {
    const currentSet = nextSets.find((set) =>
      set.exercise_id === exId &&
      set.set_number === setNum &&
      set.side === _side
    )
    return shouldStartPrescribedRest(currentSet?.rest_sec)
  }

  const historyReferences = useMemo(() => {
    return buildWorkoutHistoryReferences({
      sets,
      exercises: sessionExercises,
      historyIndex: lastPerformance,
      goal,
      resolveTargetRir: (exercise, setNumber) => resolveExerciseTargetRir(exercise as Exercise, setNumber),
    })
  }, [goal, lastPerformance, sessionExercises, sets])

  // ── Coaching cues map ──
  const coachingCuesMap = useMemo(() => {
    return buildWorkoutCoachingCues({
      sets,
      exercises: sessionExercises,
      resolveTargetRir: (exercise, setNumber) => resolveExerciseTargetRir(exercise as Exercise, setNumber),
      t: t as (key: string) => string,
    })
  }, [sets, sessionExercises, t])

  // ── API ──
  async function patchSets(currentSets: SetLog[]) {
    const logId = sessionLogIdRef.current
    if (!logId) return
    try {
      const payload = currentSets.map(parseSetForApi)
      const res = await fetch(`/api/session-logs/${logId}/sets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_logs: payload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[patchSets] failed', res.status, body)
      }
    } catch { /* silent */ }
  }

  // ── Recommendation engine ──
  const triggerRecommendation = useCallback((completedSet: SetLog) => {
    setSets(prev => {
      const result = recommendFollowingWorkoutSet({
        completedSet,
        sets: prev,
        exercises: sessionExercises,
        historyIndex: lastPerformance,
        goal,
        level,
        manuallyEdited,
        resolveTargetRir: (exercise, setNumber) => resolveExerciseTargetRir(exercise as Exercise, setNumber),
      })

      if (!result) return prev
      setRecommendations(r => ({ ...r, [result.nextKey]: result.recommendation }))
      return prev.map(s => {
        if (s.exercise_id === completedSet.exercise_id && s.set_number === result.nextSet.set_number && s.side === completedSet.side) {
          return { ...s, actual_weight_kg: formatWeight(result.recommendation.weight_kg), actual_reps: String(result.recommendation.reps) }
        }
        return s
      })
    })
  }, [sessionExercises, lastPerformance, goal, level, manuallyEdited])

  // ── Draft init ──
  useEffect(() => {
    let cancelled = false
    async function initDraft() {
      const existingId = localStorage.getItem(DRAFT_KEY)
      if (existingId) {
        try {
          const res = await fetch(`/api/session-logs/${existingId}/sets`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ set_logs: [] }),
          })
          if (res.ok && !cancelled) {
            const data = await res.json()
            const dbSets = data?.set_logs ?? []
            if (dbSets.length > 0) {
              setSets(prevSets => {
                // Map existing sets
                const updatedSets = prevSets.map(initialSet => {
                  const dbSet = dbSets.find((s: any) =>
                    s.set_number === initialSet.set_number &&
                    s.side === initialSet.side &&
                    (s.exercise_id === initialSet.exercise_id || s.exercise_name === initialSet.exercise_name)
                  )
                  if (dbSet) {
                    return {
                      ...initialSet,
                      completed: dbSet.completed ?? false,
                      actual_reps: dbSet.actual_reps !== null && dbSet.actual_reps !== undefined ? String(dbSet.actual_reps) : '',
                      actual_weight_kg: dbSet.actual_weight_kg !== null && dbSet.actual_weight_kg !== undefined ? String(dbSet.actual_weight_kg) : '',
                      rir_actual: dbSet.rir_actual !== null && dbSet.rir_actual !== undefined ? String(dbSet.rir_actual) : '',
                      notes: dbSet.notes ?? '',
                      rest_sec_actual: dbSet.rest_sec_actual ?? null,
                      tempo_used: dbSet.tempo_used ?? initialSet.tempo_used,
                    }
                  }
                  return initialSet
                })

                // Find sets in dbSets that don't match any in prevSets, and append them
                const extraSets: SetLog[] = []
                for (const dbSet of dbSets) {
                  const exists = prevSets.some(s =>
                    s.set_number === dbSet.set_number &&
                    s.side === dbSet.side &&
                    (s.exercise_id === dbSet.exercise_id || s.exercise_name === dbSet.exercise_name)
                  )
                  if (!exists) {
                    const ex = sessionExercises.find(e => e.id === dbSet.exercise_id || e.name === dbSet.exercise_name)
                    extraSets.push({
                      exercise_id: dbSet.exercise_id ?? ex?.id ?? '',
                      exercise_name: dbSet.exercise_name,
                      set_number: dbSet.set_number,
                      side: dbSet.side as 'left' | 'right' | 'bilateral',
                      set_type: (dbSet.set_type ?? 'working') as SetType,
                      planned_reps: dbSet.planned_reps !== null && dbSet.planned_reps !== undefined ? String(dbSet.planned_reps) : (ex?.reps ?? ''),
                      actual_reps: dbSet.actual_reps !== null && dbSet.actual_reps !== undefined ? String(dbSet.actual_reps) : '',
                      actual_weight_kg: dbSet.actual_weight_kg !== null && dbSet.actual_weight_kg !== undefined ? String(dbSet.actual_weight_kg) : '',
                      completed: dbSet.completed ?? false,
                      rir_actual: dbSet.rir_actual !== null && dbSet.rir_actual !== undefined ? String(dbSet.rir_actual) : '',
                      notes: dbSet.notes ?? '',
                      rest_sec_actual: dbSet.rest_sec_actual ?? null,
                      rest_sec: dbSet.rest_sec ?? (ex?.rest_sec ?? null),
                      primary_muscles: dbSet.primary_muscles ?? ex?.primary_muscles ?? [],
                      secondary_muscles: dbSet.secondary_muscles ?? ex?.secondary_muscles ?? [],
                      tempo_used: dbSet.tempo_used ?? ex?.tempo ?? null,
                    })
                  }
                }

                if (extraSets.length > 0) {
                  const finalSets = [...updatedSets]
                  for (const ext of extraSets) {
                    const lastIdx = finalSets.map(s => s.exercise_id === ext.exercise_id || s.exercise_name === ext.exercise_name).lastIndexOf(true)
                    if (lastIdx !== -1) {
                      finalSets.splice(lastIdx + 1, 0, ext)
                    } else {
                      finalSets.push(ext)
                    }
                  }
                  return finalSets
                }

                return updatedSets
              })
            }
            sessionLogIdRef.current = existingId
            setDraftReady(true)
            return
          }
          if (res.status === 404 && !cancelled) {
            localStorage.removeItem(DRAFT_KEY)
            setDraftReady(true)
            return
          }
        } catch { /* continue */ }
        if (!cancelled) localStorage.removeItem(DRAFT_KEY)
      }
      try {
        // Pre-insert all planned sets (uncompleted) so DB has full picture if app closes mid-session
        const initialSets = buildInitialSets(sessionExercises, goal).map(parseSetForApi)
        const res = await fetch('/api/session-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_session_id: session.id, session_name: session.name, set_logs: initialSets }),
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          const newId = data?.session_log?.id
          if (newId) {
            sessionLogIdRef.current = newId
            localStorage.setItem(DRAFT_KEY, newId)
          }
        }
      } catch { /* no network */ }
      if (!cancelled) setDraftReady(true)
    }
    initDraft()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current) }
  }, [])

  // ── Auto-save exercise notes (debounced 1s) ──
  useEffect(() => {
    if (!draftReady || Object.keys(exerciseNotes).length === 0) return
    const logId = sessionLogIdRef.current
    if (!logId) return
    if (noteSaveDebounceRef.current) clearTimeout(noteSaveDebounceRef.current)
    noteSaveDebounceRef.current = setTimeout(() => {
      fetch(`/api/session-logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercise_notes: exerciseNotes }),
      }).catch(() => {})
    }, 1000)
    return () => { if (noteSaveDebounceRef.current) clearTimeout(noteSaveDebounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseNotes, draftReady])

  // ── Chrono global ──
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [startTime])

  // ── Rest timer tick ──
  useEffect(() => {
    if (restStartedAt === null) {
      clearInterval(restIntervalRef.current!)
      setRestElapsed(0)
      return
    }
    restIntervalRef.current = setInterval(() => {
      setRestElapsed(Math.floor((Date.now() - restStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(restIntervalRef.current!)
  }, [restStartedAt])

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
    if (restNotificationTimeoutRef.current) clearTimeout(restNotificationTimeoutRef.current)

    if (restStartedAt === null || restPrescribed === null || !pendingRestSet || !activeSetKey) {
      restNotificationKeyRef.current = null
      return
    }

    const notificationKey = `${restStartedAt}:${restPrescribed}:${activeSetKey}`
    if (restNotificationKeyRef.current === notificationKey) return

    const upcomingSet = sets.find((set) => recKey(set.exercise_id, set.set_number, set.side) === activeSetKey)
    const upcomingExercise = upcomingSet
      ? sessionExercises.find((exercise) => exercise.id === upcomingSet.exercise_id)
      : null
    if (!upcomingSet || !upcomingExercise) return

    const recommendation = recommendations[activeSetKey]
    const historyReference = historyReferences[activeSetKey] ?? null
    const reps = recommendation
      ? String(recommendation.reps)
      : historyReference
        ? String(historyReference.reps)
        : upcomingSet.planned_reps || '—'
    const weight = recommendation
      ? `${recommendation.weight_kg} kg`
      : historyReference
        ? `${historyReference.weight} kg`
        : upcomingSet.actual_weight_kg
          ? `${upcomingSet.actual_weight_kg} kg`
          : '—'
    const delayMs = restStartedAt + Math.max(0, restPrescribed - 5) * 1000 - Date.now()
    const notify = () => {
      void showRestEndingSoonNotification({
        title: t('logger.rest.notification.title'),
        body: t('logger.rest.notification.body', {
          exercise: displayNameForExercise(upcomingExercise, swappedExercises),
          set: upcomingSet.set_number,
          reps,
          weight,
        }),
        url: window.location.pathname,
      })
    }

    restNotificationKeyRef.current = notificationKey
    if (delayMs <= 0) {
      notify()
      return
    }

    restNotificationTimeoutRef.current = setTimeout(notify, delayMs)
    return () => {
      if (restNotificationTimeoutRef.current) clearTimeout(restNotificationTimeoutRef.current)
    }
  }, [activeSetKey, pendingRestSet, restPrescribed, restStartedAt, sessionExercises, t])

  // ── Hydratation timer ──
  useEffect(() => {
    tempoActiveRef.current = tempoGuideTarget !== null
  }, [tempoGuideTarget])

  useEffect(() => {
    const event = new CustomEvent('stryvr-rest-modal-toggle', { detail: { open: restModalOpen } })
    window.dispatchEvent(event)
  }, [restModalOpen])

  const TEMPO_BUSY_RETRY_MS = 90 * 1000

  function resetHydrationTimer(delayMs: number) {
    if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current)
    hydrationTimerRef.current = setInterval(() => {
      if (tempoActiveRef.current) {
        if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current)
        hydrationTimerRef.current = setTimeout(() => {
          if (tempoActiveRef.current) { resetHydrationTimer(TEMPO_BUSY_RETRY_MS); return }
          setShowHydration(true)
        }, TEMPO_BUSY_RETRY_MS) as unknown as ReturnType<typeof setInterval>
        return
      }
      setShowHydration(true)
    }, delayMs)
  }

  useEffect(() => {
    hydrationTimerRef.current = setInterval(() => {
      if (tempoActiveRef.current) {
        if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current)
        hydrationTimerRef.current = setTimeout(() => {
          if (tempoActiveRef.current) { resetHydrationTimer(TEMPO_BUSY_RETRY_MS); return }
          setShowHydration(true)
        }, TEMPO_BUSY_RETRY_MS) as unknown as ReturnType<typeof setInterval>
        return
      }
      setShowHydration(true)
    }, HYDRATION_INTERVAL_MS)
    return () => { if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [HYDRATION_INTERVAL_MS])

  // ── Rest helpers ──
  function finalizeCurrentRest(extraSeconds = 0) {
    if (pendingRestSet && restStartedAt !== null) {
      const actual = Math.max(0, Math.floor((Date.now() - restStartedAt) / 1000) + extraSeconds - REST_END_BUFFER_SEC)
      setSets(prev => prev.map(s =>
        s.exercise_id === pendingRestSet.exId && s.set_number === pendingRestSet.setNum && s.side === pendingRestSet.side
          ? { ...s, rest_sec_actual: actual } : s
      ))
    }
  }

  function scheduleModalOpen(delayMs: number) {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    inactivityRef.current = setTimeout(() => {
      if (Date.now() < restSuppressUiUntilRef.current) return
      if (!activeInputRef.current) setRestModalOpen(true)
      else scheduleModalOpen(delayMs)
    }, delayMs)
  }

  function queueRest(exId: string, setNum: number, side: string, prescribed: number | null) {
    finalizeCurrentRest()
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    if (restReadyTimeoutRef.current) {
      clearTimeout(restReadyTimeoutRef.current)
      restReadyTimeoutRef.current = null
    }
    restSuppressUiUntilRef.current = 0
    setRestPrescribed(prescribed)
    setRestStartedAt(Date.now() - REST_TOUCH_START_OFFSET_SEC * 1000)
    setRestElapsed(REST_TOUCH_START_OFFSET_SEC)
    setPendingRestSet({ exId, setNum, side })
    setRestModalOpen(false)
    scheduleModalOpen(REST_MODAL_REOPEN_MS)
  }

  function startRest(exId: string, setNum: number, side: string, prescribed: number | null) {
    finalizeCurrentRest()
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    if (restReadyTimeoutRef.current) {
      clearTimeout(restReadyTimeoutRef.current)
      restReadyTimeoutRef.current = null
    }
    restSuppressUiUntilRef.current = 0
    setRestPrescribed(prescribed)
    setRestStartedAt(Date.now())
    setRestElapsed(0)
    setPendingRestSet({ exId, setNum, side })
    setRestModalOpen(true)
  }

  function dismissRestModal(delayMs: number) {
    setRestModalOpen(false)
    if (Date.now() < restSuppressUiUntilRef.current) return
    scheduleModalOpen(delayMs)
  }

  function markRestReady() {
    setRestModalOpen(false)
    restSuppressUiUntilRef.current = Date.now() + REST_READY_BUFFER_MS
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    if (restReadyTimeoutRef.current) clearTimeout(restReadyTimeoutRef.current)
    restReadyTimeoutRef.current = setTimeout(() => {
      finalizeCurrentRest(REST_END_BUFFER_SEC + 5)
      stopRest()
      restReadyTimeoutRef.current = null
    }, REST_READY_BUFFER_MS)
  }

  function stopRest() {
    if (inactivityRef.current) clearTimeout(inactivityRef.current)
    if (restReadyTimeoutRef.current) clearTimeout(restReadyTimeoutRef.current)
    setRestStartedAt(null)
    setRestPrescribed(null)
    setRestElapsed(0)
    setRestModalOpen(false)
    setPendingRestSet(null)
  }

  function resolveUpcomingRestTarget() {
    if (!pendingRestSet || !activeSetKey) return null
    const upcomingSet = sets.find((set) => recKey(set.exercise_id, set.set_number, set.side) === activeSetKey)
    if (!upcomingSet) return null
    const upcomingExercise = sessionExercises.find((exercise) => exercise.id === upcomingSet.exercise_id)
    return upcomingExercise ? { exercise: upcomingExercise, set: upcomingSet } : null
  }

  function onSetInteraction(exId: string, setNum: number, side: string) {
    if (pendingRestSet && restStartedAt !== null) {
      const isSameSet = pendingRestSet.exId === exId && pendingRestSet.setNum === setNum && pendingRestSet.side === side
      if (!isSameSet) {
        finalizeCurrentRest()
        stopRest()
      }
    }
  }

  // ── Set mutations ──
  function updateSet(exId: string, setNum: number, side: string, patch: Partial<SetLog>) {
    onSetInteraction(exId, setNum, side)
    setSets(prev => {
      const next = prev.map(s =>
        s.exercise_id === exId && s.set_number === setNum && s.side === side ? { ...s, ...patch } : s
      )
      const updated = next.find(s => s.exercise_id === exId && s.set_number === setNum && s.side === side)
      if (updated && !updated.completed && (updated.actual_reps || updated.actual_weight_kg)) {
        const alreadyTracking = pendingRestSet?.exId === exId && pendingRestSet?.setNum === setNum && pendingRestSet?.side === side
        if (!alreadyTracking && shouldStartPrescribedRest(updated?.rest_sec)) {
          queueRest(exId, setNum, side, updated?.rest_sec ?? null)
        }
      }
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
      const exSetsUpdated = next.filter(s => s.exercise_id === exId)
      saveDebounceRef.current = setTimeout(() => { patchSets(exSetsUpdated) }, 800)
      return next
    })
    // Mark manual edit if reps/weight changed
    if (patch.actual_reps !== undefined || patch.actual_weight_kg !== undefined) {
      const key = recKey(exId, setNum, side)
      setManuallyEdited(prev => new Set(prev).add(key))
    }
  }

  function toggleSet(exId: string, setNum: number, side: string, reps?: string, weight?: string, rir?: string) {
    setSets(prev => {
      const current = prev.find(s => s.exercise_id === exId && s.set_number === setNum && s.side === side)
      const wasCompleted = current?.completed ?? false

      const next = prev.map(s => {
        if (s.exercise_id !== exId || s.set_number !== setNum || s.side !== side) return s
        // Editing an already validated set must preserve its completed state.
        // Otherwise the row drops back into the pending list and looks "blank".
        if (wasCompleted) {
          return {
            ...s,
            completed: true,
            ...(reps !== undefined ? { actual_reps: reps } : {}),
            ...(weight !== undefined ? { actual_weight_kg: weight } : {}),
            ...(rir !== undefined ? { rir_actual: rir } : {}),
          }
        }

        const nowCompleted = true
        return {
          ...s,
          completed: nowCompleted,
          // Apply confirmed values from the modal
          ...(nowCompleted && reps !== undefined ? { actual_reps: reps } : {}),
          ...(nowCompleted && weight !== undefined ? { actual_weight_kg: weight } : {}),
          ...(nowCompleted && rir !== undefined ? { rir_actual: rir } : {}),
        }
      })

      if (!wasCompleted) {
        const alreadyTracking = pendingRestSet?.exId === exId && pendingRestSet?.setNum === setNum && pendingRestSet?.side === side
        if (!alreadyTracking) {
          // The completed set's prescribed rest is the single source of truth.
          // This is identical for regular exercises and supersets: zero continues.
          const effectiveRest = current?.rest_sec ?? null

          // For unilateral exercises, rest only starts after both sides of the same set are done.
          // Right → Left → rest (not Right → rest → Left → rest).
          const ex = sessionExercises.find(e => e.id === exId)
          if (ex?.is_unilateral) {
            const otherSide = side === 'right' ? 'left' : 'right'
            const otherSideDone = next.some(s2 =>
              s2.exercise_id === exId && s2.set_number === setNum && s2.side === otherSide && s2.completed
            )

            if (otherSideDone && shouldStartRestAfterSet(exId, setNum, side, next)) {
              queueRest(exId, setNum, side, effectiveRest)
            }
          } else if (shouldStartRestAfterSet(exId, setNum, side, next)) {
            queueRest(exId, setNum, side, effectiveRest)
          }
        }
      }

      const exSetsUpdated = next.filter(s => s.exercise_id === exId)
      patchSets(exSetsUpdated)

      // Use confirmed values for PR detection and recommendation
      const confirmedCurrent = next.find(s => s.exercise_id === exId && s.set_number === setNum && s.side === side)
      if (!wasCompleted && confirmedCurrent) {
        triggerRecommendation(confirmedCurrent)
        // PR detection
        const exHistory = getExerciseHistoryEntries(lastPerformance, confirmedCurrent.exercise_name)
        const historyBest = exHistory.reduce((best, h) => {
          if (h.weight === null || h.reps === null) return best
          return h.weight > (best?.weight ?? 0) ? h : best
        }, null as LastPerf | null)
        const confirmedReps = parseInt(confirmedCurrent.actual_reps, 10)
        const confirmedWeight = parseFloat(confirmedCurrent.actual_weight_kg)
        if (!isNaN(confirmedReps) && !isNaN(confirmedWeight) && confirmedWeight > 0 && confirmedReps > 0) {
          const isNewPR = !historyBest ||
            confirmedWeight > (historyBest.weight ?? 0) ||
            (confirmedWeight === historyBest.weight && confirmedReps > (historyBest.reps ?? 0))
          if (isNewPR) {
            const key = recKey(confirmedCurrent.exercise_id, confirmedCurrent.set_number, confirmedCurrent.side)
            setPrSets(prev => new Set(prev).add(key))
            setPrFlash(t('logger.pr.new', { weight: formatWeight(confirmedWeight), reps: String(confirmedReps) }))
            setTimeout(() => setPrFlash(null), 3000)
          }
        }
      }
      return next
    })
  }

  function deleteSet(exId: string, setNum: number, side: string) {
    setSets(prev => prev.filter(s => !(s.exercise_id === exId && s.set_number === setNum && s.side === side)))
  }

  function addSet(exId: string) {
    const ex = sessionExercises.find(e => e.id === exId)
    if (!ex) return
    const exSets = sets.filter(s => s.exercise_id === exId)
    const lastSet = exSets[exSets.length - 1]
    const newSetNum = (lastSet?.set_number ?? 0) + 1
    const resolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
    const baseFields = {
      exercise_id: exId,
      exercise_name: ex.name,
      set_number: newSetNum,
      set_type: 'working' as SetType,
      planned_reps: lastSet?.planned_reps ?? ex.reps,
      actual_reps: '',
      actual_weight_kg: lastSet?.actual_weight_kg ?? (ex.current_weight_kg !== null ? String(ex.current_weight_kg) : ''),
      completed: false,
      rir_actual: '',
      notes: '',
      rest_sec_actual: null,
      rest_sec: ex.rest_sec,
      primary_muscles: ex.primary_muscles ?? [],
      secondary_muscles: ex.secondary_muscles ?? [],
      tempo_used: resolvedTempo,
    }
    if (ex.is_unilateral) {
      setSets(prev => [...prev,
        { ...baseFields, side: 'right' as const },
        { ...baseFields, side: 'left' as const },
      ])
    } else {
      setSets(prev => [...prev, { ...baseFields, side: 'bilateral' as const }])
    }
  }

  function addExerciseToSession(exercise: Exercise) {
    setSessionExercises((prev) => [...prev, exercise])
    setSets((prev) => [...prev, ...buildInitialSets([exercise], goal)])
  }

  async function createProgrammeExercise(payload: {
    name: string
    image_url: string | null
    is_unilateral: boolean
    movement_pattern: string | null
    primary_muscles: string[]
    secondary_muscles: string[]
  }) {
    const response = await fetch('/api/client/programme/session-exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        name: payload.name,
        image_url: payload.image_url,
        is_unilateral: payload.is_unilateral,
        movement_pattern: payload.movement_pattern,
        primary_muscles: payload.primary_muscles,
        secondary_muscles: payload.secondary_muscles,
        sets: 3,
        reps: '10',
        rest_sec: 90,
        rir: 2,
        target_rir: 2,
        weight_increment_kg: 2.5,
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.exercise) {
      throw new Error(data?.error ?? t('flex.error.addExercise'))
    }

    addExerciseToSession({
      ...(data.exercise as Exercise),
      clientAlternatives: [],
      isCustom: true,
    })
  }

  async function createCatalogExercise(entry: CatalogExercise) {
    const exerciseName = resolveCatalogDisplayName(entry) ?? entry.name
    if (sessionExercises.some((exercise) => exercise.name === exerciseName)) return

    await createProgrammeExercise({
      name: exerciseName,
      image_url: entry.gifUrl ?? null,
      is_unilateral: entry.unilateral ?? false,
      movement_pattern: entry.movementPattern ?? null,
      primary_muscles: entry.primaryMuscles ?? (entry.primaryMuscle ? [entry.primaryMuscle] : []),
      secondary_muscles: entry.secondaryMuscles ?? [],
    })
  }

  async function createCustomExercise(draft: CustomExerciseDraft) {
    const primaryMuscles = draft.primaryMuscles.split(',').map((value) => value.trim()).filter(Boolean)
    const secondaryMuscles = draft.secondaryMuscles.split(',').map((value) => value.trim()).filter(Boolean)

    await createProgrammeExercise({
      name: draft.name.trim(),
      image_url: null,
      is_unilateral: draft.unilateral,
      movement_pattern: draft.movementPattern || null,
      primary_muscles: primaryMuscles.length > 0 ? primaryMuscles : (draft.muscleGroup.trim() ? [draft.muscleGroup.trim()] : []),
      secondary_muscles: secondaryMuscles,
    })
  }

  // ── Long press Terminer ──
  function onFinishPressStart() {
    if (allDone) { submitSession(); return }
    longPressStartRef.current = Date.now()
    longPressRef.current = setInterval(() => {
      const e = Date.now() - (longPressStartRef.current ?? Date.now())
      const p = Math.min(e / LONG_PRESS_DURATION, 1)
      setLongPressProgress(p)
      if (p >= 1) {
        clearInterval(longPressRef.current!)
        setLongPressProgress(0)
        setShowFinishConfirm(true)
      }
    }, 16)
  }

  function onFinishPressEnd() {
    if (longPressRef.current) clearInterval(longPressRef.current)
    setLongPressProgress(0)
  }

  // ── Submit session ──
  async function submitSession() {
    setRestModalOpen(false)
    setRestStartedAt(null)
    setSaveState('saving')
    setErrorMsg(null)
    const submitStartTime = Date.now()
    const durationMin = Math.round(elapsed / 60)
    let pointsEarned = 0
    const logId = sessionLogIdRef.current
    const allSetsPayload = sets.map(parseSetForApi)

    if (logId) {
      try {
        const flushRes = await fetch(`/api/session-logs/${logId}/sets`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ set_logs: allSetsPayload }),
        })
        if (!flushRes.ok) {
          const body = await flushRes.json().catch(() => ({}))
          setSaveState('error')
          setErrorMsg(body?.error ?? `Erreur sauvegarde sets (${flushRes.status})`)
          return
        }
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : t('logger.error.network'))
        return
      }
      try {
        const completeRes = await fetch(`/api/session-logs/${logId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true, duration_min: durationMin, exercise_notes: exerciseNotes }),
        })
        if (!completeRes.ok) {
          const body = await completeRes.json().catch(() => ({}))
          setSaveState('error')
          setErrorMsg(body?.error ?? `Erreur finalisation (${completeRes.status})`)
          return
        }
        const completeData = await completeRes.json().catch(() => null)
        pointsEarned = Number(completeData?.points_earned ?? 0)
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : t('logger.error.network'))
        return
      }

      const elapsedSave = Date.now() - submitStartTime
      if (elapsedSave < 6000) {
        await new Promise(resolve => setTimeout(resolve, 6000 - elapsedSave))
      }
      setSaveProgress(100)
      await new Promise(resolve => setTimeout(resolve, 300))

      setSaveState('idle')
      localStorage.removeItem(DRAFT_KEY)
      router.refresh()
      router.push(`/client/programme/recap/${logId}${pointsEarned > 0 ? `?points=${pointsEarned}` : ''}`)
    } else {
      try {
        const res = await fetch('/api/session-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_session_id: session.id,
            session_name: session.name,
            exercise_notes: exerciseNotes,
            set_logs: allSetsPayload,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? t('logger.error.server', { status: res.status }))
        }
        const data = await res.json()
        const newLogId = data?.session_log?.id
        if (!newLogId) throw new Error(t('logger.error.missingLogId'))
        const completeRes = await fetch(`/api/session-logs/${newLogId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true, duration_min: durationMin }),
        })
        const completeData = await completeRes.json().catch(() => null)
        pointsEarned = Number(completeData?.points_earned ?? 0)

        const elapsedSave = Date.now() - submitStartTime
        if (elapsedSave < 6000) {
          await new Promise(resolve => setTimeout(resolve, 6000 - elapsedSave))
        }
        setSaveProgress(100)
        await new Promise(resolve => setTimeout(resolve, 300))

        setSaveState('idle')
        localStorage.removeItem(DRAFT_KEY)
        router.refresh()
        router.push(`/client/programme/recap/${newLogId}${pointsEarned > 0 ? `?points=${pointsEarned}` : ''}`)
      } catch (err) {
        setSaveState('error')
        setErrorMsg(err instanceof Error ? err.message : t('logger.error.network'))
      }
    }
  }

  function handleSwap(exerciseId: string, newName: string) {
    const catalog = getCatalogEntryByName(newName)
    const image_url = catalog?.gifUrl ?? null
    setSwappedExercises(prev => ({
      ...prev,
      [exerciseId]: { name: newName, image_url },
    }))
    setSets(prev => prev.map(s =>
      s.exercise_id === exerciseId ? { ...s, exercise_name: newName } : s
    ))
    setSwapTarget(null)
  }

  // ── Tempo handler ──
  function handleTempoForSet(exId: string, setNum: number, side: 'left' | 'right' | 'bilateral') {
    const ex = sessionExercises.find(e => e.id === exId)
    const targetSet = sets.find((set) => set.exercise_id === exId && set.set_number === setNum && set.side === side)
    if (!ex || !targetSet) return
    const resolvedTempo = resolveExerciseTempo(ex, setNum, goal)
    if (!resolvedTempo) return
    const repCount = averagePlannedReps(targetSet.planned_reps) ?? resolveReps(ex)
    const exName = displayNameForExercise(ex, swappedExercises)
    if (!hasPrepTimeConfigured(exName)) {
      setPrepTimeTarget({ tempo: resolvedTempo, reps: repCount, exerciseId: exId, setNumber: setNum, side, exerciseName: exName })
    } else {
      setTempoGuideTarget({
        tempo: resolvedTempo,
        reps: repCount,
        exerciseId: exId,
        setNumber: setNum,
        side,
        exerciseName: exName,
        prepSeconds: getPrepTime(exName),
        hapticsEnabled: getHapticsEnabled(),
      })
    }
  }

  if (sessionExercises.length === 0) {
    return (
      <div className="min-h-dvh bg-[#0d0d0d] flex items-center justify-center overflow-x-hidden">
        <p className="text-white/40 text-sm">{t('logger.noExercises')}</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-[#0d0d0d] font-barlow overflow-x-hidden">
      {/* ── Header fixe ── */}
      <header
        className="fixed inset-x-0 top-0 z-40 bg-[#0d0d0d]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSessionMenuOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 hover:text-white/60 active:scale-95 transition-all"
          >
            <MoreHorizontal size={16} />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white">{session.name}</p>
            <p className="text-[13px] font-mono font-bold text-white tabular-nums mt-0.5">{formatTime(elapsed)}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {cycleState?.currentPhase && cycleState.currentCycleDay && (
              <CyclePhasePill
                phase={cycleState.currentPhase}
                cycleDay={cycleState.currentCycleDay}
                confidence={cycleState.confidence}
                size="sm"
              />
            )}
            <div className="flex items-center gap-2">
            {restStartedAt !== null && !isOvertime && restRemaining !== null && (
              <button
                type="button"
                onClick={() => {
                  if (Date.now() < restSuppressUiUntilRef.current) return
                  setRestModalOpen(true)
                }}
                className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono font-bold text-white/50"
              >
                <Clock size={9} />{formatTime(restRemaining)}
              </button>
            )}
            {isOvertime && restStartedAt !== null && (
              <button
                type="button"
                onClick={() => {
                  if (Date.now() < restSuppressUiUntilRef.current) return
                  setRestModalOpen(true)
                }}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-red-400 animate-pulse"
              >
                {overtimeLabel}
              </button>
            )}
            <div className="relative overflow-hidden rounded-xl">
              {longPressProgress > 0 && (
                <div
                  className="absolute inset-0 bg-[#f2f2f2]/40 origin-left"
                  style={{ transform: `scaleX(${longPressProgress})` }}
                />
              )}
              <button
                onMouseDown={allDone ? undefined : onFinishPressStart}
                onMouseUp={allDone ? undefined : onFinishPressEnd}
                onMouseLeave={allDone ? undefined : onFinishPressEnd}
                onTouchStart={allDone ? undefined : onFinishPressStart}
                onTouchEnd={allDone ? undefined : onFinishPressEnd}
                onClick={allDone ? submitSession : undefined}
                disabled={saveState === 'saving' || !draftReady}
                className={`relative h-9 px-3 flex items-center gap-1.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.08em] disabled:opacity-50 select-none transition-colors ${allDone ? 'bg-[#f2f2f2] text-[#080808]' : 'bg-[#1a1a1a] text-[#5a5a5a]'}`}
              >
                {saveState === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                {allDone ? 'Terminer' : 'Fin'}
              </button>
            </div>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-[2px] bg-white/[0.06] mx-4 mb-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#4faa78] via-[#7ee2a8] to-[#5dba87] rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-center text-[10px] text-white/25 font-barlow-condensed uppercase tracking-[0.1em] pb-2">
          {t('logger.sets.count', { done: String(completedCount), total: String(totalSets) })}
        </p>
      </header>

      {/* ── Error banner ── */}
      {saveState === 'error' && errorMsg && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3" style={{ marginTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-red-400">{t('logger.save.failed')}</p>
              <p className="text-[10px] text-red-400/70 mt-0.5 break-all">{errorMsg}</p>
            </div>
            <button onClick={submitSession} className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1.5 rounded-lg shrink-0">
              <RefreshCw size={10} /> {t('logger.retry')}
            </button>
          </div>
        </div>
      )}

      {/* ── PR flash ── */}
      <AnimatePresence>
        {prFlash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-24 left-4 right-4 z-50 px-4 py-2.5 bg-[#222222] rounded-xl text-[12px] font-bold text-[#f2f2f2] text-center"
          >
            {prFlash}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Exercise list ── */}
      <main
        className="flex flex-col gap-3 px-4 pb-10"
        style={{
          paddingTop: saveState === 'error' && errorMsg ? '16px' : 'calc(env(safe-area-inset-top) + 104px)',
          paddingBottom: `${footerHeight + 20}px`,
        }}
      >
        {exerciseGroups
          .filter(group => !group.every(ex => deletedExerciseIds.has(ex.id)))
          .map((group) => {
            const isSuperset = group.length > 1
            const groupId = group[0].group_id ?? null
            const isDissolved = groupId ? dissolvedGroupIds.has(groupId) : false

            // Superset (non-dissolved)
            if (isSuperset && !isDissolved && groupId) {
              return (
                <div key={groupId} className="rounded-2xl overflow-hidden bg-[#111111]">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#1a1a1a]">
                    <div className="flex items-center gap-2">
                      <Rotate size={12} className="text-[#808080]" />
                      <span className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#808080]">Surensemble</span>
                    </div>
                    <button
                      onClick={() => setSupersetMenuFor(groupId)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg bg-[#222222] text-[#5a5a5a] hover:text-[#808080]"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                  {group
                    .filter(ex => !deletedExerciseIds.has(ex.id))
                    .map((ex, ei) => (
                      <div key={ex.id}>
                          <ExerciseBlock
                            exercise={resolveExerciseForBlock(ex, swappedExercises)}
                            activeSetKey={activeSetKey}
                            sets={sets.filter(s => s.exercise_id === ex.id) as SetRowData[]}
                            recommendations={recommendations}
                          historyReferences={historyReferences}
                          prSets={prSets}
                          coachingCues={coachingCuesMap}
                          resolveTargetRir={(setNum) => resolveExerciseTargetRir(ex, setNum)}
                          inSuperset
                          onValidateSet={(exId, setNum, side, reps, weight, rir) => toggleSet(exId, setNum, side, reps, weight, rir)}
                          onDeleteSet={deleteSet}
                          onChangeSet={(exId, setNum, side, patch) => updateSet(exId, setNum, side, patch as Partial<SetLog>)}
                          onAddSet={addSet}
                          onSwap={exId => setSwapTarget(exId)}
                          onRest={exId => {
                            const exerciseForRest = sessionExercises.find((exercise) => exercise.id === exId)
                            startRest(exId, 0, 'bilateral', exerciseForRest?.rest_sec ?? null)
                          }}
                          onNote={exId => setShowNoteInput(prev => prev === exId ? null : exId)}
                          onTempo={handleTempoForSet}
                          onDeleteExercise={exId => setDeletedExerciseIds(prev => new Set(prev).add(exId))}
                          onOpenProgression={(exId, name) => setProgressionTarget({ exId, name })}
                        />
                        {/* Note inline */}
                        {showNoteInput === ex.id && (
                          <div className="px-3 pb-3">
                            <textarea
                              autoFocus
                              rows={2}
                              value={exerciseNotes[ex.id] ?? ''}
                              onFocus={() => { activeInputRef.current = true }}
                              onBlur={() => { activeInputRef.current = false }}
                              onChange={e => setExerciseNotes(prev => ({ ...prev, [ex.id]: e.target.value }))}
                              placeholder={t('logger.note.placeholder')}
                              className="w-full bg-white/[0.03] rounded-xl px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none resize-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )
            }

            // Solo exercises (or dissolved superset members)
            return group
              .filter(ex => !deletedExerciseIds.has(ex.id))
              .map(ex => (
                <div key={ex.id}>
                  <ExerciseBlock
                    exercise={resolveExerciseForBlock(ex, swappedExercises)}
                    activeSetKey={activeSetKey}
                    sets={sets.filter(s => s.exercise_id === ex.id) as SetRowData[]}
                    recommendations={recommendations}
                    historyReferences={historyReferences}
                    prSets={prSets}
                    coachingCues={coachingCuesMap}
                    resolveTargetRir={(setNum) => resolveExerciseTargetRir(ex, setNum)}
                    onValidateSet={(exId, setNum, side, reps, weight, rir) => toggleSet(exId, setNum, side, reps, weight, rir)}
                    onDeleteSet={deleteSet}
                    onChangeSet={(exId, setNum, side, patch) => updateSet(exId, setNum, side, patch as Partial<SetLog>)}
                    onAddSet={addSet}
                    onSwap={exId => setSwapTarget(exId)}
                    onRest={exId => {
                      const exerciseForRest = sessionExercises.find((exercise) => exercise.id === exId)
                      startRest(exId, 0, 'bilateral', exerciseForRest?.rest_sec ?? null)
                    }}
                    onNote={exId => setShowNoteInput(prev => prev === exId ? null : exId)}
                    onTempo={handleTempoForSet}
                    onDeleteExercise={exId => setDeletedExerciseIds(prev => new Set(prev).add(exId))}
                    onOpenProgression={(exId, name) => setProgressionTarget({ exId, name })}
                  />
                  {/* Note inline */}
                  {showNoteInput === ex.id && (
                    <div className="mt-1 px-1">
                      <textarea
                        autoFocus
                        rows={2}
                        value={exerciseNotes[ex.id] ?? ''}
                        onFocus={() => { activeInputRef.current = true }}
                        onBlur={() => { activeInputRef.current = false }}
                        onChange={e => setExerciseNotes(prev => ({ ...prev, [ex.id]: e.target.value }))}
                        placeholder={t('logger.note.placeholder')}
                        className="w-full bg-white/[0.03] rounded-xl px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none resize-none"
                      />
                    </div>
                  )}
                </div>
              ))
          })}
      </main>

      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 px-4 pt-3"
        style={{ paddingBottom: '12px' }}
      >
        <div className="mx-auto flex max-w-lg justify-end">
          <button
            onClick={() => setShowLibrary(true)}
            aria-label={t('logger.add.exercise')}
            className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-[#d9d9d9] bg-[#ededed] text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.97]"
          >
            <Plus size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>


      {/* ── Session context menu ── */}
      <AnimatePresence>
        {sessionMenuOpen && (
          <>
            <motion.div className="fixed inset-0 z-[65] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSessionMenuOpen(false)} />
            <motion.div
              className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[70] bg-[#111111] rounded-t-2xl"
              style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
              exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
              <div className="pt-4 divide-y divide-white/[0.05]">
                <button onClick={() => { startRest('', 0, 'bilateral', 120); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
                  <Clock size={16} className="opacity-70" /><span className="text-[15px] font-medium">{t('logger.manual.rest')}</span>
                </button>
                <button onClick={() => { setShowHydration(true); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
                  <span className="w-4 text-center text-[16px]">💧</span><span className="text-[15px] font-medium">{t('logger.hydration')}</span>
                </button>
                <button onClick={() => { setShowLibrary(true); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
                  <Plus size={16} className="opacity-70" /><span className="text-[15px] font-medium">{t('logger.add.exercise')}</span>
                </button>
                <button onClick={() => { setShowCustom(true); setSessionMenuOpen(false) }} className="w-full flex items-center gap-4 px-6 py-4 text-white active:bg-white/[0.04]">
                  <Plus size={16} className="opacity-70" /><span className="text-[15px] font-medium">{t('logger.create.customExercise')}</span>
                </button>
                <div className="pt-1">
                  <button onClick={() => { setSessionMenuOpen(false); setShowFinishConfirm(true) }} className="w-full flex items-center gap-4 px-6 py-4 text-red-400 active:bg-white/[0.04]">
                    <Flag size={16} className="opacity-70" /><span className="text-[15px] font-medium">{t('logger.finish')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Superset context menu ── */}
      {supersetMenuFor && (
        <SupersetContextMenu
          open={true}
          onDissolve={() => { setDissolvedGroupIds(prev => new Set(prev).add(supersetMenuFor!)); setSupersetMenuFor(null) }}
          onRest={() => { startRest('', 0, 'bilateral', 120); setSupersetMenuFor(null) }}
          onDelete={() => {
            const group = exerciseGroups.find(g => g[0].group_id === supersetMenuFor)
            if (group) setDeletedExerciseIds(prev => { const next = new Set(prev); group.forEach(ex => next.add(ex.id)); return next })
            setSupersetMenuFor(null)
          }}
          onClose={() => setSupersetMenuFor(null)}
        />
      )}

      {/* ── Swap sheet ── */}
      {swapTarget && (
        <ExerciseSwapSheet
          exercise={sessionExercises.find(e => e.id === swapTarget)!}
          allExercises={sessionExercises}
          onSwap={(newName) => handleSwap(swapTarget, newName)}
          onClose={() => setSwapTarget(null)}
        />
      )}

      {/* ── Client alternatives ── */}
      {altSheetTarget !== null && sessionExercises[altSheetTarget]?.clientAlternatives?.length ? (
        <ClientAlternativesSheet
          exerciseName={displayNameForExercise(sessionExercises[altSheetTarget], swappedExercises)}
          alternatives={sessionExercises[altSheetTarget].clientAlternatives!}
          onSelect={(name) => { handleSwap(sessionExercises[altSheetTarget!].id, name); setAltSheetTarget(null) }}
          onClose={() => setAltSheetTarget(null)}
        />
      ) : null}

      {showLibrary ? (
        <LibrarySheet
          onClose={() => setShowLibrary(false)}
          onCreateCustom={() => {
            setShowLibrary(false)
            setShowCustom(true)
          }}
          onSelect={(entry) => {
            void createCatalogExercise(entry)
              .then(() => setShowLibrary(false))
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

      {/* ── Progression overlay — historique multi-séances ── */}
      {progressionTarget && (() => {
        const currentDone = sets.filter(s => s.exercise_id === progressionTarget.exId && s.completed)
        const bestCurrentWeight = currentDone.length > 0
          ? Math.max(...currentDone.map(s => parseFloat(s.actual_weight_kg) || 0))
          : null

        // Sparkline SVG from exHistory sessions
        const sparkPoints = exHistory?.sessions.map(s => s.best_weight) ?? []
        const sparkMax = sparkPoints.length > 0 ? Math.max(...sparkPoints) : 0
        const sparkMin = sparkPoints.length > 0 ? Math.min(...sparkPoints) : 0
        const sparkRange = sparkMax - sparkMin || 1
        const SW = 280, SH = 48, PAD = 4
        const sx = (i: number) => sparkPoints.length < 2 ? SW / 2 : PAD + (i / (sparkPoints.length - 1)) * (SW - PAD * 2)
        const sy = (v: number) => SH - PAD - ((v - sparkMin) / sparkRange) * (SH - PAD * 2)
        let sparkPath = ''
        for (let i = 0; i < sparkPoints.length; i++) {
          if (i === 0) sparkPath += `M ${sx(i)} ${sy(sparkPoints[i])}`
          else {
            const px = sx(i - 1), py = sy(sparkPoints[i - 1])
            const cx = sx(i), cy = sy(sparkPoints[i])
            sparkPath += ` C ${px + (cx - px) / 2} ${py} ${px + (cx - px) / 2} ${cy} ${cx} ${cy}`
          }
        }

        // Delta vs last session
        const lastSession = exHistory?.sessions[exHistory.sessions.length - 1]
        const delta = lastSession && bestCurrentWeight
          ? Math.round((bestCurrentWeight - lastSession.best_weight) * 10) / 10
          : null

        // Last 3 sessions to display
        const recentSessions = exHistory?.sessions.slice(-3).reverse() ?? []

        return (
          <div className="fixed inset-0 z-[80] bg-black/70" onClick={() => setProgressionTarget(null)}>
            <div
              className="absolute inset-x-0 bottom-0 bg-[#111111] rounded-t-2xl px-4 pt-3 max-h-[88dvh] overflow-y-auto"
              style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-white/[0.12] mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-black text-white leading-tight truncate">{progressionTarget.name}</p>
                  {exHistory && exHistory.all_time_best > 0 && (
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {t('logger.progress.allTimeBest')} · <span className="font-bold text-white/70">{exHistory.all_time_best}kg</span>
                      {exHistory.session_count > 0 && <span className="ml-2 text-white/25">· {exHistory.session_count} {t('progress.kpi.sessions').toLowerCase()}</span>}
                    </p>
                  )}
                </div>
                {delta !== null && (
                  <span className={`ml-3 shrink-0 text-[12px] font-black px-2 py-1 rounded-lg tabular-nums ${delta >= 0 ? 'bg-[#5dba87]/20 text-[#5dba87]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}>
                    {delta >= 0 ? '+' : ''}{delta}kg
                  </span>
                )}
              </div>

              {/* Loading */}
              {exHistoryLoading && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                </div>
              )}

              {/* Sparkline */}
              {!exHistoryLoading && sparkPoints.length >= 2 && (
                <div className="bg-white/[0.03] rounded-xl px-3 py-2 mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">{t('logger.progress.maxLoad')}</span>
                    {exHistory && exHistory.progression !== 0 && (
                      <span className={`text-[10px] font-bold tabular-nums ${exHistory.progression > 0 ? 'text-[#5dba87]' : 'text-[#ef4444]'}`}>
                        {exHistory.progression > 0 ? '+' : ''}{exHistory.progression}{t('logger.progress.totalKg')}
                      </span>
                    )}
                  </div>
                  <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full" style={{ height: 48 }}>
                    <path d={sparkPath} fill="none" stroke={TRAINING_ACCENT} strokeWidth="1.5" strokeLinecap="round" />
                    {sparkPoints.map((v, i) => (
                      <circle key={i} cx={sx(i)} cy={sy(v)} r="2.5" fill={TRAINING_ACCENT} opacity={i === sparkPoints.length - 1 ? 1 : 0.5} />
                    ))}
                  </svg>
                  <div className="flex justify-between text-[8px] font-mono text-white/25 mt-0.5">
                    <span>{sparkPoints[0]}kg</span>
                    <span>{sparkPoints[sparkPoints.length - 1]}kg</span>
                  </div>
                </div>
              )}

              {/* Cette séance */}
              {currentDone.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-2">{t('logger.progress.thisSession')}</p>
                  <div className="space-y-1">
                    {currentDone.map((s, i) => {
                      const w = parseFloat(s.actual_weight_kg) || 0
                      const isTop = w === bestCurrentWeight && w > 0
                      return (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${isTop ? 'bg-[#5dba87]/10' : 'bg-white/[0.02]'}`}>
                          <span className="text-[10px] font-barlow-condensed font-bold uppercase text-white/30 shrink-0 w-12">{t('logger.set')} {s.set_number}</span>
                          <span className="text-[13px] font-bold text-white flex-1">
                            {s.actual_weight_kg || '—'}kg <span className="text-white/50 font-normal">× {s.actual_reps || '—'}</span>
                          </span>
                          {s.rir_actual !== '' && <span className="text-[10px] text-white/35 shrink-0">{t('logger.field.rir')} {s.rir_actual}</span>}
                          {isTop && <span className="text-[8px] font-black uppercase text-[#5dba87] shrink-0">{t('logger.progress.top')}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Dernières séances */}
              {!exHistoryLoading && recentSessions.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-2">
                    {t('logger.progress.recentSessions')}
                  </p>
                  <div className="space-y-2">
                    {recentSessions.map((session, si) => (
                      <div key={si} className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-white/40">
                            {new Date(session.date).toLocaleDateString(lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-[11px] font-bold text-white/70 tabular-nums">
                            {session.best_weight}kg
                            {si === 0 && exHistory && session.best_weight === exHistory.all_time_best && (
                              <span className="ml-1.5 text-[8px] font-black uppercase text-[#5dba87]">{t('logger.progress.pr')}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {session.sets.sort((a, b) => a.set_number - b.set_number).map((set, i) => (
                            <span key={i} className="text-[10px] font-mono text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                              {set.weight_kg}×{set.reps}{set.rir != null ? ` R${set.rir}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aucun historique */}
              {!exHistoryLoading && recentSessions.length === 0 && currentDone.length === 0 && (
                <p className="text-[12px] text-white/30 text-center py-6">{t('logger.progress.firstTime')}</p>
              )}

              <button
                onClick={() => setProgressionTarget(null)}
                className="w-full py-3 rounded-xl bg-white/[0.04] text-[12px] text-white/40 active:bg-white/[0.08]"
              >
                {t('ui.close')}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Rest modal ── */}
      {restModalOpen && restStartedAt !== null && (() => {
        const upcoming = resolveUpcomingRestTarget()
        const timeDisplay = restPrescribed !== null ? formatTime(restPrescribed - restElapsed) : formatTime(restElapsed)

        return (
          <div className="fixed inset-0 z-[100] overflow-hidden bg-[#080808] isolate">
            {/* Jauge de récupération montante, couleur verte plate et flash (sans transparence) - z-0 pour rester sous le texte */}
            {/* -bottom-8 et +6rem pour déborder sous l'indicateur d'accueil iOS (Home Indicator) et au-dessus de la barre de statut (Notch / Dynamic Island) */}
            <motion.div
              className="absolute inset-x-0 bottom-0 pointer-events-none z-0"
              style={{
                backgroundColor: restVisualColor,
                top: 0,
                transformOrigin: 'bottom',
                scaleY: isOvertime ? 1 : restProgress,
              }}
              transition={{
                scaleY: { duration: 1, ease: 'linear' },
              }}
            />

            <div
              className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-between px-5 text-center"
              style={{
                paddingTop: 'max(24px, env(safe-area-inset-top))',
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                transform: 'translate3d(0, 0, 0)'
              }}
            >
              {/* Header avec bouton fermer pour éviter le positionnement absolu conflictuel */}
              <div className="w-full flex justify-end">
                <button
                  onClick={() => dismissRestModal(REST_MODAL_REOPEN_MS)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] border border-white/[0.04] text-white/50 hover:text-white active:scale-95 transition-transform"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Main content centered: timer, card and adjustments */}
              <div className="w-full max-w-sm flex flex-col justify-center gap-7 my-auto py-4">

                {/* Bloc Chrono */}
                <div className="py-2">
                  {/* Label TEMPS DE REPOS / TEMPS DÉPASSÉ */}
                  <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.24em] text-white">
                    {isOvertime ? t('logger.rest.overtime.label') : t('logger.rest.time')}
                  </p>

                  {/* Chrono — agrandi */}
                  <p className="mt-2.5 text-[6.5rem] font-barlow-condensed font-black leading-[0.85] tracking-tight tabular-nums text-white">
                    {timeDisplay}
                  </p>
                </div>

                {/* Carte prochaine série */}
                {upcoming && (() => {
                  const { exercise: upEx, set: upSet } = upcoming
                  const upKey = recKey(upSet.exercise_id, upSet.set_number, upSet.side)
                  const upRec = recommendations[upKey]
                  const upHistRef = historyReferences[upKey] ?? null
                  const upTargetRir = resolveExerciseTargetRir(upEx as Exercise, upSet.set_number)

                  const dispReps = upRec ? String(upRec.reps) : upHistRef ? String(upHistRef.reps) : upSet.planned_reps || '—'
                  const dispWeight = upRec ? String(upRec.weight_kg) : upHistRef ? String(upHistRef.weight) : '—'
                  const dispRir = upTargetRir !== null ? String(upTargetRir) : upHistRef?.rir != null ? String(upHistRef.rir) : null
                  const dispRest = upSet.rest_sec
                  const isFromHistory = !upRec && !!upHistRef

                  const workingSetsForEx = sets.filter(s => s.exercise_id === upEx.id && s.set_type === 'working')
                  const workingIndex = workingSetsForEx.findIndex(s => s.set_number === upSet.set_number && s.side === upSet.side) + 1 || upSet.set_number
                  const sideLabel = upSet.side === 'left' ? 'G' : upSet.side === 'right' ? 'D' : null

                  return (
                    <div className="w-full text-left">
                      {/* Label section */}
                      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.22em] text-white mb-2.5 text-center">
                        {t('logger.next.set')}
                      </p>

                      {/* Fond noir opaque → contraste parfait sur noir ET sur vert */}
                      <div className="rounded-2xl bg-[#111111] border border-white/[0.04] overflow-hidden">
                        {/* En-tête exercice — toujours affiché */}
                        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                          {upEx.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={upEx.image_url}
                              alt={upEx.name}
                              className="w-9 h-9 rounded-xl object-cover shrink-0 opacity-85"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-white/[0.06] shrink-0 flex items-center justify-center">
                              <span className="text-[16px]">💪</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-white leading-tight truncate">
                              {displayNameForExercise(upEx, swappedExercises)}
                            </p>
                            {isFromHistory && (
                              <p className="text-[9px] text-white/40 mt-0.5">{t('logger.progress.basedOnLast')}</p>
                            )}
                          </div>
                        </div>

                        {/* Séparateur */}
                        <div className="h-px bg-white/[0.06] mx-4" />

                        {/* Données de la série avec colonnes Grid et séparateurs alignés */}
                        <div className={dispRir !== null ? "grid grid-cols-4 items-center py-3.5 text-center" : "grid grid-cols-3 items-center py-3.5 text-center"}>
                          {/* Col 1: Numéro de série & Repos prescrit */}
                          <div className="flex items-center justify-center gap-2 px-1">
                            <div className="shrink-0 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/20 px-1.5 py-0.5 min-w-[26px]">
                              <span className="text-[11px] font-barlow-condensed font-bold text-white">
                                {sideLabel && <span className="mr-0.5 opacity-60">{sideLabel}</span>}
                                {workingIndex}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-white/60">
                              {dispRest !== null
                                ? `${String(Math.floor(dispRest / 60)).padStart(2, '0')}:${String(dispRest % 60).padStart(2, '0')}`
                                : '—'}
                            </span>
                          </div>

                          {/* Col 2: Reps */}
                          <div className="relative flex flex-col items-center justify-center">
                            {/* Left divider line inside column */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-5 bg-white/[0.06]" />
                            <p className="text-[18px] font-black text-white leading-none">{dispReps}</p>
                            <p className="text-[9px] uppercase tracking-wider text-white/50 mt-1">{t('logger.label.repsShort')}</p>
                          </div>

                          {/* Col 3: Charge */}
                          <div className="relative flex flex-col items-center justify-center">
                            {/* Left divider line inside column */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-5 bg-white/[0.06]" />
                            <p className="text-[18px] font-black text-white leading-none">
                              {dispWeight}
                              <span className="text-[10px] font-normal text-white/60 ml-0.5">kg</span>
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-white/50 mt-1">{t('logger.field.load')}</p>
                          </div>

                          {/* Col 4: RIR (Optionnel) */}
                          {dispRir !== null && (
                            <div className="relative flex flex-col items-center justify-center">
                              {/* Left divider line inside column */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-5 bg-white/[0.06]" />
                              <p className="text-[18px] font-black text-white leading-none">{dispRir}</p>
                              <p className="text-[9px] uppercase tracking-wider text-white/50 mt-1">{t('logger.field.rir').toLowerCase()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Ajustement ±30s — boutons opaques dans une carte pour se protéger du vert */}
                <div className="flex items-center justify-center gap-4 bg-[#111111] border border-white/[0.04] px-4 py-2.5 rounded-2xl mx-auto">
                  <button
                    onClick={() => setRestPrescribed(p => p !== null ? Math.max(10, p - 30) : p)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1a1a] border border-white/[0.04] text-white text-[18px] font-bold active:scale-95 transition-transform"
                  >−</button>
                  <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wider text-white w-10 text-center">30s</span>
                  <button
                    onClick={() => setRestPrescribed(p => p !== null ? p + 30 : p)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1a1a] border border-white/[0.04] text-white text-[18px] font-bold active:scale-95 transition-transform"
                  >+</button>
                </div>
              </div>

              {/* Action buttons at the bottom */}
              <div className="w-full max-w-sm flex flex-col gap-2.5 mt-auto pt-4">
                {/* CTA Prêt — principal avec fond opaque gris sombre et texte blanc pur */}
                <button
                  onClick={markRestReady}
                  className="w-full h-24 rounded-2xl bg-[#111111] border border-white/[0.04] text-white text-[17px] font-barlow-condensed font-black uppercase tracking-[0.18em] active:scale-[0.98] transition-all hover:border-white/10 flex items-center justify-center"
                >
                  {t('logger.action.ready')}
                </button>

                {/* Passer le repos — secondaire, texte seul blanc pur sans fond */}
                <button
                  onClick={() => { finalizeCurrentRest(); stopRest(); }}
                  className="w-full py-3 bg-transparent text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/70 hover:text-white active:scale-[0.98] transition-colors"
                >
                  {t('logger.rest.skip')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Finish confirm modal ── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111111] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-2">{t('logger.finish.confirm')}</h3>
            <p className="text-[13px] text-white/55 mb-5">
              {t('logger.finish.desc', { n: String(remainingSets) })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium">
                {t('logger.finish.cancel')}
              </button>
              <button
                onClick={() => { setShowFinishConfirm(false); submitSession() }}
                disabled={saveState === 'saving'}
                className="flex-1 py-2.5 rounded-xl bg-[#f2f2f2] text-[#080808] text-[13px] font-bold uppercase hover:bg-[#e0e0e0] disabled:opacity-50 transition-colors"
              >
                {saveState === 'saving' ? '…' : t('logger.finish.action')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prep time modal ── */}
      {prepTimeTarget && (
        <PrepTimeModal
          exerciseName={prepTimeTarget.exerciseName}
          onConfirm={(seconds, hapticsEnabled) => {
            setTempoGuideTarget({
              ...prepTimeTarget,
              prepSeconds: seconds,
              hapticsEnabled,
            })
            setPrepTimeTarget(null)
          }}
          onClose={() => setPrepTimeTarget(null)}
        />
      )}

      {/* ── Tempo guide modal ── */}
      {tempoGuideTarget && (
        <TempoGuideModal
          tempo={tempoGuideTarget.tempo}
          reps={tempoGuideTarget.reps}
          exerciseName={tempoGuideTarget.exerciseName}
          prepSeconds={tempoGuideTarget.prepSeconds}
          hapticsEnabled={tempoGuideTarget.hapticsEnabled}
          onClose={(result) => {
            if (result.bonusReps > 0 && tempoGuideTarget) {
              const key = recKey(tempoGuideTarget.exerciseId, tempoGuideTarget.setNumber, tempoGuideTarget.side)
              setSets(prev => prev.map(s =>
                s.exercise_id === tempoGuideTarget.exerciseId && s.set_number === tempoGuideTarget.setNumber && s.side === tempoGuideTarget.side
                  ? { ...s, actual_reps: String(result.totalReps) } : s
              ))
              setManuallyEdited(prev => new Set(prev).add(key))
            }
            setTempoGuideTarget(null)
          }}
        />
      )}

      {/* ── Hydratation intro ── */}
      {showHydrationIntro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex flex-col items-center justify-center p-6 gap-6">
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.22em] text-white/30">{t('logger.hydrationIntro')}</p>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <path d="M36 8 Q50 28 50 44 Q50 58 36 62 Q22 58 22 44 Q22 28 36 8Z" fill="rgba(96,165,250,0.7)" />
            <ellipse cx="30" cy="38" rx="4" ry="6" fill="rgba(255,255,255,0.18)" />
          </svg>
          <div className="text-center">
            <p className="text-[3.2rem] font-barlow-condensed font-black leading-none tabular-nums text-white">{hydrationPlan.totalMl} ml</p>
            <p className="text-[11px] font-barlow-condensed uppercase tracking-[0.18em] text-white/30 mt-1">{t('logger.session.goal')}</p>
          </div>
          <div className="bg-white/[0.03] rounded-xl px-5 py-3 w-full max-w-xs text-center">
            <p className="text-[13px] text-white/55 leading-snug">{t('logger.hydrationPlan', { ml: `${hydrationPlan.mlPerSip}` })}</p>
          </div>
          <p className="text-[9px] font-barlow-condensed uppercase tracking-[0.18em] text-white/20">
            {t('logger.estimatedSession', {
              min: hydrationPlan.durationMin,
              profile: clientWeight ? `${clientWeight} kg` : t('logger.defaultProfile'),
            })}
          </p>
          <p className="text-[10px] text-white/30 text-center leading-relaxed max-w-xs">
            {t('logger.keepOpen')}
          </p>
          <button onClick={() => setShowHydrationIntro(false)} className="w-full max-w-xs h-12 rounded-xl font-barlow-condensed font-bold text-[13px] uppercase tracking-[0.14em] active:scale-[0.98]" style={{ backgroundColor: '#f2f2f2', color: '#080808' }}>
            {t('logger.hydrationStart')}
          </button>
        </div>
      )}

      {/* ── Hydratation reminder ── */}
      {showHydration && !showHydrationIntro && !tempoGuideTarget && !restModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex flex-col items-center justify-center p-6 gap-6">
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.22em] text-white/30">{t('logger.hydrationReminder')}</p>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <path d="M36 8 Q50 28 50 44 Q50 58 36 62 Q22 58 22 44 Q22 28 36 8Z" fill="rgba(96,165,250,0.7)" />
            <ellipse cx="30" cy="38" rx="4" ry="6" fill="rgba(255,255,255,0.18)" />
          </svg>
          <div className="text-center">
            <p className="text-[3.2rem] font-barlow-condensed font-black leading-none tabular-nums text-white">{hydrationPlan.mlPerSip} ml</p>
            <p className="text-[11px] font-barlow-condensed uppercase tracking-[0.18em] text-white/30 mt-1">{t('logger.hydration.sips')}</p>
          </div>
          <button onClick={() => {
            setSipsConsumed(prev => prev + 1)
            setShowHydration(false)
            resetHydrationTimer(HYDRATION_INTERVAL_MS)
            void sendClientMutation({
              kind: 'water',
              url: '/api/client/water',
              method: 'POST',
              body: { amount_ml: hydrationPlan.mlPerSip },
            }).catch(() => {})
          }} className="w-full max-w-xs h-12 rounded-xl font-barlow-condensed font-bold text-[13px] uppercase tracking-[0.14em] active:scale-[0.98]" style={{ backgroundColor: '#f2f2f2', color: '#080808' }}>
            {t('logger.hydrationDrank')}
          </button>
          <button onClick={() => { setShowHydration(false); resetHydrationTimer(HYDRATION_INTERVAL_MS) }} className="w-full max-w-xs py-3 rounded-xl bg-white/[0.04] text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/40">
            {t('logger.hydrationSkip')}
          </button>
        </div>
      )}

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
      <div className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-[#111111] px-5 pt-4 pb-5">
        <div className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.12]" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#60a5fa]">{t('logger.library.title')}</p>
            <p className="mt-1 text-[18px] font-bold text-white">{t('logger.library.addTitle')}</p>
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
            {t('logger.library.all')}
          </button>
          {preparedMuscleGroups.map((group) => (
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
          {preparedMovementPatterns.map((pattern) => (
            <button
              key={pattern}
              onClick={() => setMovementPattern(pattern)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] ${movementPattern === pattern ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/35'}`}
            >
              {pattern.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 pb-4">
          {visibleResults.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry)}
              className="flex w-full items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-white">{entry.displayName}</p>
                <p className="mt-1 text-[11px] text-white/35">
                  {[entry.muscleGroup, entry.primaryMuscle, entry.exerciseType].filter(Boolean).join(' · ') || t('logger.library.title')}
                </p>
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

        <div className="mt-3 shrink-0">
          <button
            onClick={onCreateCustom}
            className="h-11 w-full rounded-xl bg-white/[0.05] font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/80"
          >
            {t('logger.create.customExercise')}
          </button>
        </div>
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
            {t('logger.action.cancel')}
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
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/35">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-white/20"
      />
    </label>
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
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/35">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl bg-white/[0.04] px-3 text-[13px] text-white outline-none"
      >
        {children}
      </select>
    </label>
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
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-11 items-center justify-between rounded-xl px-3 text-left ${checked ? 'bg-[#60a5fa]/15 text-[#93c5fd]' : 'bg-white/[0.04] text-white/70'}`}
    >
      <span className="text-[12px] font-medium">{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-[#93c5fd]' : 'bg-white/25'}`} />
    </button>
  )
}
