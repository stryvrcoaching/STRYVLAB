/**
 * POST /api/progression/evaluate
 *
 * Appelé automatiquement par PATCH /api/session-logs/[logId] quand completed=true.
 * Évalue la double progression pour tous les exercices de la séance
 * dont le programme a progressive_overload_enabled = true.
 *
 * - Lit les set_logs de la séance
 * - Lit les program_exercises avec rep_min/rep_max/target_rir
 * - Applique evaluateSessionProgression()
 * - Met à jour current_weight_kg sur les exercices concernés
 * - Insère des progression_events pour l'audit
 *
 * Auth : service role uniquement (appelé server-side depuis PATCH session-logs).
 * Ne pas exposer directement au client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  evaluateSessionProgression,
  parseRepsRange,
  type ExerciseProgressionInput,
} from '@/lib/progression/double-progression'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Vérification simple du secret interne (appels server-to-server uniquement)
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { session_log_id } = await req.json()
  if (!session_log_id) {
    return NextResponse.json({ error: 'session_log_id requis' }, { status: 400 })
  }

  const db = service()

  // ── 1. Charger le session log + program_session + program + flag progression ──
  const { data: sessionLog } = await db
    .from('client_session_logs')
    .select(`
      id,
      client_id,
      program_session_id,
      program_sessions (
        id,
        program_id,
        programs (
          id,
          progressive_overload_enabled
        )
      )
    `)
    .eq('id', session_log_id)
    .single()

  if (!sessionLog) {
    return NextResponse.json({ error: 'Session log introuvable' }, { status: 404 })
  }

  const programSession = sessionLog.program_sessions as any
  const program = programSession?.programs as any

  // Si le programme n'a pas la double progression activée → rien à faire
  if (!program?.progressive_overload_enabled) {
    return NextResponse.json({ skipped: true, reason: 'progressive_overload_enabled = false' })
  }

  const programSessionId = programSession?.id
  if (!programSessionId) {
    return NextResponse.json({ skipped: true, reason: 'program_session_id null' })
  }

  // ── 2. Charger les exercices de la séance avec leur configuration progression ──
  const { data: exercises } = await db
    .from('program_exercises')
    .select('id, name, sets, reps, rep_min, rep_max, target_rir, weight_increment_kg, current_weight_kg')
    .eq('session_id', programSessionId)

  if (!exercises || exercises.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'Aucun exercice trouvé' })
  }

  // ── 3. Charger les set_logs de la séance ──
  const { data: setLogs } = await db
    .from('client_set_logs')
    .select('exercise_id, set_number, actual_reps, rir_actual, completed')
    .eq('session_log_id', session_log_id)

  if (!setLogs || setLogs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'Aucun set log trouvé' })
  }

  // ── 4. Construire les inputs pour l'algorithme ──
  const inputs: ExerciseProgressionInput[] = []

  for (const ex of exercises) {
    // Résoudre rep_min/rep_max : priorité aux colonnes dédiées, fallback parse du champ reps
    let rep_min = ex.rep_min as number | null
    let rep_max = ex.rep_max as number | null

    if (rep_min === null || rep_max === null) {
      const parsed = parseRepsRange(ex.reps ?? '')
      if (parsed) {
        rep_min = parsed.rep_min
        rep_max = parsed.rep_max
      }
    }

    // Si pas de plage parseable → exercice hors scope (AMRAP, isométrique, etc.)
    if (rep_min === null || rep_max === null) continue

    // target_rir : fallback sur rir si target_rir non renseigné
    const target_rir = (ex.target_rir as number | null) ?? (ex as any).rir ?? 2

    const exSets = setLogs
      .filter(s => s.exercise_id === ex.id)
      .map(s => ({
        set_number: s.set_number,
        actual_reps: s.actual_reps ?? 0,
        rir_actual: s.rir_actual ?? null,
        completed: s.completed ?? false,
      }))

    if (exSets.length === 0) continue

    inputs.push({
      exercise_id: ex.id,
      exercise_name: ex.name,
      rep_min,
      rep_max,
      target_rir,
      sets_prescribed: ex.sets,
      current_weight_kg: (ex.current_weight_kg as number | null),
      weight_increment_kg: (ex.weight_increment_kg as number) ?? 2.5,
      sets: exSets,
    })
  }

  if (inputs.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'Aucun exercice avec plage de reps configurée' })
  }

  // ── 5. Exécuter l'algorithme ──
  const results = evaluateSessionProgression(inputs)

  // ── 6. Persister les résultats ──
  const overloadResults = results.filter(r => r.trigger === 'overload' && r.new_weight_kg !== null)
  const allResults = results.filter(r => r.trigger !== 'insufficient_data')

  // 6a. Mettre à jour current_weight_kg sur les exercices déclenchés
  for (const result of overloadResults) {
    await db
      .from('program_exercises')
      .update({ current_weight_kg: result.new_weight_kg })
      .eq('id', result.exercise_id)
  }

  // 6b. Insérer les progression_events (overload + maintain — pas insufficient_data)
  if (allResults.length > 0) {
    const events = allResults.map(r => ({
      exercise_id: r.exercise_id,
      client_id: sessionLog.client_id,
      session_log_id,
      sets_completed: r.sets_evaluated,
      reps_per_set: r.reps_per_set,
      weight_kg: r.previous_weight_kg ?? 0,
      rir_values: r.rir_values.map(v => v ?? -1), // -1 = non renseigné
      trigger_type: r.trigger as 'overload' | 'maintain',
      previous_weight_kg: r.previous_weight_kg,
      new_weight_kg: r.new_weight_kg,
      increment_applied: r.increment_applied,
    }))

    await db.from('progression_events').insert(events)
  }

  return NextResponse.json({
    evaluated: results.length,
    overloads: overloadResults.length,
    results: results.map(r => ({
      exercise_id: r.exercise_id,
      exercise_name: r.exercise_name,
      trigger: r.trigger,
      previous_weight_kg: r.previous_weight_kg,
      new_weight_kg: r.new_weight_kg,
      feedback_message: r.feedback_message,
    })),
  })
}
