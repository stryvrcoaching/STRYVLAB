import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { syncAppointmentToExternalCalendar } from '@/lib/appointments/calendar-sync'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const BookSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  meeting_kind: z.enum(['video', 'phone']),
  client_message: z.string().trim().max(1000).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const json = await req.json()
    const data = BookSchema.parse(json)

    const db = service()

    // Résout le client
    const { data: clientRow } = await db
      .from('coach_clients')
      .select('id, first_name, last_name, coach_id, timezone')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!clientRow || !clientRow.coach_id) {
      return NextResponse.json({ error: 'Client profile or coach connection not found' }, { status: 404 })
    }

    const clientName = [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ') || 'Client'
    const title = `📞 Appel — ${clientName}`

    // Insère le rendez-vous
    const { data: appt, error: insErr } = await db
      .from('coaching_appointments')
      .insert({
        coach_id: clientRow.coach_id,
        client_id: clientRow.id,
        title,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        client_timezone: clientRow.timezone || 'Europe/Paris',
        meeting_kind: data.meeting_kind,
        client_message: data.client_message ?? null,
        confirmation_required: false,
        status: 'confirmed', // Réservé directement par le client sur un créneau libre du coach
      })
      .select()
      .single()

    if (insErr || !appt) {
      throw insErr || new Error('Insert failed')
    }

    // Journal d'activité
    await db.from('coaching_appointment_activity').insert({
      appointment_id: appt.id,
      actor_role: 'client',
      actor_user_id: user.id,
      event_type: 'created',
      metadata: { starts_at: data.starts_at, ends_at: data.ends_at }
    })

    // Synchronisation agenda externe (Google Calendar / Google Meet)
    await syncAppointmentToExternalCalendar(db, appt)

    // Notification interne du coach (par exemple en insérant une notification ou via push)
    // Ici, le coach reçoit une notification de type 'appointment'
    await db.from('coach_client_notifications').insert({
      coach_id: clientRow.coach_id,
      client_id: clientRow.id,
      type: 'appointment',
      title: '📅 Nouveau rendez-vous réservé',
      body: `${clientName} a réservé un appel le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.starts_at))}.`,
      payload: { appointment_id: appt.id }
    })

    return NextResponse.json({ ok: true, appointment: appt })
  } catch (err) {
    console.error('[client/appointments/book] error', err)
    return NextResponse.json(
      { error: err instanceof z.ZodError ? 'Validation failed' : 'Failed to book appointment' },
      { status: 400 }
    )
  }
}
