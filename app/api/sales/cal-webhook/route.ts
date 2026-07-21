import { NextRequest, NextResponse } from 'next/server'
import { createDashboardServiceClient } from '@/lib/dashboard/service'
import { verifyCalWebhookSignature } from '@/lib/security/cal-webhook'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const isValid = verifyCalWebhookSignature(
      rawBody,
      req.headers.get('x-cal-signature-256'),
      process.env.CAL_WEBHOOK_SECRET,
    )

    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody) as Record<string, any>
    if (!payload) {
      return NextResponse.json({ error: 'Body vide' }, { status: 400 })
    }

    const eventType = payload.triggerEvent || payload.event
    const booking = payload.payload || payload
    const attendees = booking?.attendees || []

    if (!eventType || attendees.length === 0) {
      return NextResponse.json({ error: 'Payload Cal.com invalide' }, { status: 400 })
    }

    const email = attendees[0].email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Email participant introuvable' }, { status: 400 })
    }

    const db = createDashboardServiceClient()

    if (eventType === 'BOOKING_CREATED') {
      const { error } = await db
        .from('sales_leads')
        .update({
          status: 'demo_scheduled',
          demo_scheduled_at: booking.startTime || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('normalized_email', email)
        .is('coach_id', null)

      if (error) {
        console.error('[cal-webhook] Failed to update lead status')
        return NextResponse.json({ error: 'Unable to update lead status' }, { status: 500 })
      }
    } else if (eventType === 'BOOKING_CANCELLED') {
      const { error } = await db
        .from('sales_leads')
        .update({
          status: 'qualified',
          demo_scheduled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('normalized_email', email)
        .is('coach_id', null)

      if (error) {
        console.error('[cal-webhook] Failed to reset lead status')
        return NextResponse.json({ error: 'Unable to reset lead status' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error('[cal-webhook] failed')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
