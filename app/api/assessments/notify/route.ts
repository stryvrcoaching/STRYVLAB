import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/assessments/notify — liste les notifications non lues du coach
export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Only fetch notifications intended for the coach (not client-facing ones)
  const COACH_NOTIFICATION_TYPES = ['assessment_completed', 'session_reminder']

  const { data, error } = await serviceClient()
    .from('client_notifications')
    .select('*')
    .eq('coach_id', user.id)
    .in('type', COACH_NOTIFICATION_TYPES)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notifications: data })
}

// PATCH /api/assessments/notify — marquer des notifications comme lues
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { ids } = await req.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids est obligatoire' }, { status: 400 })
  }

  const { error } = await serviceClient()
    .from('client_notifications')
    .update({ read: true })
    .in('id', ids)
    .eq('coach_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
