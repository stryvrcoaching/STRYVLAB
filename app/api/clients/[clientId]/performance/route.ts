import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isMeaningfulSession } from '@/lib/training/sessionLogUtils'
import { estimateOneRM } from '@/lib/training/oneRepMax'
import { resolveCanonicalExerciseKey, resolveCanonicalExerciseName } from '@/lib/training/exerciseHistoryKey'
import { computeRobustAverageRestSec } from '@/lib/training/restMetrics'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function inferMuscleGroup(name: string): string {
  const n = normalizeText(name)
  if (/squat|barre front|leg press|leg curl|leg ext|lunge|hack|rdl|deadlift|hip thrust|glute|presse a cuisse|presse a cuisses|fente|souleve de terre|souleve|good morning|kettlebell swing|donkey kick|fire hydrant|montee sur banc|sled push|sled pull|pull through|rack pull|step up|nordic|split squat|bulgarian/.test(n)) return 'Jambes'
  if (/bench|chest|pec|fly|push[\s-]up|developpe couche|developpe incline|developpe halteres|ecarte|dips pecto|crossover|svend/.test(n)) return 'Pectoraux'
  if (/pull[\s-]up|chin[\s-]up|\blat\b|\brow\b|cable[\s-]row|seated[\s-]row|t[\s-]bar|tirage|rowing|traction|grand dorsal|pullover|pull over|superman|hyperextension|bird dog/.test(n)) return 'Dos'
  if (/shoulder|military|elevation lateral|elevation frontal|elevation en y|oiseau|developpe militaire|face pull|upright|rear delt|lateral raise|shrug|haussement|rotation externe|rotation interne|presse epaule|croix de fer|thruster|arnold/.test(n)) return 'Épaules'
  if (/\bcurl\b|bicep|hammer|marteau|drag curl|waiter curl|reverse curl|zottman/.test(n)) return 'Biceps'
  if (/tricep|skullcrusher|extension|kickback|dips tricep|prise serree|close.grip|jm press|tate press/.test(n)) return 'Triceps'
  if (/crunch|plank|planche|ab\b|abdo|core|oblique|gainage|dead bug|hollow|dragon flag|mountain climber|sit.up|sit up|releve de jambe|releve de genou|russian twist|windmill|pallof|rotation buste|cocon|ciseaux|jackknife|touche talon|roulette|bicyclette|cercles jambes|flexion laterale/.test(n)) return 'Abdos'
  if (/calf|mollet|standing calf|seated calf/.test(n)) return 'Mollets'
  if (/poignet|wrist|forearm|avant.bras/.test(n)) return 'Avant-bras'
  return 'Autre'
}

function prettifyMuscleSlug(slug: string) {
  const labels: Record<string, string> = {
    chest: 'Pectoraux',
    shoulders: 'Épaules',
    biceps: 'Biceps',
    triceps: 'Triceps',
    abs: 'Abdos',
    quads: 'Quadriceps',
    hamstrings: 'Ischios',
    glutes: 'Fessiers',
    calves: 'Mollets',
    back_upper: 'Dos',
    back_lower: 'Lombaires',
    traps: 'Trapèzes',
  }
  return labels[slug] ?? slug
}

function prettifyPattern(pattern: string | null | undefined) {
  const labels: Record<string, string> = {
    horizontal_push: 'Poussée horizontale',
    vertical_push: 'Poussée verticale',
    horizontal_pull: 'Tirage horizontal',
    vertical_pull: 'Tirage vertical',
    squat_pattern: 'Pattern squat',
    hip_hinge: 'Charnière hanche',
    knee_flexion: 'Flexion genou',
    knee_extension: 'Extension genou',
    calf_raise: 'Mollets',
    wrist_flexion: 'Flexion poignet',
    wrist_extension: 'Extension poignet',
    forearm_rotation: 'Rotation avant-bras',
    elbow_flexion: 'Flexion coude',
    elbow_extension: 'Extension coude',
    lateral_raise: 'Élévation latérale',
    hip_abduction: 'Abduction hanche',
    hip_adduction: 'Adduction hanche',
    shoulder_rotation: 'Rotation épaule',
    carry: 'Carry',
    scapular_elevation: 'Shrug',
    scapular_retraction: 'Rétraction scapulaire',
    scapular_protraction: 'Protraction scapulaire',
    core_anti_flex: 'Gainage',
    core_flex: 'Flexion core',
    core_rotation: 'Rotation core',
  }
  if (!pattern) return 'Autre'
  return labels[pattern] ?? pattern
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function daysBetweenInclusive(from: Date, to: Date) {
  const out: Date[] = []
  const cursor = startOfDay(from)
  const end = startOfDay(to)
  while (cursor <= end) {
    out.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function weekBucket(dateString: string) {
  const date = new Date(dateString)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return startOfDay(date).toISOString().split('T')[0]
}

type ProgramExerciseDef = {
  id: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  target_rir: number | null
  current_weight_kg: number | null
  weight_increment_kg: number | null
  movement_pattern: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  session_id: string
}

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const now = new Date()
  const sinceDate = days === 0 ? new Date(0) : new Date(Date.now() - days * 86400000)
  const since = sinceDate.toISOString().split('T')[0]

  const [{ data: sessionLogs }, { data: activeProgram }] = await Promise.all([
    db
      .from('client_session_logs')
      .select(`
        id, session_name, logged_at, completed_at, duration_min, program_session_id,
        client_set_logs (
          id, exercise_id, exercise_name, set_number, actual_reps, actual_weight_kg, completed,
          rir_actual, rest_sec_actual, primary_muscles, secondary_muscles
        )
      `)
      .eq('client_id', params.clientId)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true }),
    db
      .from('programs')
      .select(`
        id, name, goal, level, frequency, weeks, session_mode, status,
        program_sessions (
          id, name, day_of_week, days_of_week, position,
          program_exercises (
            id, name, sets, reps, rest_sec, rir, target_rir, current_weight_kg,
            weight_increment_kg, movement_pattern, primary_muscles, secondary_muscles
          )
        )
      `)
      .eq('client_id', params.clientId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const logs = sessionLogs ?? []
  const meaningfulLogs = logs.filter(isMeaningfulSession)

  const programSessions = ((activeProgram as any)?.program_sessions ?? [])
    .slice()
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))

  const programExercises: ProgramExerciseDef[] = programSessions.flatMap((session: any) =>
    ((session.program_exercises ?? []) as any[]).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      sets: exercise.sets ?? 0,
      reps: exercise.reps ?? '',
      rest_sec: exercise.rest_sec ?? null,
      rir: exercise.rir ?? null,
      target_rir: exercise.target_rir ?? null,
      current_weight_kg: exercise.current_weight_kg ?? null,
      weight_increment_kg: exercise.weight_increment_kg ?? null,
      movement_pattern: exercise.movement_pattern ?? null,
      primary_muscles: exercise.primary_muscles ?? [],
      secondary_muscles: exercise.secondary_muscles ?? [],
      session_id: session.id,
    }))
  )

  const programExerciseById = new Map(programExercises.map((exercise) => [exercise.id, exercise]))
  const programExerciseByName = new Map(programExercises.map((exercise) => [normalizeText(exercise.name), exercise]))
  const programExerciseByCanonicalKey = new Map(
    programExercises.map((exercise) => [resolveCanonicalExerciseKey(exercise.name), exercise] as const),
  )
  const activeProgramSessionIds = new Set(programSessions.map((session: any) => session.id))

  const isEffective = (set: {
    completed: boolean
    actual_reps: number | null
    actual_weight_kg: number | null
  }) => set.completed || set.actual_reps != null

  const effectiveSets = meaningfulLogs.flatMap((log) => (log.client_set_logs ?? []).filter(isEffective))
  const completedSessions = meaningfulLogs.filter((log) => log.completed_at).length
  const draftSessions = meaningfulLogs.filter((log) => !log.completed_at).length

  const totalVolumeRaw = effectiveSets.reduce(
    (acc, set: any) => acc + (set.actual_reps ?? 0) * (Number(set.actual_weight_kg) ?? 0),
    0
  )

  const restValues = effectiveSets
    .map((set: any) => set.rest_sec_actual as number | null | undefined)
    .filter((value): value is number => value != null && value > 0)

  const durationValues = meaningfulLogs
    .map((log) => log.duration_min)
    .filter((value): value is number => value != null && value > 0)

  const totalSessions = meaningfulLogs.length
  const totalSets = effectiveSets.length
  const totalReps = effectiveSets.reduce((acc, set: any) => acc + (set.actual_reps ?? 0), 0)
  const totalVolume = Math.round(totalVolumeRaw)
  const avgDuration =
    durationValues.length > 0
      ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
      : 0
  const avgRestSec = computeRobustAverageRestSec(restValues)
  const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0

  const durationBuckets = meaningfulLogs
    .filter((log) => log.duration_min != null)
    .slice(-8)
    .map((log) => ({
      id: log.id,
      date: log.logged_at.split('T')[0],
      durationMin: log.duration_min ?? 0,
      isCompleted: Boolean(log.completed_at),
    }))

  const timelineMap: Record<string, { date: string; volume: number; reps: number; sets: number; sessions: number }> = {}
  const weeklyMap: Record<string, { volume: number; sets: number; sessions: number }> = {}
  const muscleMap: Record<string, { volume: number; sets: number; reps: number }> = {}
  const movementPatternMap: Record<string, { volume: number; sets: number; reps: number }> = {}
  const exerciseMap: Record<string, { name: string; sessions: { date: string; maxWeight: number; totalVolume: number; totalReps: number; sets: number; oneRM: number }[] }> = {}
  const keyExerciseMap: Record<string, {
    id: string
    name: string
    movementPattern: string | null
    primaryMuscles: string[]
    secondaryMuscles: string[]
    currentWeightKg: number | null
    weightIncrementKg: number | null
    targetRir: number | null
    plannedRestSec: number | null
    plannedSetsPerExposure: number
    sessions: { date: string; maxWeight: number; totalVolume: number; totalReps: number; sets: number; oneRM: number; actualRestSec: number | null; actualRir: number | null }[]
  }> = {}

  for (const exercise of programExercises) {
    keyExerciseMap[exercise.id] = {
      id: exercise.id,
      name: exercise.name,
      movementPattern: exercise.movement_pattern,
      primaryMuscles: exercise.primary_muscles ?? [],
      secondaryMuscles: exercise.secondary_muscles ?? [],
      currentWeightKg: exercise.current_weight_kg ?? null,
      weightIncrementKg: exercise.weight_increment_kg ?? null,
      targetRir: exercise.target_rir ?? exercise.rir ?? null,
      plannedRestSec: exercise.rest_sec ?? null,
      plannedSetsPerExposure: exercise.sets ?? 0,
      sessions: [],
    }
  }

  for (const log of meaningfulLogs) {
    const date = log.logged_at.split('T')[0]
    const weekKey = weekBucket(date)
    if (!timelineMap[date]) timelineMap[date] = { date, volume: 0, reps: 0, sets: 0, sessions: 0 }
    if (!weeklyMap[weekKey]) weeklyMap[weekKey] = { volume: 0, sets: 0, sessions: 0 }
    timelineMap[date].sessions += 1
    weeklyMap[weekKey].sessions += 1

    const byExerciseForLog = new Map<string, {
      key: string
      resolvedExercise: ProgramExerciseDef | null
      maxWeight: number
      totalVolume: number
      totalReps: number
      sets: number
      bestOneRM: number
      actualRestValues: number[]
      actualRirValues: number[]
    }>()

    for (const set of (log.client_set_logs ?? [])) {
      if (!isEffective(set as any)) continue

      const actualWeight = Number((set as any).actual_weight_kg) || 0
      const actualReps = (set as any).actual_reps ?? 0
      const volume = actualReps * actualWeight
      const actualRir = (set as any).rir_actual as number | null
      const restActual = (set as any).rest_sec_actual as number | null
      const resolvedExercise =
        ((set as any).exercise_id && programExerciseById.get((set as any).exercise_id)) ??
        programExerciseByCanonicalKey.get(resolveCanonicalExerciseKey((set as any).exercise_name ?? '')) ??
        programExerciseByName.get(normalizeText((set as any).exercise_name ?? '')) ??
        null

      const resolvedKey = resolvedExercise?.id
        ?? ((set as any).exercise_id && programExerciseById.has((set as any).exercise_id) ? (set as any).exercise_id : null)
        ?? resolveCanonicalExerciseKey((set as any).exercise_name ?? '')
      const resolvedName = resolvedExercise?.name ?? resolveCanonicalExerciseName((set as any).exercise_name ?? 'Exercice')
      const setMuscles = ((set as any).primary_muscles ?? []) as string[]
      const muscles =
        setMuscles.length > 0
          ? setMuscles
          : (resolvedExercise?.primary_muscles?.length ?? 0) > 0
            ? resolvedExercise?.primary_muscles ?? []
            : [inferMuscleGroup(resolvedName)]
      const pattern = prettifyPattern(resolvedExercise?.movement_pattern)

      timelineMap[date].sets += 1
      timelineMap[date].reps += actualReps
      timelineMap[date].volume += volume
      weeklyMap[weekKey].sets += 1
      weeklyMap[weekKey].volume += volume

      for (const muscle of muscles) {
        const key = setMuscles.length > 0 || (resolvedExercise?.primary_muscles?.length ?? 0) > 0
          ? prettifyMuscleSlug(muscle)
          : muscle
        if (!muscleMap[key]) muscleMap[key] = { volume: 0, sets: 0, reps: 0 }
        muscleMap[key].volume += volume
        muscleMap[key].sets += 1
        muscleMap[key].reps += actualReps
      }

      if (!movementPatternMap[pattern]) movementPatternMap[pattern] = { volume: 0, sets: 0, reps: 0 }
      movementPatternMap[pattern].volume += volume
      movementPatternMap[pattern].sets += 1
      movementPatternMap[pattern].reps += actualReps

      if (!exerciseMap[resolvedName]) exerciseMap[resolvedName] = { name: resolvedName, sessions: [] }

      const exerciseAggregate = byExerciseForLog.get(resolvedKey) ?? {
        key: resolvedKey,
        resolvedExercise,
        maxWeight: 0,
        totalVolume: 0,
        totalReps: 0,
        sets: 0,
        bestOneRM: 0,
        actualRestValues: [],
        actualRirValues: [],
      }

      exerciseAggregate.maxWeight = Math.max(exerciseAggregate.maxWeight, actualWeight)
      exerciseAggregate.totalVolume += volume
      exerciseAggregate.totalReps += actualReps
      exerciseAggregate.sets += 1
      exerciseAggregate.bestOneRM = Math.max(
        exerciseAggregate.bestOneRM,
        estimateOneRM(actualWeight, Math.max(actualReps, 1), actualRir ?? 0)
      )
      if (restActual != null && restActual > 0) exerciseAggregate.actualRestValues.push(restActual)
      if (actualRir != null) exerciseAggregate.actualRirValues.push(actualRir)
      byExerciseForLog.set(resolvedKey, exerciseAggregate)
    }

    for (const aggregate of byExerciseForLog.values()) {
      const sessionPoint = {
        date,
        maxWeight: Math.round(aggregate.maxWeight * 100) / 100,
        totalVolume: Math.round(aggregate.totalVolume),
        totalReps: aggregate.totalReps,
        sets: aggregate.sets,
        oneRM: aggregate.bestOneRM,
      }

      const exerciseName = aggregate.resolvedExercise?.name ?? exerciseMap[aggregate.key]?.name ?? aggregate.key
      if (!exerciseMap[exerciseName]) exerciseMap[exerciseName] = { name: exerciseName, sessions: [] }
      exerciseMap[exerciseName].sessions.push(sessionPoint)

      if (aggregate.resolvedExercise) {
        const target = keyExerciseMap[aggregate.resolvedExercise.id]
        target.sessions.push({
          ...sessionPoint,
          actualRestSec:
            aggregate.actualRestValues.length > 0
              ? Math.round(aggregate.actualRestValues.reduce((sum, value) => sum + value, 0) / aggregate.actualRestValues.length)
              : null,
          actualRir:
            aggregate.actualRirValues.length > 0
              ? Math.round((aggregate.actualRirValues.reduce((sum, value) => sum + value, 0) / aggregate.actualRirValues.length) * 10) / 10
              : null,
        })
      }
    }
  }

  const rpeTrend = meaningfulLogs
    .filter((log) => (log.client_set_logs ?? []).some((set: any) => isEffective(set) && set.rir_actual != null))
    .map((log) => {
      const rirValues = (log.client_set_logs ?? [])
        .filter((set: any) => isEffective(set) && set.rir_actual != null)
        .map((set: any) => 10 - (set.rir_actual as number))
      const avg = rirValues.reduce((sum: number, value: number) => sum + value, 0) / rirValues.length
      return {
        date: log.logged_at.split('T')[0],
        avgRpe: Math.round(avg * 10) / 10,
      }
    })

  const latestMeaningfulLog = [...meaningfulLogs].sort(
    (a, b) => new Date(`${b.logged_at}T00:00:00`).getTime() - new Date(`${a.logged_at}T00:00:00`).getTime()
  )[0]

  const latestSession = latestMeaningfulLog
    ? (() => {
        const effective = (latestMeaningfulLog.client_set_logs ?? []).filter(isEffective)
        const rirValues = effective
          .filter((set: any) => set.rir_actual != null)
          .map((set: any) => 10 - (set.rir_actual as number))
        const avgRpe = rirValues.length > 0
          ? Math.round((rirValues.reduce((sum: number, value: number) => sum + value, 0) / rirValues.length) * 10) / 10
          : null
        const latestVolume = effective.reduce(
          (acc, set: any) => acc + ((set.actual_reps ?? 0) * (Number(set.actual_weight_kg) ?? 0)),
          0
        )
        return {
          id: latestMeaningfulLog.id,
          sessionName: latestMeaningfulLog.session_name,
          date: latestMeaningfulLog.logged_at.split('T')[0],
          durationMin: latestMeaningfulLog.duration_min ?? null,
          volume: Math.round(latestVolume),
          avgRpe,
          isCompleted: Boolean(latestMeaningfulLog.completed_at),
        }
      })()
    : null

  const allExercises = Object.values(exerciseMap)
    .map((exercise) => ({
      ...exercise,
      sessions: exercise.sessions.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort(
      (a, b) =>
        b.sessions.reduce((sum, item) => sum + item.totalVolume, 0) -
        a.sessions.reduce((sum, item) => sum + item.totalVolume, 0)
    )

  const exercises = allExercises.slice(0, 6)

  const keyExercises = Object.values(keyExerciseMap)
    .map((exercise) => {
      const sessions = exercise.sessions.sort((a, b) => a.date.localeCompare(b.date))
      const totalPerformedSets = sessions.reduce((sum, item) => sum + item.sets, 0)
      const totalPerformedReps = sessions.reduce((sum, item) => sum + item.totalReps, 0)
      const totalPerformedVolume = sessions.reduce((sum, item) => sum + item.totalVolume, 0)
      const actualRestValues = sessions.map((item) => item.actualRestSec).filter((value): value is number => value != null)
      const actualRirValues = sessions.map((item) => item.actualRir).filter((value): value is number => value != null)
      const estimated1RM = sessions.length > 0 ? Math.max(...sessions.map((item) => item.oneRM)) : null
      return {
        id: exercise.id,
        name: exercise.name,
        movementPattern: exercise.movementPattern,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        currentWeightKg: exercise.currentWeightKg,
        weightIncrementKg: exercise.weightIncrementKg,
        targetRir: exercise.targetRir,
        actualRirAvg:
          actualRirValues.length > 0
            ? Math.round((actualRirValues.reduce((sum, value) => sum + value, 0) / actualRirValues.length) * 10) / 10
            : null,
        plannedRestSec: exercise.plannedRestSec,
        actualRestSec:
          actualRestValues.length > 0
            ? Math.round(actualRestValues.reduce((sum, value) => sum + value, 0) / actualRestValues.length)
            : null,
        plannedSets: exercise.plannedSetsPerExposure * sessions.length,
        performedSets: totalPerformedSets,
        performedReps: totalPerformedReps,
        performedVolume: Math.round(totalPerformedVolume),
        exposureCount: sessions.length,
        estimated1RM: estimated1RM != null ? Math.round(estimated1RM * 4) / 4 : null,
        sessions,
        hasEnoughHistory: sessions.length >= 2,
      }
    })
    .sort((a, b) => {
      const aHasHistory = a.exposureCount > 0 ? 1 : 0
      const bHasHistory = b.exposureCount > 0 ? 1 : 0
      if (aHasHistory !== bHasHistory) return bHasHistory - aHasHistory
      return b.performedVolume - a.performedVolume
    })

  const movementPatterns = Object.entries(movementPatternMap)
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.volume - a.volume)

  const weeklyEntries = Object.entries(weeklyMap).sort((a, b) => a[0].localeCompare(b[0]))
  const currentWeek = weeklyEntries[weeklyEntries.length - 1]?.[1] ?? { volume: 0, sets: 0, sessions: 0 }
  const previousWeek = weeklyEntries[weeklyEntries.length - 2]?.[1] ?? { volume: 0, sets: 0, sessions: 0 }

  const plannedSessionOccurrences = (() => {
    if (!activeProgram || programSessions.length === 0) return 0
    if ((activeProgram as any).session_mode === 'cycle') {
      const weeksSpan = Math.max(1, Math.ceil((startOfDay(now).getTime() - startOfDay(sinceDate).getTime()) / (7 * 86400000)))
      return ((activeProgram as any).frequency ?? programSessions.length) * weeksSpan
    }

    const scheduledDays = programSessions.map((session: any) =>
      (session.days_of_week ?? []).length > 0
        ? (session.days_of_week as number[])
        : session.day_of_week != null
          ? [session.day_of_week as number]
          : []
    )

    let occurrences = 0
    for (const date of daysBetweenInclusive(sinceDate, now)) {
      const jsDay = date.getDay()
      const dayOfWeek = jsDay === 0 ? 7 : jsDay
      for (const daysOfWeek of scheduledDays) {
        if (daysOfWeek.includes(dayOfWeek)) occurrences += 1
      }
    }
    return occurrences
  })()

  const plannedExerciseCount = programExercises.length
  const distinctPerformedProgramExercises = new Set(
    effectiveSets
      .map((set: any) => {
        const exercise =
          (set.exercise_id && programExerciseById.get(set.exercise_id)) ??
          programExerciseByCanonicalKey.get(resolveCanonicalExerciseKey(set.exercise_name ?? '')) ??
          programExerciseByName.get(normalizeText(set.exercise_name ?? ''))
        return exercise?.id ?? null
      })
      .filter(Boolean)
  ).size

  const loggedPlannedSessions = meaningfulLogs.filter(
    (log) => log.program_session_id && activeProgramSessionIds.has(log.program_session_id)
  )

  const completedPlannedSessions = loggedPlannedSessions.filter((log) => log.completed_at).length

  const plannedSets = keyExercises.reduce((sum, exercise) => sum + exercise.plannedSets, 0)
  const performedPlannedSets = keyExercises.reduce((sum, exercise) => sum + exercise.performedSets, 0)
  const plannedRestValues = keyExercises
    .map((exercise) => exercise.plannedRestSec)
    .filter((value): value is number => value != null && value > 0)
  const targetRirValues = keyExercises
    .map((exercise) => exercise.targetRir)
    .filter((value): value is number => value != null)
  const actualRirValues = keyExercises
    .map((exercise) => exercise.actualRirAvg)
    .filter((value): value is number => value != null)

  const missingDurationRate = totalSessions > 0 ? meaningfulLogs.filter((log) => !log.duration_min).length / totalSessions : 0
  const missingRirRate = effectiveSets.length > 0 ? effectiveSets.filter((set: any) => set.rir_actual == null).length / effectiveSets.length : 1
  const missingRestRate = effectiveSets.length > 0 ? effectiveSets.filter((set: any) => set.rest_sec_actual == null).length / effectiveSets.length : 1
  const exerciseHistoryCoverage = keyExercises.length > 0
    ? keyExercises.filter((exercise) => exercise.hasEnoughHistory).length / keyExercises.length
    : 0

  let confidenceScore = 100
  if (draftSessions > 0) confidenceScore -= Math.min(25, draftSessions * 5)
  if (completedSessions < 2) confidenceScore -= 30
  confidenceScore -= Math.round(missingDurationRate * 15)
  confidenceScore -= Math.round(missingRirRate * 20)
  confidenceScore -= Math.round(missingRestRate * 15)
  confidenceScore -= Math.round((1 - exerciseHistoryCoverage) * 20)
  confidenceScore = Math.max(0, Math.min(100, confidenceScore))

  const hasPartialData =
    completedSessions < 2 ||
    missingRirRate > 0.6 ||
    missingDurationRate > 0.5 ||
    exerciseHistoryCoverage < 0.35

  const rirDistributionBuckets = Array.from({ length: 7 }, (_, index) => ({
    label: index === 6 ? '6+' : `${index}`,
    count: 0,
  }))

  for (const set of effectiveSets) {
    const rir = (set as any).rir_actual as number | null
    if (rir == null || rir < 0) continue
    const bucketIndex = Math.min(6, Math.floor(rir))
    rirDistributionBuckets[bucketIndex].count += 1
  }

  return NextResponse.json({
    kpis: {
      totalSessions,
      completedSessions,
      totalSets,
      totalReps,
      totalVolume,
      avgDuration,
    },
    timeline: Object.values(timelineMap),
    muscleGroups: Object.entries(muscleMap).map(([name, value]) => ({ name, ...value })),
    movementPatterns,
    exercises,
    keyExercises,
    rpeTrend,
    draftSessions,
    latestSession,
    completionRate,
    avgRestSec,
    durationBuckets,
    adherence: {
      plannedSessions: plannedSessionOccurrences,
      loggedSessions: loggedPlannedSessions.length,
      completedPlannedSessions,
      sessionAdherenceRate:
        plannedSessionOccurrences > 0 ? completedPlannedSessions / plannedSessionOccurrences : null,
      plannedExercises: plannedExerciseCount,
      performedExercises: distinctPerformedProgramExercises,
      exerciseCoverageRate:
        plannedExerciseCount > 0 ? distinctPerformedProgramExercises / plannedExerciseCount : null,
    },
    prescriptionDrift: {
      plannedSets,
      effectiveSets: performedPlannedSets,
      setCompletionRate: plannedSets > 0 ? performedPlannedSets / plannedSets : null,
      avgPlannedRestSec:
        plannedRestValues.length > 0
          ? Math.round(plannedRestValues.reduce((sum, value) => sum + value, 0) / plannedRestValues.length)
          : null,
      avgActualRestSec: avgRestSec,
      restDeltaSec:
        plannedRestValues.length > 0 && avgRestSec != null
          ? avgRestSec - Math.round(plannedRestValues.reduce((sum, value) => sum + value, 0) / plannedRestValues.length)
          : null,
      avgTargetRir:
        targetRirValues.length > 0
          ? Math.round((targetRirValues.reduce((sum, value) => sum + value, 0) / targetRirValues.length) * 10) / 10
          : null,
      avgActualRir:
        actualRirValues.length > 0
          ? Math.round((actualRirValues.reduce((sum, value) => sum + value, 0) / actualRirValues.length) * 10) / 10
          : null,
      rirDelta:
        targetRirValues.length > 0 && actualRirValues.length > 0
          ? Math.round(
              (
                (actualRirValues.reduce((sum, value) => sum + value, 0) / actualRirValues.length) -
                (targetRirValues.reduce((sum, value) => sum + value, 0) / targetRirValues.length)
              ) * 10
            ) / 10
          : null,
    },
    weeklyComparisons: {
      currentWeekVolume: Math.round(currentWeek.volume),
      previousWeekVolume: Math.round(previousWeek.volume),
      currentWeekSets: currentWeek.sets,
      previousWeekSets: previousWeek.sets,
      currentWeekSessions: currentWeek.sessions,
      previousWeekSessions: previousWeek.sessions,
    },
    quality: {
      hasDrafts: draftSessions > 0,
      hasPartialData,
      missingDurationRate,
      missingRirRate,
      missingRestRate,
      exerciseHistoryCoverage,
      confidenceScore,
    },
    rirDistribution: rirDistributionBuckets,
    programContext: activeProgram
      ? {
          programId: (activeProgram as any).id,
          programName: (activeProgram as any).name,
          goal: (activeProgram as any).goal ?? null,
          level: (activeProgram as any).level ?? null,
          weeks: (activeProgram as any).weeks ?? null,
          frequency: (activeProgram as any).frequency ?? null,
          sessionMode: (activeProgram as any).session_mode ?? null,
        }
      : null,
    dataQuality: {
      hasPartialData,
      hasDrafts: draftSessions > 0,
    },
  })
}
