import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { awardProgression, trainingPointsForCompletedSets } from '@/lib/rewards/progression'
import { inngest } from '@/lib/inngest/client'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { logId: string } }

const setLogUpdateSchema = z.object({
  id: z.string().uuid(),
  actual_reps: z.number().int().nonnegative().nullable().optional(),
  actual_weight_kg: z.number().nonnegative().nullable().optional(),
  completed: z.boolean().optional(),
  rpe: z.number().min(0).max(10).nullable().optional(),
  rir_actual: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  side: z.enum(['left', 'right', 'bilateral']).optional(),
})

const patchBodySchema = z.object({
  completed: z.boolean().optional(),
  duration_min: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  exercise_notes: z.record(z.string(), z.string()).optional(),
  set_logs: z.array(setLogUpdateSchema).optional(),
})

// PATCH /api/session-logs/[logId] — mettre à jour (compléter, durée, sets)
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: client } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const raw = await req.json()
  const parsed = patchBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }
  const { completed, duration_min, notes, exercise_notes, set_logs } = parsed.data

  const db = service()
  let pointsEarned = 0

  // Mettre à jour le session log
  const patch: Record<string, unknown> = {}
  if (notes !== undefined) patch.notes = notes
  if (duration_min !== undefined) patch.duration_min = duration_min
  if (exercise_notes !== undefined) patch.exercise_notes = exercise_notes
  if (completed) patch.completed_at = new Date().toISOString()

  if (Object.keys(patch).length > 0) {
    await db
      .from('client_session_logs')
      .update(patch)
      .eq('id', params.logId)
      .eq('client_id', (client as { id: string }).id)
  }

  // Bulk update set logs before calculating progression so an inline completion
  // request is scored from the same state it persists.
  if (Array.isArray(set_logs) && set_logs.length > 0) {
    const validSets = set_logs.filter(s => s.id)
    if (validSets.length > 0) {
      await db.from('client_set_logs').upsert(
        validSets.map(s => ({
          id: s.id,
          actual_reps: s.actual_reps ?? null,
          actual_weight_kg: s.actual_weight_kg ?? null,
          completed: s.completed ?? false,
          rpe: s.rpe ?? null,
          rir_actual: s.rir_actual ?? null,
          notes: s.notes ?? null,
          side: s.side ?? null,
        })),
        { onConflict: 'id' }
      )
    }
  }

  // Notif coach quand la séance est complétée
  if (completed) {
    const { data: log } = await db
      .from('client_session_logs')
      .select('session_name, coach_clients(coach_id, first_name, last_name)')
      .eq('id', params.logId)
      .single()

    const coachId = (log?.coach_clients as any)?.coach_id
    const clientName = [
      (log?.coach_clients as any)?.first_name,
      (log?.coach_clients as any)?.last_name,
    ].filter(Boolean).join(' ') || 'Le client'
    const sessionName = log?.session_name ?? 'Séance'

    if (coachId) {
      await db.from('coach_notifications').insert({
        coach_id: coachId,
        client_id: (client as { id: string }).id,
        category: 'training',
        subcategory: 'session_completed',
        priority: 3,
        status: 'pending',
        email_sent: false,
        title: 'Séance complétée',
        body: `${clientName} a terminé la séance "${sessionName}".`,
        payload: {
          session_log_id: params.logId,
          session_name: sessionName,
          action_url: `/coach/clients/${(client as { id: string }).id}/data/performances`,
        },
      })
    }

    const { data: loggedSets, error: loggedSetsError } = await db
      .from('client_set_logs')
      .select('completed')
      .eq('session_log_id', params.logId)

    if (loggedSetsError) {
      console.error('[session-logs] unable to calculate completion points', {
        logId: params.logId,
        message: loggedSetsError.message,
      })
    } else {
      const plannedSetCount = loggedSets?.length ?? 0
      const completedSetCount = loggedSets?.filter((set: { completed: boolean }) => set.completed).length ?? 0
      const basePoints = trainingPointsForCompletedSets(completedSetCount, plannedSetCount)

      if (basePoints > 0) {
        const progression = await awardProgression(db, {
          clientId: (client as { id: string }).id,
          action: 'training',
          basePoints,
          sourceKey: `session:${params.logId}`,
          referenceId: params.logId,
          metadata: {
            completion: completedSetCount === plannedSetCount ? 'full' : 'partial',
            completion_ratio: completedSetCount / plannedSetCount,
            completed_sets: completedSetCount,
            planned_sets: plannedSetCount,
            prescribed_sessions_reference: 3,
          },
        })
        pointsEarned = progression?.already_awarded ? 0 : progression?.awarded_points ?? 0
      }
    }

    // Insert smart_agenda_events (fire and forget)
    const { data: sessionLog } = await db
      .from('client_session_logs')
      .select('session_name')
      .eq('id', params.logId)
      .single()

    void db.from('smart_agenda_events').insert({
      client_id: (client as { id: string }).id,
      event_type: 'session',
      event_date: new Date().toISOString().split('T')[0],
      event_time: new Date().toTimeString().slice(0, 5),
      source_id: params.logId,
      title: sessionLog?.session_name ?? 'Séance réalisée',
      summary: null,
      data: null,
    })
  }

  // Double progression — déclenchée après persistance des set logs pour éviter
  // d'évaluer une séance complétée avec des séries encore incomplètes en base.
  if (completed) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/progression/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ session_log_id: params.logId }),
    }).catch(err => console.warn('[progression] evaluate failed silently:', err))
    // Fire-and-forget — non bloquant sur la réponse client

    void inngest.send({
      name: 'training/session.completed',
      data: {
        client_id: (client as { id: string }).id,
        session_log_id: params.logId,
      },
    }).catch(err => console.warn('[training notifications] enqueue failed silently:', err))
  }

  return NextResponse.json({ success: true, points_earned: pointsEarned })
}
