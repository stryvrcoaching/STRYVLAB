import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildTimeline, type TimelineSource } from '@/lib/client/smart/timelineBuilder'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { fetchClientDayOverride, resolveEffectiveDayKind } from '@/lib/client/day-kind'
import { buildTrainingWeekSchedule, normalizeProgramForSchedule, pickActiveProgramForSchedule } from '@/lib/nutrition/training-week-schedule'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function mealTypeLabel(t: string): string {
  switch (t) {
    case 'breakfast': return 'Petit-déjeuner'
    case 'lunch': return 'Déjeuner'
    case 'dinner': return 'Dîner'
    case 'snack': return 'Collation'
    default: return 'Repas'
  }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const timezone = await resolveClientTimezone(svc(), cc.id)
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  const date = dateParam ?? computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, timezone)
  const dayStart = physiologicalStart.toISOString()
  const dayEnd = physiologicalEnd.toISOString()

  const [mealsResult, waterResult, sessionResult, activitiesResult] = await Promise.allSettled([
    svc()
      .from('nutrition_meals')
      .select('id, meal_type, title, logged_at, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .eq('client_id', cc.id)
      .eq('physiological_date', date)
      .order('logged_at', { ascending: true }),
    svc()
      .from('client_water_logs')
      .select('logged_at, amount_ml')
      .eq('client_id', cc.id)
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd),
    svc()
      .from('client_session_logs')
      .select('id, completed_at, program_session_id')
      .eq('client_id', cc.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc()
      .from('client_activity_logs')
      .select('id, started_at, activity_type, custom_label, duration_min, intensity')
      .eq('client_id', cc.id)
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd),
  ])

  const meals = mealsResult.status === 'fulfilled' ? (mealsResult.value.data ?? []) : []
  const water = waterResult.status === 'fulfilled' ? (waterResult.value.data ?? []) : []
  const sessionRow = sessionResult.status === 'fulfilled' ? sessionResult.value.data : null
  const activities = activitiesResult.status === 'fulfilled' ? (activitiesResult.value.data ?? []) : []
  const [dayOverride, activeProgramsResult, skippedResult] = await Promise.all([
    fetchClientDayOverride(svc(), cc.id, date),
    svc()
      .from('programs')
      .select(`
        id, name, status, session_mode, is_client_visible, created_at,
        program_sessions (
          id, name, day_of_week, days_of_week, position,
          program_exercises ( id, name )
        )
      `)
      .eq('client_id', cc.id)
      .order('created_at', { ascending: false }),
    svc()
      .from('client_workout_skips')
      .select('id')
      .eq('client_id', cc.id)
      .eq('scheduled_date', date)
      .limit(1),
  ])
  const activeProgram = pickActiveProgramForSchedule((activeProgramsResult.data ?? []) as any)
  const trainingWeekSchedule = buildTrainingWeekSchedule(
    activeProgram ? normalizeProgramForSchedule(activeProgram as any) : null,
  )
  const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay()
  const dow = jsDay === 0 ? 7 : jsDay
  const weekdayKind = trainingWeekSchedule.days.find((d) => d.dow === dow)?.kind ?? null
  const dayKind = resolveEffectiveDayKind({
    weekdayKind,
    overrideKind: dayOverride?.kind ?? null,
  })
  const sessionSkipped = ((skippedResult.data ?? []) as any[]).length > 0

  let session: TimelineSource['session'] = null
  if (sessionRow) {
    // Get exercise count
    const { count } = await svc()
      .from('client_set_logs')
      .select('exercise_name', { count: 'exact', head: true })
      .eq('session_log_id', sessionRow.id)

    session = {
      id: sessionRow.id,
      completed_at: sessionRow.completed_at as string,
      title: 'Séance',
      duration_min: 0,
      exercises_count: count ?? 0,
    }
  }

  const src: TimelineSource = {
    meals: meals.map(m => ({
      id: m.id,
      logged_at: m.logged_at,
      title: m.title ?? mealTypeLabel(m.meal_type),
      meal_type: m.meal_type as any,
      kcal: computeMacroEnergy({
        protein_g: Number(m.total_protein_g ?? 0),
        carbs_g: Number(m.total_carbs_g ?? 0),
        fat_g: Number(m.total_fat_g ?? 0),
        fiber_g: Number(m.total_fiber_g ?? 0),
      }),
      protein_g: Number(m.total_protein_g ?? 0),
      carbs_g: Number(m.total_carbs_g ?? 0),
      fat_g: Number(m.total_fat_g ?? 0),
    })),
    waterLogs: water.map(w => ({ logged_at: w.logged_at, amount_ml: Number(w.amount_ml ?? 0) })),
    session,
    activities: activities.map(a => ({
      id: a.id,
      started_at: a.started_at,
      activity_type: a.activity_type as any,
      custom_label: a.custom_label,
      duration_min: a.duration_min,
      intensity: a.intensity,
    })),
    checkins: [],
  }

  const entries = buildTimeline(src)
  return NextResponse.json({ date, entries, dayKind, sessionSkipped, dayOverride })
}
