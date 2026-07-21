import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  assertCoachClientCapacity,
  ClientLimitReachedError,
} from '@/lib/billing/clientLimits'

// Service role client — bypasses RLS for coach operations
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/clients — list all clients for the authenticated coach
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data, error } = await serviceClient()
    .from('coach_clients')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/clients error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ clients: data })
}

// POST /api/clients — create a new client
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const { firstName, lastName, email, phone, goal, notes, gender,
          training_goal, fitness_level, sport_practice, weekly_frequency } = body

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Prénom et nom obligatoires' }, { status: 400 })
  }

  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'Email obligatoire' }, { status: 400 })
  }

  const db = serviceClient()
  try {
    await assertCoachClientCapacity(db, user.id)
  } catch (limitError) {
    if (limitError instanceof ClientLimitReachedError) {
      return NextResponse.json(
        {
          error:
            'Limite de clients atteinte pour votre plan. Passez à un plan supérieur pour en ajouter.',
        },
        { status: 403 },
      )
    }
    throw limitError
  }

  const { data, error } = await db
    .from('coach_clients')
    .insert({
      coach_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      goal: goal?.trim() || null,
      notes: notes?.trim() || null,
      gender: gender || 'prefer_not_to_say',
      training_goal:    training_goal    || null,
      fitness_level:    fitness_level    || null,
      sport_practice:   sport_practice   || null,
      weekly_frequency: weekly_frequency ?? null,
      status: 'inactive',
    })
    .select()
    .single()

  if (error) {
    console.error('POST /api/clients error:', error)
    // Table doesn't exist yet — return helpful message
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'La table coach_clients n\'existe pas encore. Exécutez le script SQL de migration.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const [aiSettingsResult, checkinConfigResult] = await Promise.all([
    db.from('coach_ai_settings_per_client').upsert(
      {
        coach_id: user.id,
        client_id: data.id,
        ai_llm_enabled: false,
        ai_morning_routine_enabled: false,
        ai_evening_routine_enabled: false,
        coaching_freedom: 'none',
      },
      { onConflict: 'coach_id,client_id' },
    ),
    db.from('daily_checkin_configs').upsert(
      {
        coach_id: user.id,
        client_id: data.id,
        is_active: false,
        days_of_week: [],
        moments: [],
      },
      { onConflict: 'coach_id,client_id' },
    ),
  ])

  if (aiSettingsResult.error || checkinConfigResult.error) {
    console.error('POST /api/clients bootstrap error:', {
      aiSettingsError: aiSettingsResult.error,
      checkinConfigError: checkinConfigResult.error,
      clientId: data.id,
    })
    return NextResponse.json(
      { error: 'Client créé mais configuration initiale incomplète. Vérifiez les logs serveur.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ client: data }, { status: 201 })
}
