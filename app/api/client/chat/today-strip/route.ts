
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildChatTodayStrip } from '@/lib/client/chat/today-strip'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, timezone')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  const todayStrip = await buildChatTodayStrip(
    db,
    cc.id as string,
    (cc as { timezone?: string | null }).timezone ?? null,
  )
  return NextResponse.json(todayStrip)
}
