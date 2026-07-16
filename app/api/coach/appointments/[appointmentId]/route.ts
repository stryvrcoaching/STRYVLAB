/**
 * PATCH /api/coach/appointments/[appointmentId]
 * GET   /api/coach/appointments/[appointmentId]
 *
 * Modifier, annuler, clôturer ou marquer absent un rendez-vous.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { isValidMeetingUrl, type AppointmentStatus } from '@/lib/appointments/types'
import { scheduleAppointmentNotifications, cancelPendingDeliveries } from '@/lib/appointments/notifications'
import { syncAppointmentToExternalCalendar, deleteAppointmentFromExternalCalendar } from '@/lib/appointments/calendar-sync'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  meeting_kind: z.enum(['video', 'phone', 'in_person', 'other']).optional(),
  meeting_url: z
    .string()
    .max(2048)
    .nullable()
    .optional()
    .refine((v) => !v || isValidMeetingUrl(v), { message: 'meeting_url invalide' }),
  client_message: z.string().trim().max(2000).nullable().optional(),
  confirmation_required: z.boolean().optional(),
  coach_private_notes: z.string().trim().max(10_000).nullable().optional(),
  action: z.enum(['cancel', 'complete', 'no_show']).optional(),
  cancel_reason: z.string().trim().max(500).nullable().optional(),
})

type RouteContext = { params: { appointmentId: string } }

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const { data, error } = await db
    .from('coaching_appointments')
    .select('*')
    .eq('id', params.appointmentId)
    .eq('coach_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = service()

  // Charge le rendez-vous existant (appartenance coach vérifiée)
  const { data: existing, error: fetchErr } = await db
    .from('coaching_appointments')
    .select('*')
    .eq('id', params.appointmentId)
    .eq('coach_id', user.id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Transitions interdites
  if (['cancelled', 'completed', 'no_show'].includes(existing.status)) {
    return NextResponse.json(
      { error: 'Cannot modify a terminal appointment' },
      { status: 409 },
    )
  }

  const body = parsed.data
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let eventType = 'updated'
  let notifyKind: 'updated' | 'cancelled' | null = null

  // ── Action métier ──────────────────────────────────────────────────────────
  if (body.action === 'cancel') {
    updates.status = 'cancelled'
    updates.cancelled_at = new Date().toISOString()
    updates.cancel_reason = body.cancel_reason ?? null
    eventType = 'cancelled'
    notifyKind = 'cancelled'
  } else if (body.action === 'complete') {
    updates.status = 'completed'
    updates.completed_at = new Date().toISOString()
    eventType = 'completed'
  } else if (body.action === 'no_show') {
    updates.status = 'no_show'
    updates.completed_at = new Date().toISOString()
    eventType = 'no_show'
  } else {
    // ── Modification classique ─────────────────────────────────────────────
    const isRescheduled =
      (body.starts_at && body.starts_at !== existing.starts_at) ||
      (body.ends_at && body.ends_at !== existing.ends_at)

    if (body.title !== undefined) updates.title = body.title
    if (body.starts_at !== undefined) updates.starts_at = body.starts_at
    if (body.ends_at !== undefined) updates.ends_at = body.ends_at
    if (body.meeting_kind !== undefined) updates.meeting_kind = body.meeting_kind
    if (body.meeting_url !== undefined) updates.meeting_url = body.meeting_url
    if (body.client_message !== undefined) updates.client_message = body.client_message
    if (body.coach_private_notes !== undefined) updates.coach_private_notes = body.coach_private_notes

    // Validation dates
    const newStart = new Date(String(updates.starts_at ?? existing.starts_at))
    const newEnd = new Date(String(updates.ends_at ?? existing.ends_at))
    if (newStart >= newEnd) {
      return NextResponse.json({ error: 'ends_at must be after starts_at' }, { status: 400 })
    }

    if (isRescheduled) {
      // Un déplacement remet à awaiting_confirmation si une confirmation est requise
      if (body.confirmation_required ?? existing.confirmation_required) {
        updates.status = 'awaiting_confirmation'
      }
      notifyKind = 'updated'
    } else if (
      body.meeting_url !== undefined ||
      body.meeting_kind !== undefined ||
      body.client_message !== undefined
    ) {
      notifyKind = 'updated'
    }

    if (body.confirmation_required !== undefined) {
      updates.confirmation_required = body.confirmation_required
    }
  }

  // Applique la mise à jour
  const { data: updated, error: updateErr } = await db
    .from('coaching_appointments')
    .update(updates)
    .eq('id', params.appointmentId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[appointments] update error', updateErr)
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
  }

  // Synchronisation Calendriers externes
  let finalUpdated = updated
  if (eventType === 'cancelled') {
    await deleteAppointmentFromExternalCalendar(db, existing)
  } else {
    // Si c'est un déplacement ou une mise à jour d'infos, on ré-aligne l'agenda externe
    const syncRes = await syncAppointmentToExternalCalendar(db, updated)
    if (syncRes) {
      const { data: refreshed } = await db
        .from('coaching_appointments')
        .select('*')
        .eq('id', updated.id)
        .single()
      if (refreshed) {
        finalUpdated = refreshed
      }
    }
  }

  // Journal d'activité
  await db.from('coaching_appointment_activity').insert({
    appointment_id: params.appointmentId,
    actor_role: 'coach',
    actor_user_id: user.id,
    event_type: eventType,
    metadata: updates,
  })

  // Notifications
  if (notifyKind === 'cancelled') {
    await cancelPendingDeliveries(db, params.appointmentId)
  } else if (notifyKind === 'updated') {
    // Annule les anciens rappels avant d'en reprogrammer
    await cancelPendingDeliveries(db, params.appointmentId, ['reminder_24h', 'reminder_1h'])

    const { data: clientRow } = await db
      .from('coach_clients')
      .select('user_id')
      .eq('id', existing.client_id)
      .single()

    if (clientRow?.user_id) {
      scheduleAppointmentNotifications(db, finalUpdated, clientRow.user_id, notifyKind).catch((err) =>
        console.error('[appointments] notify error', err),
      )
    }
  }

  return NextResponse.json({ ok: true, appointment: finalUpdated })
}
