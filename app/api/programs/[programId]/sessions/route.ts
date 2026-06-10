import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { programId: string } }

// POST /api/programs/[programId]/sessions
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Verify ownership
  const { data: program } = await service()
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()

  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const body = await req.json()
  const { name, day_of_week, position, notes } = body
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  const { data, error } = await service()
    .from('program_sessions')
    .insert({ program_id: params.programId, name, day_of_week, position: position ?? 0, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data }, { status: 201 })
}
