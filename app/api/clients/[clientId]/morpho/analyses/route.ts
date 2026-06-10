// GET /api/clients/[clientId]/morpho/analyses
// Timeline paginée des analyses morphologiques (coach uniquement)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
  offset: z.coerce.number().int().nonnegative().default(0),
})

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  // Coach uniquement pour la timeline
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams)
  )
  if (!query.success) {
    return NextResponse.json({ error: query.error.message }, { status: 400 })
  }

  const { limit, offset } = query.data

  const { data: analyses, error, count } = await db
    .from('morpho_analyses')
    .select(
      'id, analysis_date, status, photo_ids, analysis_result, biomech_profile, prompt_version, stimulus_adjustments, body_composition, asymmetries, error_message',
      { count: 'exact' }
    )
    .eq('client_id', params.clientId)
    .order('analysis_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
  }

  return NextResponse.json({
    analyses: analyses ?? [],
    total_count: count ?? 0,
    limit,
    offset,
  })
}
