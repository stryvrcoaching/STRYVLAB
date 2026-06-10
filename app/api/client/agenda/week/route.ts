import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/agenda/week?start=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const start = url.searchParams.get('start') ?? new Date().toISOString().split('T')[0]
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const end = endDate.toISOString().split('T')[0]

  const { data, error } = await service()
    .from('smart_agenda_events')
    .select('event_date, event_type')
    .eq('client_id', cc.id)
    .gte('event_date', start)
    .lte('event_date', end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const density: Record<string, Record<string, number>> = {}
  for (const row of data ?? []) {
    if (!density[row.event_date]) density[row.event_date] = { total: 0 }
    density[row.event_date][row.event_type] = (density[row.event_date][row.event_type] ?? 0) + 1
    density[row.event_date].total += 1
  }

  return NextResponse.json({ density, start, end })
}
