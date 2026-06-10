import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { getClientInboxUnreadCount } from '@/lib/client/inbox'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const bodySchema = z.object({
  chatMessageIds: z.array(z.string().uuid()).optional().default([]),
  notificationIds: z.array(z.string()).optional().default([]),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const db = svc()
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const clientId = client?.id ?? null
  const now = new Date().toISOString()
  const { chatMessageIds, notificationIds } = parsed.data

  if (clientId && chatMessageIds.length > 0) {
    await db
      .from('chat_messages')
      .update({ seen_at: now })
      .eq('client_id', clientId)
      .eq('role', 'assistant')
      .is('archived_at', null)
      .is('seen_at', null)
      .in('id', chatMessageIds)
  }

  const legacyIds = notificationIds
    .filter((id) => id.startsWith('legacy_'))
    .map((id) => id.replace('legacy_', ''))

  if (legacyIds.length > 0) {
    await db
      .from('client_notifications')
      .update({ read: true })
      .eq('target_user_id', user.id)
      .eq('read', false)
      .in('id', legacyIds)
  }

  const coachIds = notificationIds.filter((id) => !id.startsWith('legacy_'))
  if (clientId && coachIds.length > 0) {
    await db
      .from('coach_client_notifications')
      .update({ read_at: now })
      .eq('client_id', clientId)
      .is('dismissed_at', null)
      .is('read_at', null)
      .in('id', coachIds)
  }

  const counts = await getClientInboxUnreadCount(db, user.id, clientId)
  return NextResponse.json(counts)
}
