import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  const { data: client, error } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email, gender, created_at')
    .eq('user_id', user.id)
    .single()

  if (error || !client) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  return NextResponse.json(client)
}
