// GET /api/clients/[clientId]/morpho/latest
// Retourne la dernière analyse morphologique complète (coach ou client authentifié)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  // Vérifier accès : coach owner ou client lui-même
  const { data: coachAccess } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!coachAccess) {
    const { data: clientAccess } = await db
      .from('coach_clients')
      .select('id')
      .eq('id', params.clientId)
      .eq('user_id', user.id)
      .single()

    if (!clientAccess) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
  }

  const { data: latest } = await db
    .from('morpho_analyses')
    .select(
      'id, client_id, analysis_date, status, body_composition, dimensions, asymmetries, stimulus_adjustments'
    )
    .eq('client_id', params.clientId)
    .eq('status', 'completed')
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ data: latest ?? null })
}
