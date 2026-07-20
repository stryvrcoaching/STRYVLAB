import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildWhatsAppReply } from '@/lib/whatsapp/agent'
import { sendWhatsAppText } from '@/lib/whatsapp/client'
import { verifyWhatsAppSignature, isValidWebhookVerification } from '@/lib/whatsapp/security'
import { isWhatsAppWebhook, parseWhatsAppWebhook } from '@/lib/whatsapp/webhook'

export const runtime = 'nodejs'

function serviceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams
  if (!isValidWebhookVerification(query.get('hub.mode'), query.get('hub.verify_token'), process.env.WHATSAPP_VERIFY_TOKEN)) {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 })
  }
  return new NextResponse(query.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

async function audit(coachId: string, eventType: string, messageId?: string, metadata: Record<string, unknown> = {}) {
  await serviceClient().from('whatsapp_agent_audit_logs').insert({
    coach_id: coachId,
    event_type: eventType,
    message_id: messageId ?? null,
    metadata,
  })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyWhatsAppSignature(rawBody, request.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }
  if (!isWhatsAppWebhook(payload)) return NextResponse.json({ error: 'Unrecognized event' }, { status: 404 })

  const db = serviceClient()
  for (const message of parseWhatsAppWebhook(payload)) {
    const { data: agent, error: agentError } = await db
      .from('coach_whatsapp_agents')
      .select('coach_id')
      .eq('phone_e164', message.from)
      .eq('enabled', true)
      .maybeSingle()

    if (agentError) {
      console.error('[whatsapp] agent lookup failed')
      continue
    }
    if (!agent) continue // Do not disclose whether an unknown phone is registered.

    const { data: inbound, error: insertError } = await db
      .from('whatsapp_inbound_messages')
      .insert({
        provider_message_id: message.id,
        coach_id: agent.coach_id,
        sender_phone_e164: message.from,
        message_type: message.type,
        body: message.text,
        raw_payload: message.raw,
      })
      .select('id')
      .maybeSingle()

    if (insertError?.code === '23505') continue // Meta retry: response was already handled.
    if (insertError || !inbound) {
      console.error('[whatsapp] inbound message insert failed')
      continue
    }

    await audit(agent.coach_id, 'message_received', inbound.id, { type: message.type })
    try {
      const reply = await buildWhatsAppReply(db, agent.coach_id, message)
      await sendWhatsAppText(message.from, reply)
      await db.from('whatsapp_inbound_messages').update({ response_text: reply, processed_at: new Date().toISOString() }).eq('id', inbound.id)
      await audit(agent.coach_id, 'assistant_replied', inbound.id)
    } catch {
      console.error('[whatsapp] processing failed')
      await db.from('whatsapp_inbound_messages').update({ processing_error: 'processing_failed', processed_at: new Date().toISOString() }).eq('id', inbound.id)
      await audit(agent.coach_id, 'assistant_failed', inbound.id, { reason: 'processing_failed' })
    }
  }

  return NextResponse.json({ received: true })
}
