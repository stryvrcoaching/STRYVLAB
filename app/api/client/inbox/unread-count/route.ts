import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { getClientInboxUnreadCount } from '@/lib/client/inbox'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await svc()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const counts = await getClientInboxUnreadCount(svc(), user.id, client?.id ?? null)
  return NextResponse.json(counts)
}
