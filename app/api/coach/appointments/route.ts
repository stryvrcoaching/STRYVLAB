/**
 * POST /api/coach/appointments      — créer un rendez-vous
 * GET  /api/coach/appointments      — lister (filtres: from, to, clientId, status)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  isValidMeetingUrl,
  type AppointmentStatus,
  type MeetingKind,
} from '@/lib/appointments/types'
import { scheduleAppointmentNotifications } from '@/lib/appointments/notifications'
import { syncAppointmentToExternalCalendar } from '@/lib/appointments/calendar-sync'

// ─── Service client ───────────────────────────────────────────────────────────

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Schéma de création ───────────────────────────────────────────────────────

const CreateSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  meeting_kind: z.enum(['video', 'phone', 'in_person', 'other']).default('video'),
  meeting_url: z
    .string()
    .max(2048)
    .nullable()
    .optional()
    .refine(
      (v) => !v || isValidMeetingUrl(v),
      { message: 'meeting_url doit être une URL HTTPS valide' },
    ),
  client_message: z.string().trim().max(2000).nullable().optional(),
  confirmation_required: z.boolean().default(false),
  create_kanban_task: z.boolean().default(true),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const db = service()

  // Vérifie que starts_at < ends_at
  if (new Date(data.starts_at) >= new Date(data.ends_at)) {
    return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 })
  }

  // Vérifie que le client appartient bien à ce coach et est actif
  const { data: client, error: clientErr } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, timezone, user_id')
    .eq('id', data.client_id)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .single()

  if (clientErr || !client) {
    return NextResponse.json({ error: 'Client not found or not active' }, { status: 404 })
  }

  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Client'
  const title = data.title?.trim() || `Point de suivi — ${clientName}`
  const status: AppointmentStatus = data.confirmation_required
    ? 'awaiting_confirmation'
    : 'scheduled'

  // Crée le rendez-vous
  const { data: appt, error: insertErr } = await db
    .from('coaching_appointments')
    .insert({
      coach_id: user.id,
      client_id: data.client_id,
      title,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      client_timezone: (client.timezone as string) || 'Europe/Paris',
      meeting_kind: data.meeting_kind as MeetingKind,
      meeting_url: data.meeting_url ?? null,
      client_message: data.client_message ?? null,
      confirmation_required: data.confirmation_required,
      status,
    })
    .select()
    .single()

  if (insertErr || !appt) {
    console.error('[appointments] insert error', insertErr)
    return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
  }

  // Synchronisation agenda externe (Google Meet automatique)
  let updatedAppt = appt
  const syncResult = await syncAppointmentToExternalCalendar(db, appt)
  if (syncResult) {
    // Recharge pour récupérer google_event_id et meeting_url mis à jour
    const { data: refreshed } = await db
      .from('coaching_appointments')
      .select('*')
      .eq('id', appt.id)
      .single()
    if (refreshed) {
      updatedAppt = refreshed
    }
  }

  // Journal d'activité
  await db.from('coaching_appointment_activity').insert({
    appointment_id: appt.id,
    actor_role: 'coach',
    actor_user_id: user.id,
    event_type: 'created',
    metadata: { title, status },
  })

  // Tâche Kanban de préparation (optionnelle)
  let kanbanTaskId: string | null = null
  if (data.create_kanban_task) {
    const { data: target } = await db
      .from('kanban_boards')
      .select('id, kanban_columns(id)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const boardId = target?.id
    const firstColumn = (target as any)?.kanban_columns?.[0]?.id

    if (boardId && firstColumn) {
      const { data: task, error: taskErr } = await db
        .from('kanban_tasks')
        .insert({
          coach_id: user.id,
          board_id: boardId,
          column_id: firstColumn,
          title: `Préparer : ${title}`,
          appointment_id: appt.id,
          priority: 'medium',
        })
        .select('id')
        .single()
      
      if (taskErr) {
        console.error('[appointments-api] Failed to create linked Kanban task:', taskErr)
      } else {
        kanbanTaskId = task?.id ?? null
      }
    }
  }

  // Notifications + rappels (fire-and-forget, sans bloquer la réponse)
  scheduleAppointmentNotifications(db, updatedAppt, client.user_id, 'created').catch((err) =>
    console.error('[appointments] notify error', err),
  )

  return NextResponse.json({ ok: true, appointment: updatedAppt, kanbanTaskId }, { status: 201 })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')

  const db = service()
  let query = db
    .from('coaching_appointments')
    .select('*')
    .eq('coach_id', user.id)
    .order('starts_at', { ascending: true })

  if (from) query = query.gte('starts_at', from)
  if (to)   query = query.lte('starts_at', to)
  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.limit(200)
  if (error) {
    console.error('[appointments] list error', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
