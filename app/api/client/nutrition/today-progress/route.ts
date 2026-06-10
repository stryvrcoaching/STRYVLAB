import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/nutrition/today-progress
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const db = service()
  const timezone = await resolveClientTimezone(db, cc.id)
  const today = computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(today, timezone)

  const [{ data: protocol }, { data: composerMeals }, { data: legacyMeals }] = await Promise.all([
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
      .eq('physiological_date', today),
    // Legacy AI meals — lower confidence (0.55), fallback
    db.from('meal_logs')
      .select('estimated_macros, ai_status')
      .eq('client_id', cc.id)
      .gte('logged_at', physiologicalStart.toISOString())
      .lt('logged_at', new Date(physiologicalEnd.getTime() + 1).toISOString())
      .eq('ai_status', 'done'),
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
  }

  const days = (protocol as any)?.nutrition_protocol_days ?? []
  const slots = (protocol as any)?.nutrition_protocol_schedule_slots ?? []
  const targetDay = resolveProtocolDayByDate(
    today,
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

  return NextResponse.json({
    consumed,
    target,
    hasProtocol: !!protocol,
    mealCount: (composerMeals ?? []).length + (legacyMeals ?? []).length,
  })
}
