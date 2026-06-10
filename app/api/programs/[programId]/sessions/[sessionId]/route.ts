import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { programId: string; sessionId: string } }

// PATCH /api/programs/[programId]/sessions/[sessionId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: program } = await service()
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const body = await req.json()
  const { name, day_of_week, position, notes } = body

  const { data, error } = await service()
    .from('program_sessions')
    .update({ name, day_of_week, position, notes })
    .eq('id', params.sessionId)
    .eq('program_id', params.programId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

// DELETE /api/programs/[programId]/sessions/[sessionId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: program } = await service()
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const { error } = await service()
    .from('program_sessions')
    .delete()
    .eq('id', params.sessionId)
    .eq('program_id', params.programId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
