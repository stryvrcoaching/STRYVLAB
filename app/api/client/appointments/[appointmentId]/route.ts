/**
 * GET  /api/client/appointments/[appointmentId]
 * POST /api/client/appointments/[appointmentId]/respond  → fichier séparé
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const CLIENT_COLUMNS = [
  'id',
  'client_id',
  'title',
  'starts_at',
  'ends_at',
  'client_timezone',
  'meeting_kind',
  'meeting_url',
  'client_message',
  'confirmation_required',
  'status',
  'reschedule_reason',
  'responded_at',
  'cancelled_at',
  'cancel_reason',
  'completed_at',
  'created_at',
  'updated_at',
].join(', ')

type RouteContext = { params: { appointmentId: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  // Résolution du client lié à l'utilisateur
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, coach_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await db
    .from('coaching_appointments')
    .select(CLIENT_COLUMNS)
    .eq('id', params.appointmentId)
    .eq('client_id', clientRow.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Nom du coach
  const { data: coachProfile } = await db
    .from('coach_profiles')
    .select('full_name, brand_name')
    .eq('coach_id', clientRow.coach_id)
    .maybeSingle()

  const coach_name = coachProfile
    ? (coachProfile.full_name || coachProfile.brand_name || 'Votre coach')
    : 'Votre coach'

  return NextResponse.json({ ...data, coach_name })
}
