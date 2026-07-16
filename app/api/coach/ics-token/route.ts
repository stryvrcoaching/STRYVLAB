/**
 * GET /api/coach/ics-token
 *   Retourne le token ICS du coach authentifié.
 *   Si aucun token n'existe, en crée un automatiquement.
 *
 * POST /api/coach/ics-token
 *   Régénère un nouveau token (révoque l'ancien lien).
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

// ─── GET — récupère ou crée le token ─────────────────────────────────────────

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  // Upsert : crée le token s'il n'existe pas encore
  const { data, error } = await db
    .from('coach_ics_tokens')
    .upsert({ coach_id: user.id }, { onConflict: 'coach_id', ignoreDuplicates: true })
    .select('token')
    .single()

  if (error || !data) {
    // Fallback : lecture directe si l'upsert a ignoré le doublon
    const { data: existing, error: fetchErr } = await db
      .from('coach_ics_tokens')
      .select('token')
      .eq('coach_id', user.id)
      .single()

    if (fetchErr || !existing) {
      console.error('[ics-token] GET error', fetchErr)
      return NextResponse.json({ error: 'Failed to get ICS token' }, { status: 500 })
    }

    return NextResponse.json({ token: existing.token })
  }

  return NextResponse.json({ token: data.token })
}

// ─── POST — régénère le token ─────────────────────────────────────────────────

export async function POST() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  // Supprime l'ancien token et en insère un nouveau (gen_random_uuid() par défaut)
  await db.from('coach_ics_tokens').delete().eq('coach_id', user.id)

  const { data, error } = await db
    .from('coach_ics_tokens')
    .insert({ coach_id: user.id })
    .select('token')
    .single()

  if (error || !data) {
    console.error('[ics-token] POST error', error)
    return NextResponse.json({ error: 'Failed to regenerate ICS token' }, { status: 500 })
  }

  return NextResponse.json({ token: data.token })
}
