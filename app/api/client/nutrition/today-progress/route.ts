import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { fetchActiveSmoothingPlanDaysForDates } from '@/lib/nutrition/smoothing/fetch'
import { applySmoothingOverlay } from '@/lib/nutrition/smoothing/apply-overlay'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function parseRequestedDate(req: NextRequest) {
  const value = req.nextUrl.searchParams.get('date')?.trim()
  if (!value) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

// GET /api/client/nutrition/today-progress
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, timezone')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const timezone = String(cc.timezone ?? '').trim() || await resolveClientTimezone(db, cc.id)
  const physiologicalDate = parseRequestedDate(req) ?? computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(physiologicalDate, timezone)

  const [{ data: protocol }, { data: composerMeals }, { data: legacyMeals }, { data: waterLogs }] = await Promise.all([
    db.from('nutrition_protocols')
      .select('id, schedule_start_date, nutrition_protocol_days(*), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', cc.id)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Composer meals — high confidence (0.85)
    db.from('nutrition_meals')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('client_id', cc.id)
      .eq('physiological_date', physiologicalDate),
    // Legacy AI meals — lower confidence (0.55), fallback
    db.from('meal_logs')
      .select('estimated_macros, ai_status')
      .eq('client_id', cc.id)
      .gte('logged_at', physiologicalStart.toISOString())
      .lt('logged_at', new Date(physiologicalEnd.getTime() + 1).toISOString())
      .eq('ai_status', 'done'),
    db.from('client_water_logs')
      .select('amount_ml, caffeine_mg')
      .eq('client_id', cc.id)
      .gte('logged_at', physiologicalStart.toISOString())
      .lte('logged_at', physiologicalEnd.toISOString()),
  ])

  const fromComposer = (composerMeals ?? []).reduce(
    (acc, m: any) => ({
      calories:  acc.calories  + computeMacroEnergy({
        protein_g: Number(m.total_protein_g ?? 0),
        carbs_g: Number(m.total_carbs_g ?? 0),
        fat_g: Number(m.total_fat_g ?? 0),
      }),
      protein_g: acc.protein_g + (Number(m.total_protein_g) || 0),
      carbs_g:   acc.carbs_g   + (Number(m.total_carbs_g)   || 0),
      fat_g:     acc.fat_g     + (Number(m.total_fat_g)     || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  const fromLegacy = (legacyMeals ?? []).reduce(
    (acc, m: any) => {
      const em = m.estimated_macros as Record<string, number> | null
      if (!em) return acc
      return {
        calories:  acc.calories  + computeMacroEnergy({
          protein_g: Number(em.protein_g ?? 0),
          carbs_g: Number(em.carbs_g ?? 0),
          fat_g: Number(em.fats_g ?? em.fat_g ?? 0),
        }),
        protein_g: acc.protein_g + (em.protein_g ?? 0),
        carbs_g:   acc.carbs_g   + (em.carbs_g ?? 0),
        fat_g:     acc.fat_g     + (em.fats_g ?? em.fat_g ?? 0),
      }
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  const consumed = {
    calories:  fromComposer.calories  + fromLegacy.calories,
    protein_g: fromComposer.protein_g + fromLegacy.protein_g,
    carbs_g:   fromComposer.carbs_g   + fromLegacy.carbs_g,
    fat_g:     fromComposer.fat_g     + fromLegacy.fat_g,
    water_ml: (waterLogs ?? []).reduce((s, w: any) => s + Number(w.amount_ml ?? 0), 0),
    caffeine_mg: (waterLogs ?? []).reduce((s, w: any) => s + Number(w.caffeine_mg ?? 0), 0),
  }

  const days = (protocol as any)?.nutrition_protocol_days ?? []
  const slots = (protocol as any)?.nutrition_protocol_schedule_slots ?? []
  const targetDay = resolveProtocolDayByDate(
    physiologicalDate,
    (protocol as any)?.schedule_start_date ?? null,
    days,
    slots,
  )

  const target = targetDay
    ? {
        calories:  Number(targetDay.calories  ?? 0),
        protein_g: Number(targetDay.protein_g ?? 0),
        carbs_g:   Number(targetDay.carbs_g   ?? 0),
        fat_g:     Number(targetDay.fat_g     ?? 0),
      }
    : null
  const smoothingDays = await fetchActiveSmoothingPlanDaysForDates(db, cc.id, [physiologicalDate])
  const finalTarget = target && smoothingDays.length > 0
    ? (() => {
        const { target: adjustedTarget } = applySmoothingOverlay({
          kcal: target.calories,
          protein_g: target.protein_g,
          carbs_g: target.carbs_g,
          fat_g: target.fat_g,
          water_ml: 0,
        }, smoothingDays)
        return {
          calories: adjustedTarget.kcal,
          protein_g: adjustedTarget.protein_g,
          carbs_g: adjustedTarget.carbs_g,
          fat_g: adjustedTarget.fat_g,
        }
      })()
    : target

  return NextResponse.json({
    date: physiologicalDate,
    consumed,
    target: finalTarget,
    hasProtocol: !!protocol,
    mealCount: (composerMeals ?? []).length + (legacyMeals ?? []).length,
  })
}
