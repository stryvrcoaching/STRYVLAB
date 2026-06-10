/**
 * GET /api/progression/history?client_id=xxx
 *
 * Retourne l'historique des progression_events d'un client,
 * groupés par exercice, avec le nom de l'exercice joint.
 * Accessible au coach uniquement (vérifie ownership).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

  const db = service()

  // Vérifier que ce client appartient au coach
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Charger les événements avec le nom de l'exercice
  const { data: events, error } = await db
    .from('progression_events')
    .select(`
      id, exercise_id, session_log_id,
      sets_completed, reps_per_set, weight_kg, rir_values,
      trigger_type, previous_weight_kg, new_weight_kg, increment_applied,
      created_at,
      program_exercises ( name )
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Grouper par exercice
  const map = new Map<string, {
    exercise_id: string
    exercise_name: string
    events: typeof events
    latest_weight: number | null
    total_overloads: number
  }>()

  for (const ev of (events ?? [])) {
    const name = (ev.program_exercises as any)?.name ?? 'Exercice inconnu'

    if (!map.has(ev.exercise_id)) {
      map.set(ev.exercise_id, {
        exercise_id: ev.exercise_id,
        exercise_name: name,
        events: [],
        latest_weight: null,
        total_overloads: 0,
      })
    }

    const group = map.get(ev.exercise_id)!
    group.events.push(ev)

    if (ev.trigger_type === 'overload') {
      group.total_overloads++
      // Le premier event (most recent) donne la charge actuelle
      if (group.latest_weight === null && ev.new_weight_kg !== null) {
        group.latest_weight = ev.new_weight_kg
      }
    } else if (group.latest_weight === null) {
      group.latest_weight = ev.weight_kg
    }
  }

  // Trier les groupes : exercices avec le plus de surcharges en premier
  const groups = Array.from(map.values())
    .sort((a, b) => b.total_overloads - a.total_overloads)

  return NextResponse.json({ groups })
}
