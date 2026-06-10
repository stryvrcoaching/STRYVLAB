export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { shiftIsoDate } from '@/lib/utils/date'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = await params
  const db = svc()

  const { data: ownedClient, error: clientError } = await db
    .from('coach_clients')
    .select('id, timezone')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
  if (!ownedClient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const timezone = await resolveClientTimezone(db, clientId)
  const todayDate = computePhysiologicalDate(new Date(), timezone)
  // Return preps for today + next 3 days
  const dates = [0, 1, 2, 3].map(d => shiftIsoDate(todayDate, d))

  const { data, error } = await db
    .from('client_nutrition_preps')
    .select('id, physiological_date, title, meal_type, meal_slot, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, planned_for, created_at')
    .eq('client_id', clientId)
    .in('physiological_date', dates)
    .in('status', ['planned', 'logged'])
    .order('physiological_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const todayIso = todayDate
  const grouped = dates.map(date => ({
    date,
    isToday: date === todayIso,
    preps: (data ?? []).filter(p => p.physiological_date === date),
  }))

  return NextResponse.json({ data: grouped, today: todayIso })
}
