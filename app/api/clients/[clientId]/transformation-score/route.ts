import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  computeTransformationScore,
  type TrainingGoal,
  type DimensionWeights,
  type CheckinSummaryInput,
  type PerformanceSummaryInput,
  type BodyDataInput,
} from '@/lib/coach/transformationScore'
import {
  resolveTransformationPhase,
  transformationPhaseToTrainingGoalProfile,
} from '@/lib/coach/transformationPhase'
import {
  analyzeExercisePerformance,
  type OverloadEvent,
  type SessionPerf,
  type SetLogEntry,
} from '@/lib/performance/analyzer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  window: z.coerce.number().refine((v): v is 7 | 30 => v === 7 || v === 30, 'must be 7 or 30').default(7),
})

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  const { data: clientData } = await db
    .from('coach_clients')
    .select('id, transformation_phase, training_goal, weekly_frequency, score_weights_config, gender')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ window: url.searchParams.get('window') ?? 7 })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const win = parsed.data.window

  const trainingGoal = transformationPhaseToTrainingGoalProfile(
    resolveTransformationPhase({
      transformationPhase: clientData.transformation_phase,
      trainingGoal: clientData.training_goal,
    }),
  ) as TrainingGoal
  const weeklyFrequency = Number(clientData.weekly_frequency ?? 3)
  const weightsOverride = (clientData.score_weights_config ?? null) as DimensionWeights | null

  const periodStart = new Date(Date.now() - win * 86400000).toISOString()
  const periodStartDate = periodStart.slice(0, 10)

  const [checkinRes, sessionRes, progressionRes, metricsRes, configRes] = await Promise.all([
    db.from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, hunger_level')
      .eq('client_id', params.clientId)
      .gte('date', periodStartDate)
      .order('date', { ascending: true }),

    db.from('client_session_logs')
      .select('id, completed_at, client_set_logs(exercise_id, set_number, actual_reps, completed, rir_actual)')
      .eq('client_id', params.clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', periodStart),

    db.from('progression_events')
      .select('exercise_id, created_at, trigger_type')
      .eq('client_id', params.clientId)
      .gte('created_at', periodStart),

    db.from('assessment_submissions')
      .select('submitted_at, bilan_date, assessment_responses(field_key, value_number)')
      .eq('client_id', params.clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(20),

    db.from('daily_checkin_configs')
      .select('days_of_week')
      .eq('client_id', params.clientId)
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  // ── Build checkin input ──────────────────────────────────────────────────────
  const checkinRows = (checkinRes.data ?? []) as any[]
  const fieldSums: Record<string, { sum: number; count: number }> = {}
  const uniqueDays = new Set<string>()

  for (const r of checkinRows) {
    uniqueDays.add(r.date as string)
    const isMorning = r.flow_type === 'morning'
    const fields: Record<string, number | null> = {
      energy: r.energy_level,
      ...(isMorning
        ? { sleep_duration: r.sleep_hours, sleep_quality: r.sleep_quality }
        : { stress: r.stress_level, muscle_soreness: r.muscle_soreness }),
    }
    for (const [k, v] of Object.entries(fields)) {
      if (v == null) continue
      if (!fieldSums[k]) fieldSums[k] = { sum: 0, count: 0 }
      fieldSums[k].sum += Number(v)
      fieldSums[k].count += 1
    }
  }

  const fieldAverages: Record<string, number> = {}
  for (const [k, { sum, count }] of Object.entries(fieldSums)) {
    fieldAverages[k] = Math.round((sum / count) * 10) / 10
  }

  let configuredDays = 0
  const daysOfWeek: number[] = configRes.data?.days_of_week ?? []
  if (daysOfWeek.length > 0) {
    for (let i = 0; i < win; i++) {
      const d = new Date(Date.now() - i * 86400000)
      const jsDay = d.getDay()
      const day = jsDay === 0 ? 6 : jsDay - 1
      if (daysOfWeek.includes(day)) configuredDays++
    }
  }

  const responseRate = configuredDays > 0
    ? Math.round((uniqueDays.size / configuredDays) * 100)
    : null

  const checkin: CheckinSummaryInput = {
    field_averages: {
      energy: fieldAverages.energy,
      sleep_duration: fieldAverages.sleep_duration,
      sleep_quality: fieldAverages.sleep_quality,
      stress: fieldAverages.stress,
      muscle_soreness: fieldAverages.muscle_soreness,
    },
    response_rate: responseRate,
    configured_days_count: configuredDays,
  }

  // ── Build performance input ──────────────────────────────────────────────────
  const sessionLogs = (sessionRes.data ?? []) as any[]
  const sessionsCount = sessionLogs.length
  const progressionEvents = (progressionRes.data ?? []) as any[]

  const performanceSessions: SessionPerf[] = sessionLogs.map((session: any) => ({
    session_log_id: session.id,
    logged_at: session.completed_at as string,
    sets: ((session.client_set_logs ?? []) as any[])
      .filter((set: any) => Boolean(set.exercise_id))
      .map((set: any): SetLogEntry => ({
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_id,
        set_number: set.set_number ?? 1,
        actual_reps: set.actual_reps ?? null,
        completed: set.completed === true,
        rir_actual: set.rir_actual ?? null,
      })),
  }))

  const overloadEvents: OverloadEvent[] = progressionEvents.map((event: any) => ({
    exercise_id: event.exercise_id,
    exercise_name: event.exercise_id,
    created_at: event.created_at,
    trigger_type: event.trigger_type === 'overload' ? 'overload' : 'maintain',
  }))

  const analysis = analyzeExercisePerformance(
    performanceSessions,
    overloadEvents,
    Math.max(4, Math.ceil(win / 7)),
  )

  const exercises = analysis.exercises.map((summary) => ({
    completion_rate: summary.completion_rate,
    avg_rir: summary.avg_rir,
    overloads_last_4_weeks: summary.overloads_last_4_weeks,
    stagnation: summary.stagnation,
    overreaching: summary.overreaching,
  }))

  const performance: PerformanceSummaryInput = {
    analysis: {
      exercises,
      global_overreaching: analysis.global_overreaching,
    },
    sessionsCount,
    weeklyFrequency,
  }

  // ── Build body data input ────────────────────────────────────────────────────
  const submissions = (metricsRes.data ?? []) as any[]
  const weightSeries: { date: string; value: number }[] = []
  const bodyFatSeries: { date: string; value: number }[] = []
  const leanMassSeries: { date: string; value: number }[] = []

  for (const sub of submissions) {
    const rawDate: string = sub.bilan_date ?? sub.submitted_at ?? ''
    const date = rawDate.split('T')[0]
    if (!date) continue
    const responses = (sub.assessment_responses ?? []) as { field_key: string; value_number: number | null }[]
    for (const r of responses) {
      if (r.value_number == null) continue
      if (r.field_key === 'weight_kg')     weightSeries.push({ date, value: r.value_number })
      if (r.field_key === 'body_fat_pct') bodyFatSeries.push({ date, value: r.value_number })
      if (r.field_key === 'lean_mass_kg') leanMassSeries.push({ date, value: r.value_number })
    }
  }

  const latestBodyFat = bodyFatSeries.length > 0
    ? bodyFatSeries[bodyFatSeries.length - 1].value
    : null

  const bodyData: BodyDataInput = {
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    trainingGoal,
  }

  const result = computeTransformationScore({
    trainingGoal,
    window: win,
    checkin,
    performance,
    bodyData,
    weightsOverride,
    gender: (clientData.gender ?? null) as string | null,
    latestBodyFat,
  })

  // ── Metric cards data ────────────────────────────────────────────────────────
  // Average weight over window (from weightSeries filtered to window)
  const windowStart = periodStartDate
  const weightInWindow = weightSeries.filter(w => w.date >= windowStart)
  const avgWeight = weightInWindow.length > 0
    ? Math.round((weightInWindow.reduce((s, w) => s + w.value, 0) / weightInWindow.length) * 10) / 10
    : (weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : null)

  // Sleep: avg of sleep_quality × 10 combined with sleep_duration normalized (8h = 100)
  const sleepQuality = checkin.field_averages.sleep_quality   // 1–5 scale
  const sleepDuration = checkin.field_averages.sleep_duration // hours
  const sleepScore = sleepQuality != null && sleepDuration != null
    ? Math.round(((sleepQuality / 5) * 0.6 + Math.min(sleepDuration / 8, 1) * 0.4) * 100)
    : sleepQuality != null
      ? Math.round((sleepQuality / 5) * 100)
      : null

  // Performance: completion rate avg across all exercises in window
  const perfExercises = performance.analysis.exercises
  const avgPerformance = perfExercises.length > 0
    ? Math.round(perfExercises.reduce((s, e) => s + e.completion_rate, 0) / perfExercises.length * 100)
    : null

  const metricCards = {
    avgWeight,
    avgWeightDataPoints: weightInWindow.length,
    sleepScore,
    sleepQualityAvg: sleepQuality != null ? Math.round(sleepQuality * 10) / 10 : null,
    sleepDurationAvg: sleepDuration != null ? Math.round(sleepDuration * 10) / 10 : null,
    avgPerformance,
    sessionsCount: performance.sessionsCount,
  }

  return NextResponse.json({ ...result, metricCards })
}
