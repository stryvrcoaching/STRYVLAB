import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

// GET /api/clients/[clientId]/subscriptions — list subscriptions for a client
export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('client_subscriptions')
    .select('*, formula:coach_formulas(*)')
    .eq('client_id', params.clientId)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscriptions: data })
}

// POST /api/clients/[clientId]/subscriptions — attach a formula to a client
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { formula_id, status, start_date, end_date, next_billing_date, price_override_eur, notes } = body

  if (!formula_id) return NextResponse.json({ error: 'formula_id requis' }, { status: 400 })

  // Verify formula belongs to coach
  const { data: formula } = await serviceClient()
    .from('coach_formulas')
    .select('id')
    .eq('id', formula_id)
    .eq('coach_id', user.id)
    .single()

  if (!formula) return NextResponse.json({ error: 'Formule introuvable' }, { status: 404 })

  const { data, error } = await serviceClient()
    .from('client_subscriptions')
    .insert({
      coach_id: user.id,
      client_id: params.clientId,
      formula_id,
      status: status ?? 'active',
      start_date: start_date ?? new Date().toISOString().split('T')[0],
      end_date: end_date ?? null,
      next_billing_date: next_billing_date ?? null,
      price_override_eur: price_override_eur ?? null,
      notes: notes ?? null,
    })
    .select('*, formula:coach_formulas(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscription: data }, { status: 201 })
}
