import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()
  const { data: client } = await db.from('coach_clients')
    .select('id').eq('id', params.clientId).eq('coach_id', user.id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data, error } = await db.from('client_exercise_notes')
    .select('exercise_key, exercise_name, body, updated_at')
    .eq('client_id', client.id).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data ?? [] })
}
