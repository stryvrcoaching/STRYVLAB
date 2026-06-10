import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const DAILY_LIMIT = 20

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await resolveClientFromUser(
    user.id,
    user.email,
    svc(),
    'id, first_name'
  )
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = computePhysiologicalDate(new Date())
  const { data: usage } = await svc()
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', client.id)
    .eq('date', today)
    .maybeSingle()

  const used = usage?.message_count ?? 0
  const remaining = Math.max(0, DAILY_LIMIT - used)

  return NextResponse.json({
    remainingMessages: remaining,
    clientName: client.first_name ?? 'toi',
    contextReady: true,
  })
}
