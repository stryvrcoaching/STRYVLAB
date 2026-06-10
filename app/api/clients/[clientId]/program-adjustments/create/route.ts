// POST /api/clients/[clientId]/program-adjustments/create
// Crée un proposal d'ajustement programme (coach authentifié)
// Utilisé par PerformanceFeedbackPanel avant d'approuver/rejeter

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

const createSchema = z.object({
  exercise_id: z.string().uuid().nullable().optional(),
  program_id: z.string().uuid().nullable().optional(),
  type: z.enum(['increase_volume', 'decrease_volume', 'increase_weight', 'swap_exercise', 'add_rest_day']),
  reason: z.string().min(1).max(2000),
  proposed_value: z.record(z.string(), z.unknown()).default({}),
  current_value: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  // Ownership check
  const { data: coachAccess } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!coachAccess) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { exercise_id, program_id, type, reason, proposed_value, current_value } = parsed.data

  const { data: proposal, error } = await db
    .from('program_adjustment_proposals')
    .insert({
      client_id: params.clientId,
      exercise_id: exercise_id ?? null,
      program_id: program_id ?? null,
      type,
      reason,
      proposed_value,
      current_value,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[program-adjustments/create] insert error', error)
    return NextResponse.json({ error: 'Erreur création proposal' }, { status: 500 })
  }

  return NextResponse.json({ data: proposal }, { status: 201 })
}
