import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'
import { callLLM } from '@/lib/llm/callLLM'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json()
  const content = String(body.content ?? '').trim().slice(0, 500)
  if (!content) return NextResponse.json({ error: 'Empty message content' }, { status: 400 })

  // Verify message belongs to user and is role user
  const { data: userMsg, error: getErr } = await db
    .from('chat_messages')
    .select('id, role, message_type, created_at')
    .eq('id', messageId)
    .eq('client_id', cc.id)
    .eq('role', 'user')
    .is('archived_at', null)
    .single()

  if (getErr || !userMsg) {
    return NextResponse.json({ error: 'Message not found or not editable' }, { status: 404 })
  }

  // Update message content
  const { data: updatedUserMsg } = await db
    .from('chat_messages')
    .update({ content })
    .eq('id', messageId)
    .select('id, role, content, message_type, metadata, seen_at, created_at')
    .single()

  // Archive old bot responses
  await db
    .from('chat_messages')
    .update({ archived_at: new Date().toISOString() })
    .eq('parent_message_id', messageId)
    .eq('role', 'assistant')

  // Re-trigger LLM if enabled
  const coachId = (cc as any).coach_id as string | null
  let llmEnabled = false

  if (coachId) {
    const [{ data: coachProfile }, { data: clientSettings }] = await Promise.all([
      db.from('coach_profiles').select('has_ai_llm').eq('coach_id', coachId).maybeSingle(),
      db.from('coach_ai_settings_per_client').select('ai_llm_enabled').eq('coach_id', coachId).eq('client_id', cc.id).maybeSingle(),
    ])
    llmEnabled = (coachProfile?.has_ai_llm ?? false) && (clientSettings?.ai_llm_enabled ?? false)
  }

  if (!llmEnabled) {
    await db.from('chat_messages').update({ requires_coach_response: true, coach_response_reason: 'llm_disabled' }).eq('id', messageId)
    return NextResponse.json({ userMessage: updatedUserMsg, botMessage: null, llmDisabled: true })
  }

  // Fetch history (up to the edited message)
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .lt('created_at', userMsg.created_at) // Only messages before this one
    .order('created_at', { ascending: false })
    .limit(20)

  const systemPrompt = await buildSystemPrompt(cc.id)

  const llmResult = await callLLM({
    systemPrompt,
    userMessage: content,
    conversationHistory: (history ?? []).reverse().map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content) })),
    clientId: cc.id as string,
    coachId: coachId ?? undefined,
    chatMessageId: messageId,
    maxTokens: 300,
  })

  let botMsg = null
  if (llmResult) {
    const { data: inserted } = await db
      .from('chat_messages')
      .insert({
        client_id: cc.id,
        role: 'assistant',
        content: llmResult.content,
        message_type: 'text',
        parent_message_id: messageId,
        trace_id: llmResult.traceId || null,
      })
      .select('id, role, content, message_type, metadata, seen_at, created_at')
      .single()
    botMsg = inserted
  }

  return NextResponse.json({ userMessage: updatedUserMsg, botMessage: botMsg })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Archive user message
  const { data: deleted, error } = await db
    .from('chat_messages')
    .update({ archived_at: now })
    .eq('id', messageId)
    .eq('client_id', cc.id)
    .eq('role', 'user')
    .select('id')
    .single()

  if (error || !deleted) {
    return NextResponse.json({ error: 'Message not found or already deleted' }, { status: 404 })
  }

  // Archive associated bot responses
  await db
    .from('chat_messages')
    .update({ archived_at: now })
    .eq('parent_message_id', messageId)
    .eq('role', 'assistant')

  return NextResponse.json({ success: true })
}
