/**
 * POST /api/client/appointments/[appointmentId]/respond
 *
 * Permet au client de confirmer ou de demander un report.
 * Jamais de client_id dans le body : tout est résolu depuis auth.uid().
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { sendCoachNotification } from '@/lib/notifications/sendCoachNotification'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const RespondSchema = z.object({
  action: z.enum(['confirm', 'request_reschedule']),
  reason: z.string().trim().max(500).optional(),
})

type RouteContext = { params: { appointmentId: string } }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = RespondSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = service()

  // Résolution du client
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, coach_id, first_name, last_name')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Charge le rendez-vous
  const { data: appt } = await db
    .from('coaching_appointments')
    .select('id, status, title, starts_at, coach_id, client_id, confirmation_required')
    .eq('id', params.appointmentId)
    .eq('client_id', clientRow.id)
    .single()

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Seuls les rendez-vous en awaiting_confirmation peuvent recevoir une réponse client
  if (appt.status !== 'awaiting_confirmation') {
    return NextResponse.json(
      { error: 'This appointment does not require a client response' },
      { status: 409 },
    )
  }

  const { action, reason } = parsed.data
  const newStatus = action === 'confirm' ? 'confirmed' : 'reschedule_requested'
  const now = new Date().toISOString()

  const { data: updated, error: updateErr } = await db
    .from('coaching_appointments')
    .update({
      status: newStatus,
      responded_at: now,
      reschedule_reason: action === 'request_reschedule' ? (reason ?? null) : null,
      updated_at: now,
    })
    .eq('id', params.appointmentId)
    .select('id, status')
    .single()

  if (updateErr || !updated) {
    console.error('[client/appointments/respond] update error', updateErr)
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
  }

  // Journal
  await db.from('coaching_appointment_activity').insert({
    appointment_id: params.appointmentId,
    actor_role: 'client',
    actor_user_id: user.id,
    event_type: action === 'confirm' ? 'confirmed' : 'reschedule_requested',
    metadata: { reason: reason ?? null },
  })

  // Notifie le coach si le client demande un report
  if (action === 'request_reschedule') {
    const clientName = [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ') || 'Un client'
    try {
      await sendCoachNotification(db, {
        coachId: appt.coach_id,
        type: 'appointment',
        title: `Report demandé — ${appt.title}`,
        body: reason
          ? `${clientName} : « ${reason.slice(0, 200)} »`
          : `${clientName} a demandé un report pour cet appel.`,
        payload: {
          appointment_id: params.appointmentId,
          action: 'reschedule_requested',
        },
      })
    } catch (err) {
      console.error('[appointments/respond] coach notification error', err)
    }
  }

  return NextResponse.json({ ok: true, status: updated.status })
}
