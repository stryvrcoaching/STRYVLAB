import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest, context: { params: Promise<{ priorityKey: string }> }) {
  const { priorityKey } = await context.params
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const clientId = String(body?.clientId ?? '')
  const kind = String(body?.kind ?? 'planned_follow_up')
  const actionTaken = String(body?.actionTaken ?? 'mark_treated')

  if (!priorityKey || !clientId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const db = serviceClient()
  await db.from('coach_client_priority_states').upsert({
    coach_id: user.id,
    client_id: clientId,
    priority_key: priorityKey,
    kind,
    state: 'treated',
    action_taken: actionTaken,
    metadata: { sourceFingerprint: priorityKey },
    treated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true, state: 'treated' })
}
