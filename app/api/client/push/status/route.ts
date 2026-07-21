import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { isClientAppEnabledForCoach } from '@/lib/billing/assertClientAppEnabled'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type PushDelivery = {
  status?: 'sent' | 'failed'
  attempted_at?: string
  kind?: string
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [{ data: pushClient }, { data: latestReminder }] = await Promise.all([
    db
      .from('coach_clients')
      .select('push_token, coach_id')
      .eq('id', client.id)
      .maybeSingle(),
    db
      .from('coach_client_notifications')
      .select('payload, created_at')
      .eq('client_id', client.id)
      .eq('type', 'system_reminder')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const subscription = Boolean(pushClient?.push_token)
  const serverReady = Boolean(
    process.env.VAPID_PUBLIC_KEY
    && process.env.VAPID_PRIVATE_KEY
    && process.env.VAPID_SUBJECT,
  )
  const clientAppEnabled = Boolean(
    pushClient?.coach_id
    && await isClientAppEnabledForCoach(db, pushClient.coach_id),
  )
  const payload = (latestReminder?.payload ?? {}) as { push_delivery?: PushDelivery }

  return NextResponse.json({
    subscription,
    serverReady,
    clientAppEnabled,
    latestScheduledDelivery: payload.push_delivery
      ? { ...payload.push_delivery, created_at: latestReminder?.created_at }
      : null,
  })
}
