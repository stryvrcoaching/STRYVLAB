import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { buildCheckinReadyCopy } from '@/lib/client/checkin/flows'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const bodySchema = z.object({
  message_id: z.string().uuid(),
  action: z.enum(['defer', 'mark_answered']),
  selected_label: z.string().trim().min(1).max(120).optional(),
})

/** Defer proactive check-in by 1h or mark ready prompt as answered. */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const lang = await resolveClientLanguage(db, cc.id)

  const { data: msg } = await db
    .from('chat_messages')
    .select('id, metadata, message_type')
    .eq('id', parsed.data.message_id)
    .eq('client_id', cc.id)
    .single()

  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

  const meta = { ...((msg.metadata as Record<string, unknown>) ?? {}) }
  const now = new Date().toISOString()

  if (parsed.data.action === 'defer') {
    const deferredUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    meta.deferred_until = deferredUntil
    meta.answered = true
  } else {
    meta.answered = true
  }

  const { data: updated } = await db
    .from('chat_messages')
    .update({ metadata: meta })
    .eq('id', parsed.data.message_id)
    .select('id, metadata')
    .single()

  const insertedMessages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    message_type: string
    metadata: Record<string, unknown> | null
    created_at: string
  }> = []

  if (parsed.data.action === 'defer') {
    const readyCopy = buildCheckinReadyCopy(lang, (meta.flow_type as 'morning' | 'evening') ?? 'morning')
    const selectedLabel = parsed.data.selected_label ?? readyCopy.later
    const { data: persisted } = await db
      .from('chat_messages')
      .insert([
        {
          client_id: cc.id,
          role: 'user',
          content: selectedLabel,
          message_type: 'quick_reply',
          parent_message_id: parsed.data.message_id,
          metadata: { key: 'checkin_ready', action: 'defer' },
          created_at: now,
        },
        {
          client_id: cc.id,
          role: 'assistant',
          content:
            typeof meta.defer_message === 'string' && meta.defer_message.length > 0
              ? meta.defer_message
              : readyCopy.deferMessage,
          message_type: 'text',
          parent_message_id: parsed.data.message_id,
          metadata: { key: 'checkin_ready_followup', action: 'defer' },
          created_at: now,
        },
      ])
      .select('id, role, content, message_type, metadata, created_at')

    if (persisted) insertedMessages.push(...persisted as typeof insertedMessages)
  } else {
    const selectedLabel = parsed.data.selected_label ?? buildCheckinReadyCopy(lang, (meta.flow_type as 'morning' | 'evening') ?? 'morning').yes
    const { data: persisted } = await db
      .from('chat_messages')
      .insert({
        client_id: cc.id,
        role: 'user',
        content: selectedLabel,
        message_type: 'quick_reply',
        parent_message_id: parsed.data.message_id,
        metadata: { key: 'checkin_ready', action: 'mark_answered' },
        created_at: now,
      })
      .select('id, role, content, message_type, metadata, created_at')
      .single()

    if (persisted) insertedMessages.push(persisted as typeof insertedMessages[number])
  }

  return NextResponse.json({
    metadata: updated?.metadata,
    deferred_until: meta.deferred_until ?? null,
    messages: insertedMessages,
  })
}
