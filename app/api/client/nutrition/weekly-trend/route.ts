import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const numDays = Math.min(90, Math.max(7, parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)))

  const today = new Date()
  const days: string[] = []
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const { data: proto } = await svc()
    .from('nutrition_protocols')
    .select('schedule_start_date, nutrition_protocol_days(position, calories), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .limit(1)
    .maybeSingle()

  const { data: meals } = await svc()
    .from('nutrition_meals')
    .select('physiological_date, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
    .eq('client_id', cc.id)
    .in('physiological_date', days)

  const totals: Record<string, number> = {}
  for (const d of days) totals[d] = 0
  for (const m of meals ?? []) {
    totals[m.physiological_date] =
      (totals[m.physiological_date] ?? 0) +
      computeMacroEnergy({
        protein_g: Number(m.total_protein_g ?? 0),
        carbs_g: Number(m.total_carbs_g ?? 0),
        fat_g: Number(m.total_fat_g ?? 0),
        fiber_g: Number(m.total_fiber_g ?? 0),
      })
  }

  const trend = days.map((d) => {
    const day = resolveProtocolDayByDate(
      d,
      (proto as any)?.schedule_start_date ?? null,
      (proto?.nutrition_protocol_days as any) ?? [],
      (proto?.nutrition_protocol_schedule_slots as any) ?? [],
    )
    const target = Number((day as any)?.calories ?? 2400)
    return { date: d, consumed: totals[d], target }
  })
  return NextResponse.json({ trend })
}
