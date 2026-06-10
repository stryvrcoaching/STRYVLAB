import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getClientId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  return cc?.id ?? null
}

async function getUserId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Legacy notifications use 'legacy_<uuid>' prefix
  if (params.id.startsWith('legacy_')) {
    const realId = params.id.replace('legacy_', '')
    await svc().from('client_notifications').update({ read: true }).eq('id', realId).eq('target_user_id', userId)
    return NextResponse.json({ ok: true })
  }

  const clientId = await getClientId()
  if (!clientId) return NextResponse.json({ ok: true })

  const { error } = await svc()
    .from('coach_client_notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (params.id.startsWith('legacy_')) {
    const realId = params.id.replace('legacy_', '')
    await svc().from('client_notifications').delete().eq('id', realId).eq('target_user_id', userId)
    return NextResponse.json({ ok: true })
  }

  const clientId = await getClientId()
  if (!clientId) return NextResponse.json({ ok: true })

  const { error } = await svc()
    .from('coach_client_notifications')
    .delete()
    .eq('id', params.id)
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
