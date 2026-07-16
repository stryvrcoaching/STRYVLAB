import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { signChatAttachment, type ChatAttachment } from '@/lib/chat/attachments'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data: messages, error } = await db
    .from('chat_messages')
    .select('id, role, content, message_type, from_coach_human, metadata, created_at')
    .eq('client_id', params.clientId)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const signedMessages = await Promise.all((messages ?? []).map(async (message) => {
    const attachment = (message.metadata as { attachment?: ChatAttachment } | null)?.attachment
    if (!attachment?.path) return message
    return { ...message, metadata: { ...(message.metadata ?? {}), attachment: await signChatAttachment(db, attachment) } }
  }))
  return NextResponse.json({ messages: signedMessages })
}

// POST /api/coach/clients/[clientId]/reply
// Crée une notification visible dans le dashboard client
// et résout toutes les notifications pending associées au client
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = service()

  // Vérifier que ce client appartient bien au coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  let coachMessage: { id: string; content: string; role: string; message_type: string; from_coach_human: boolean; created_at: string } | null = null
  try {
    const { data: insertedCoachMessage, error: coachMessageError } = await db
      .from('chat_messages')
      .insert({
        client_id: params.clientId,
        role: 'assistant',
        content: body.data.content,
        message_type: 'text',
        from_coach_human: true,
      })
      .select('id, content, role, message_type, from_coach_human, metadata, created_at')
      .single()

    if (coachMessageError || !insertedCoachMessage) {
      throw coachMessageError ?? new Error('Message coach impossible à enregistrer')
    }
    coachMessage = insertedCoachMessage

    await createClientAppNotification(db, {
      clientId: params.clientId,
      coachId: user.id,
      type: 'coach_note',
      copyKey: 'coach.message',
      copyParams: { message: body.data.content },
      actionUrl: '/client',
      payload: { message_kind: 'coach_message', chat_message_id: coachMessage.id },
      pushKind: 'coach_message',
      pushTag: `stryv-coach-message-${params.clientId}`,
    })
  } catch (error) {
    console.error('[coach-reply] notification creation failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Notification impossible à créer' },
      { status: 500 },
    )
  }

  // Résoudre toutes les notifications pending pour ce client
  await db
    .from('coach_notifications')
    .update({ status: 'resolved' })
    .eq('coach_id', user.id)
    .eq('client_id', params.clientId)
    .eq('status', 'pending')

  return NextResponse.json({ ok: true, message: coachMessage }, { status: 201 })
}
