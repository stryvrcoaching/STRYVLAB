import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  week_type: z.enum(['base', 'build', 'overload', 'deload', 'peak', 'custom']).optional(),
}).refine((value) => value.label !== undefined || value.week_type !== undefined)

type Params = { params: { programId: string; weekId: string } }

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authorizeProgram(programId: string) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié', status: 401 } as const

  const db = service()
  const { data: program } = await db
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!program) return { error: 'Programme introuvable', status: 404 } as const
  return { db } as const
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authorization = await authorizeProgram(params.programId)
  if ('error' in authorization) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Modification de semaine invalide' }, { status: 400 })
  }

  const { data, error } = await authorization.db
    .from('program_weeks')
    .update(parsed.data)
    .eq('id', params.weekId)
    .eq('program_id', params.programId)
    .select('id, program_id, position, label, week_type, source_week_id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Semaine introuvable' }, { status: 404 })
  return NextResponse.json({ week: data })
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const authorization = await authorizeProgram(params.programId)
  if ('error' in authorization) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const { db } = authorization
  const { data: weeks, error: weeksError } = await db
    .from('program_weeks')
    .select('id, position')
    .eq('program_id', params.programId)
    .order('position', { ascending: true })

  if (weeksError) return NextResponse.json({ error: weeksError.message }, { status: 500 })
  const targetWeek = (weeks ?? []).find((week) => week.id === params.weekId)
  if (!targetWeek) return NextResponse.json({ error: 'Semaine introuvable' }, { status: 404 })
  if ((weeks ?? []).length <= 1) {
    return NextResponse.json({ error: 'Un programme doit conserver au moins une semaine' }, { status: 400 })
  }

  const { data: historicalLogs, error: logsError } = await db
    .from('client_session_logs')
    .select('id')
    .eq('program_week_id', params.weekId)
    .limit(1)

  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })
  if ((historicalLogs ?? []).length > 0) {
    return NextResponse.json({
      error: 'Cette semaine possède déjà un historique client et ne peut pas être supprimée',
    }, { status: 409 })
  }

  const deleteResult = await db
    .from('program_weeks')
    .delete()
    .eq('id', params.weekId)
    .eq('program_id', params.programId)

  if (deleteResult.error) return NextResponse.json({ error: deleteResult.error.message }, { status: 500 })

  const remaining = (weeks ?? []).filter((week) => week.id !== params.weekId)
  for (let position = 0; position < remaining.length; position += 1) {
    if (remaining[position].position === position) continue
    const reorderResult = await db
      .from('program_weeks')
      .update({ position })
      .eq('id', remaining[position].id)
      .eq('program_id', params.programId)
    if (reorderResult.error) {
      return NextResponse.json({ error: reorderResult.error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
