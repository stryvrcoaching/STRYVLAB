/**
 * GET /api/client/appointments?scope=upcoming|history
 *
 * Retourne les rendez-vous du client connecté.
 * Les notes privées du coach ne sont jamais exposées.
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

/** Colonnes exposées au client — jamais coach_private_notes */
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

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  // Résolution du client lié à l'utilisateur connecté
  const { data: clientRow, error: clientErr } = await db
    .from('coach_clients')
    .select('id, coach_id, first_name, last_name')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (clientErr || !clientRow) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const scope = new URL(req.url).searchParams.get('scope') ?? 'upcoming'
  const now = new Date().toISOString()

  let query = db
    .from('coaching_appointments')
    .select(CLIENT_COLUMNS)
    .eq('client_id', clientRow.id)
    .not('status', 'in', '("cancelled")')
    .order('starts_at', { ascending: scope !== 'history' })

  if (scope === 'upcoming') {
    query = query.gte('starts_at', now).limit(20)
  } else {
    // Historique : passés + completed/no_show
    query = query.lt('starts_at', now).limit(50)
  }

  const { data, error } = await query
  if (error) {
    console.error('[client/appointments] list error', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }

  // Enrichit avec le nom du coach
  const { data: coachProfile } = await db
    .from('coach_profiles')
    .select('full_name, brand_name')
    .eq('coach_id', clientRow.coach_id)
    .maybeSingle()

  const coach_name = coachProfile
    ? (coachProfile.full_name || coachProfile.brand_name || 'Votre coach')
    : 'Votre coach'

  return NextResponse.json(
    (data ?? []).map((appt) => ({ ...appt, coach_name })),
  )
}
