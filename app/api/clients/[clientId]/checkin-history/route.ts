import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/clients/[clientId]/checkin-history?page=0&limit=30&date=YYYY-MM-DD
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ownership } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()
  if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10), 100)
  const dateFilter = url.searchParams.get('date') // YYYY-MM-DD

  let query = service()
    .from('client_daily_checkins')
    .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, hunger_level, weight_kg, rhr_morning, daily_steps', { count: 'exact' })
    .eq('client_id', params.clientId)
    .order('date', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (dateFilter) {
    query = query
      .eq('date', dateFilter)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = (data ?? []).map((r: any) => {
    const isMorning = r.flow_type === 'morning'
    const responses: Record<string, number> = {}
    if (r.energy_level != null) responses.energy = Number(r.energy_level)
    if (isMorning) {
      if (r.sleep_hours != null) responses.sleep_duration = Number(r.sleep_hours)
      if (r.sleep_quality != null) responses.sleep_quality = Number(r.sleep_quality)
      if (r.rhr_morning != null) responses.rhr_morning = Number(r.rhr_morning)
      if (r.weight_kg != null) responses.weight_kg = Number(r.weight_kg)
    } else {
      if (r.stress_level != null) responses.stress = Number(r.stress_level)
      if (r.hunger_level != null) responses.hunger = Number(r.hunger_level)
      if (r.muscle_soreness != null) responses.muscle_soreness = Number(r.muscle_soreness)
    }
    // Common to both moments
    if (r.daily_steps != null) responses.daily_steps = Number(r.daily_steps)
    return {
      moment: isMorning ? 'morning' : 'evening',
      responses,
      responded_at: `${r.date}T12:00:00.000Z`,
      is_late: false,
    }
  })

  return NextResponse.json({
    data: mapped,
    total: count ?? 0,
    page,
    limit,
  })
}
