import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { isAllowedChatAttachment, uploadChatAttachment, signChatAttachment } from '@/lib/chat/attachments'

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !isAllowedChatAttachment(file)) {
    return NextResponse.json({ error: 'Fichier non pris en charge ou supérieur à 10 Mo.' }, { status: 400 })
  }

  try {
    const attachment = await uploadChatAttachment(db, client.id as string, file)
    const content = String(form.get('content') ?? '').trim().slice(0, 500)
    const { data: message, error } = await db.from('chat_messages').insert({
      client_id: client.id,
      role: 'user',
      content: content || file.name,
      message_type: 'text',
      metadata: { attachment },
    }).select('id, role, content, message_type, metadata, created_at').single()
    if (error || !message) throw error ?? new Error('Message impossible à enregistrer')

    if (client.coach_id) {
      await db.from('coach_notifications').insert({
        coach_id: client.coach_id,
        client_id: client.id,
        chat_message_id: message.id,
        category: 'engagement',
        subcategory: 'coach_message_reply',
        priority: 2,
        email_sent: false,
      })
    }
    return NextResponse.json({ message: { ...message, metadata: { attachment: await signChatAttachment(db, attachment) } } }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pièce jointe impossible à envoyer.' }, { status: 500 })
  }
}
