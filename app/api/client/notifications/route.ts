import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { listClientNotificationItems } from '@/lib/client/inbox'
import { getMarkableNotificationIds } from '@/lib/client/notificationBuckets'

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

const markReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).max(100).optional(),
})

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

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = markReadSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const clientId = await getClientId(user.id)
  if (!clientId) return NextResponse.json({ ok: true })

  let candidatesQuery = svc()
    .from('coach_client_notifications')
    .select('id, type, payload')
    .eq('client_id', clientId)
    .is('read_at', null)
    .is('dismissed_at', null)

  if (parsed.data.notificationIds?.length) {
    candidatesQuery = candidatesQuery.in('id', parsed.data.notificationIds)
  }

  const { data: candidates, error } = await candidatesQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // "Tout marquer comme lu" never hides an outstanding task. A payment,
  // pending bilan or appointment only leaves the centre after its real action
  // is completed elsewhere in the product.
  const idsToMarkRead = getMarkableNotificationIds(
    (candidates ?? []).map((notification) => ({
      id: notification.id,
      type: notification.type,
      payload: (notification.payload ?? null) as Record<string, unknown> | null,
    })),
  )

  if (idsToMarkRead.length > 0) {
    const { error: updateError } = await svc()
      .from('coach_client_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .is('dismissed_at', null)
      .is('read_at', null)
      .in('id', idsToMarkRead)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  revalidatePath('/client')
  revalidatePath('/client/profil')
  return NextResponse.json({ ok: true, markedReadIds: idsToMarkRead })
}
