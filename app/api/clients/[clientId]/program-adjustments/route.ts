// GET  /api/clients/[clientId]/program-adjustments — liste les proposals pending
// POST /api/clients/[clientId]/program-adjustments — approuve ou rejette un proposal

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

const actionSchema = z.object({
  proposal_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  coach_notes: z.string().max(1000).optional(),
})

// ─── GET — proposals pending ──────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
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

  const { data: proposals, error } = await db
    .from('program_adjustment_proposals')
    .select('*')
    .eq('client_id', params.clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[program-adjustments] GET error', error)
    return NextResponse.json({ error: 'Erreur lecture proposals' }, { status: 500 })
  }

  return NextResponse.json({ data: proposals ?? [] })
}

// ─── POST — approve / reject ──────────────────────────────────────────────────

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

  // Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { proposal_id, action, coach_notes } = parsed.data

  // Charger le proposal
  const { data: proposal, error: proposalError } = await db
    .from('program_adjustment_proposals')
    .select('*')
    .eq('id', proposal_id)
    .eq('client_id', params.clientId)
    .eq('status', 'pending')
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal introuvable ou déjà traité' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (action === 'reject') {
    const { error: updateError } = await db
      .from('program_adjustment_proposals')
      .update({ status: 'rejected', reviewed_at: now, coach_notes: coach_notes ?? null })
      .eq('id', proposal_id)

    if (updateError) {
      console.error('[program-adjustments] reject error', updateError)
      return NextResponse.json({ error: 'Erreur mise à jour proposal' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: 'rejected' })
  }

  // --- APPROVE ---
  // Appliquer le changement selon le type
  const applyError = await applyProposal(proposal)
  if (applyError) {
    console.error('[program-adjustments] apply error', applyError)
    return NextResponse.json({ error: 'Erreur application du changement: ' + applyError }, { status: 500 })
  }

  const { error: updateError } = await db
    .from('program_adjustment_proposals')
    .update({ status: 'approved', reviewed_at: now, coach_notes: coach_notes ?? null })
    .eq('id', proposal_id)

  if (updateError) {
    console.error('[program-adjustments] approve update error', updateError)
    return NextResponse.json({ error: 'Erreur mise à jour proposal' }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: 'approved' })
}

// ─── Apply logic ──────────────────────────────────────────────────────────────

async function applyProposal(
  proposal: {
    type: string
    exercise_id: string | null
    proposed_value: Record<string, unknown>
  }
): Promise<string | null> {
  const db = service()
  const { type, exercise_id, proposed_value } = proposal

  // swap_exercise et add_rest_day ne s'appliquent pas automatiquement — approbation coach seulement
  if (type === 'swap_exercise' || type === 'add_rest_day') {
    return null // pas d'apply automatique
  }

  if (!exercise_id) {
    return 'exercise_id requis pour ce type de changement'
  }

  if (type === 'increase_volume') {
    const newSets = proposed_value.sets as number
    const { error } = await db
      .from('program_exercises')
      .update({ sets: newSets })
      .eq('id', exercise_id)
    return error ? error.message : null
  }

  if (type === 'decrease_volume') {
    const newSets = proposed_value.sets as number
    // GREATEST enforced côté application (minimum 1)
    const safeSets = Math.max(newSets, 1)
    const { error } = await db
      .from('program_exercises')
      .update({ sets: safeSets })
      .eq('id', exercise_id)
    return error ? error.message : null
  }

  if (type === 'increase_weight') {
    // Lire l'exercice pour appliquer weight_increment_kg
    const { data: ex, error: fetchError } = await db
      .from('program_exercises')
      .select('current_weight_kg, weight_increment_kg')
      .eq('id', exercise_id)
      .single()

    if (fetchError || !ex) return fetchError?.message ?? 'Exercice introuvable'

    const current = ex.current_weight_kg as number | null
    const increment = (ex.weight_increment_kg as number | null) ?? 2.5

    if (current === null) return null // pas de charge de référence, skip

    const newWeight = Math.round((current + increment) * 4) / 4 // arrondi 0.25kg
    const { error } = await db
      .from('program_exercises')
      .update({ current_weight_kg: newWeight })
      .eq('id', exercise_id)
    return error ? error.message : null
  }

  return `Type de changement non reconnu: ${type}`
}
