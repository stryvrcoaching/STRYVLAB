import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/formulas — list all formulas for the authenticated coach
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('coach_formulas')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ formulas: data })
}

// POST /api/formulas — create a formula
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { name, description, price_eur, billing_cycle, duration_months, features, color } = body

  if (!name || price_eur === undefined) {
    return NextResponse.json({ error: 'name et price_eur requis' }, { status: 400 })
  }

  const { data, error } = await serviceClient()
    .from('coach_formulas')
    .insert({
      coach_id: user.id,
      name,
      description: description ?? null,
      price_eur: Number(price_eur),
      billing_cycle: billing_cycle ?? 'monthly',
      duration_months: duration_months ?? null,
      features: features ?? [],
      color: color ?? '#6366f1',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ formula: data }, { status: 201 })
}
