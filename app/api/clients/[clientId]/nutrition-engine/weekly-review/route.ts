import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { analyzeWeek } from '@/lib/nutrition/engine/weeklyAnalysis'
import type { WeeklyCheckinSummary } from '@/lib/nutrition/engine/types'
import { buildNutritionDataQualitySummary } from '@/lib/nutrition/dataQuality'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1)
  d.setUTCDate(diff)
  return d.toISOString().slice(0, 10)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()

  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const today = new Date()
  const weekStart = getWeekStart(today)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const startDate = sevenDaysAgo.toISOString().slice(0, 10)
  const prevStart = new Date(sevenDaysAgo)
  prevStart.setDate(prevStart.getDate() - 7)

  const [{ data: checkins }, { data: prevCheckins }, { data: mealDays }] =
    await Promise.all([
      db
        .from('client_daily_checkins')
        .select('date, flow_type, sleep_hours, energy_level, stress_level, weight_kg, hunger_level, muscle_soreness')
        .eq('client_id', params.clientId)
        .gte('date', startDate)
        .order('date', { ascending: true }),
      db
        .from('client_daily_checkins')
        .select('weight_kg')
        .eq('client_id', params.clientId)
        .gte('date', prevStart.toISOString().slice(0, 10))
        .lt('date', startDate)
        .not('weight_kg', 'is', null),
      db
        .from('nutrition_meals')
        .select('physiological_date')
        .eq('client_id', params.clientId)
        .gte('physiological_date', startDate),
    ])

  const rows = checkins ?? []
  const morningRows = rows.filter(r => r.flow_type === 'morning')
  const eveningRows = rows.filter(r => r.flow_type === 'evening')

  const weightSamples = morningRows.filter(r => r.weight_kg !== null)
  const avgWeightKg =
    weightSamples.length > 0
      ? weightSamples.reduce((s, r) => s + Number(r.weight_kg), 0) / weightSamples.length
      : null
  const prevWeights = (prevCheckins ?? []).filter(r => r.weight_kg !== null)
  const prevWeekAvgWeightKg =
    prevWeights.length > 0
      ? prevWeights.reduce((s, r) => s + Number(r.weight_kg), 0) / prevWeights.length
      : null

  const avg = (arr: (number | null)[]): number | null => {
    const vals = arr.filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  const avgEnergyLevel = avg(morningRows.map(r => r.energy_level))
  const avgSleepH = avg(
    morningRows.map(r => (r.sleep_hours !== null ? Number(r.sleep_hours) : null)),
  )
  const avgStressLevel = avg(morningRows.map(r => r.stress_level))
  const avgHungerLevel = avg(eveningRows.map(r => r.hunger_level))
  const avgMuscleSoreness = avg(eveningRows.map(r => r.muscle_soreness))

  const uniqueMealDays = new Set((mealDays ?? []).map(m => m.physiological_date)).size
  const adherencePct = uniqueMealDays / 7
  const latestWeight = weightSamples.length > 0 ? Number(weightSamples[weightSamples.length - 1].weight_kg) : null
  const qualitySummary = buildNutritionDataQualitySummary({
    clientData: {
      id: params.clientId,
      name: '',
      gender: null,
      age: null,
      height_cm: null,
      weight_kg: latestWeight,
      body_fat_pct: null,
      muscle_mass_kg: null,
      lean_mass_kg: null,
      bmr_kcal_measured: null,
      visceral_fat_level: null,
      weekly_frequency: null,
      training_goal: null,
      sport_practice: null,
      session_duration_min: null,
      training_calories_weekly: null,
      cardio_frequency: null,
      cardio_duration_min: null,
      daily_steps: null,
      stress_level: avgStressLevel,
      sleep_duration_h: avgSleepH,
      sleep_quality: null,
      energy_level: avgEnergyLevel,
      caffeine_daily_mg: null,
      alcohol_weekly: null,
      work_hours_per_week: null,
      menstrual_cycle: null,
      occupation: null,
      occupation_multiplier: null,
    },
    dataMode: 'realtime',
    dataSource: {
      weight_kg: 'selected',
      sleep_duration_h: 'selected',
      stress_level: 'selected',
      energy_level: 'selected',
    },
  })

  let consecutiveFatigueDays = 0
  let streak = 0
  for (const row of morningRows) {
    const isFatigue =
      (row.energy_level !== null && row.energy_level <= 2) ||
      (row.sleep_hours !== null && Number(row.sleep_hours) < 6) ||
      (row.stress_level !== null && row.stress_level >= 4)
    if (isFatigue) {
      streak++
      consecutiveFatigueDays = Math.max(consecutiveFatigueDays, streak)
    } else {
      streak = 0
    }
  }

  const summary: WeeklyCheckinSummary = {
    weightSamples: weightSamples.length,
    avgWeightKg: avgWeightKg !== null ? Math.round(avgWeightKg * 10) / 10 : null,
    prevWeekAvgWeightKg:
      prevWeekAvgWeightKg !== null ? Math.round(prevWeekAvgWeightKg * 10) / 10 : null,
    waistMeasurements: 0,
    waistTrend: null,
    avgEnergyLevel,
    avgSleepH,
    avgStressLevel,
    avgHungerLevel,
    avgMuscleSoreness,
    adherencePct,
    performanceTrend: null,
    consecutiveFatigueDays,
    dataQualityScore: qualitySummary?.score ?? null,
    dataQualityNotes: qualitySummary?.notes ?? [],
  }

  const result = analyzeWeek(summary)

  await db.from('nutrition_weekly_reviews').upsert(
    {
      client_id: params.clientId,
      week_start: weekStart,
      weight_avg_kg: avgWeightKg,
      weight_delta_kg:
        avgWeightKg !== null && prevWeekAvgWeightKg !== null
          ? Math.round((avgWeightKg - prevWeekAvgWeightKg) * 100) / 100
          : null,
      adherence_pct: adherencePct,
      avg_energy: avgEnergyLevel,
      avg_sleep_h: avgSleepH,
      avg_stress: avgStressLevel,
      avg_hunger: avgHungerLevel,
      perf_trend: null,
      diagnosis: result.diagnosis,
      action: result.action,
      carb_adjustment_pct: result.carbAdjustmentPct,
      guardrail_triggered: result.guardrailTriggered,
      reasoning: result.reasoning,
      raw_data: summary,
    },
    { onConflict: 'client_id,week_start' },
  )

  return NextResponse.json({ result, summary })
}
