import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { isAllowedChatAttachment, uploadChatAttachment, signChatAttachment } from '@/lib/chat/attachments'

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const db = service()
  const { data: client } = await db.from('coach_clients').select('id').eq('id', params.clientId).eq('coach_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !isAllowedChatAttachment(file)) {
    return NextResponse.json({ error: 'Fichier non pris en charge ou supérieur à 10 Mo.' }, { status: 400 })
  }

  try {
    const attachment = await uploadChatAttachment(db, params.clientId, file)
    const content = String(form.get('content') ?? '').trim().slice(0, 500)
    const { data: message, error } = await db.from('chat_messages').insert({
      client_id: params.clientId,
      role: 'assistant',
      content: content || file.name,
      message_type: 'text',
      from_coach_human: true,
      metadata: { attachment },
    }).select('id, role, content, message_type, from_coach_human, metadata, created_at').single()
    if (error || !message) throw error ?? new Error('Message impossible à enregistrer')

    await createClientAppNotification(db, {
      clientId: params.clientId,
      coachId: user.id,
      type: 'coach_note',
      copyKey: 'coach.message',
      copyParams: { message: content || file.name },
      actionUrl: '/client',
      payload: { message_kind: 'coach_message', chat_message_id: message.id },
      pushKind: 'coach_message',
      pushTag: `stryv-coach-message-${params.clientId}`,
    })
    return NextResponse.json({ message: { ...message, metadata: { attachment: await signChatAttachment(db, attachment) } } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pièce jointe impossible à envoyer.' }, { status: 500 })
  }
}
