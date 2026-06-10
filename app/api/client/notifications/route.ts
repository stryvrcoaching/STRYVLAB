import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { listClientNotificationItems } from '@/lib/client/inbox'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getClientId(userId: string): Promise<string | null> {
  const { data } = await svc().from('coach_clients').select('id').eq('user_id', userId).single()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'

  const clientId = await getClientId(user.id)
  const merged = await listClientNotificationItems(svc(), user.id, clientId, unreadOnly)

  return NextResponse.json({ notifications: merged })
}

export async function PATCH(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await getClientId(user.id)
  if (!clientId) return NextResponse.json({ ok: true })

  await svc()
    .from('coach_client_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('read_at', null)

  return NextResponse.json({ ok: true })
}
