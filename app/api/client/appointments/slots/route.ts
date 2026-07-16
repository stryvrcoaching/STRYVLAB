import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCoachAvailableSlots } from '@/lib/appointments/availability-engine'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateKey = searchParams.get('date')

  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return NextResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD)' }, { status: 400 })
  }

  const db = service()

  // Résout le client
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, coach_id, timezone')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Client not found or inactive' }, { status: 404 })
  }

  try {
    const slots = await getCoachAvailableSlots(
      db,
      clientRow.coach_id,
      dateKey,
      30, // 30 minutes par défaut
      clientRow.timezone || 'Europe/Paris'
    )

    return NextResponse.json(slots)
  } catch (err) {
    console.error('[client/appointments/slots] error', err)
    return NextResponse.json({ error: 'Failed to calculate slots' }, { status: 500 })
  }
}
