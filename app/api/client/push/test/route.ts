import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { sendClientPush } from '@/lib/notifications/send-client-push'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { getClientPushCopy } from '@/lib/notifications/client-push-copy'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: pushClient } = await db
    .from('coach_clients')
    .select('push_token')
    .eq('id', client.id)
    .maybeSingle()
  const missingEnv = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']
    .filter((key) => !process.env[key])

  if (!pushClient?.push_token) {
    return NextResponse.json({ sent: false, reason: 'missing_subscription' }, { status: 503 })
  }
  if (missingEnv.length > 0) {
    return NextResponse.json({ sent: false, reason: 'missing_server_env', missingEnv }, { status: 503 })
  }

  const lang = await resolveClientLanguage(db, client.id)
  const pushCopy = getClientPushCopy('push.enabled', lang)

  const sent = await sendClientPush(db, client.id, 'system', {
    title: pushCopy.title,
    body: pushCopy.body,
    url: '/client',
    tag: `stryv-push-test-${Date.now()}`,
  }, { bypassPreference: true })

  return NextResponse.json({ sent, reason: sent ? 'ok' : 'web_push_rejected' }, { status: sent ? 200 : 503 })
}
