import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'

const postSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
})

async function getCoachAndVerifyOwnership(
  db: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  exerciseId: string,
) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  // Verify the exercise belongs to a template owned by this coach
  const { data } = await db
    .from('coach_program_template_exercises')
    .select(`
      id,
      coach_program_template_sessions!inner (
        coach_program_templates!inner ( coach_id )
      )
    `)
    .eq('id', exerciseId)
    .single()

  if (!data) return null
  // Supabase returns a FK many-to-one relation as an object, not an array
  const session = (data as any).coach_program_template_sessions
  const coachId = session?.coach_program_templates?.coach_id
  if (coachId !== user.id) return null
  return user
}

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('coach_template_exercise_alternatives')
    .select('id, name, notes, position')
    .eq('exercise_id', params.exerciseId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const user = await getCoachAndVerifyOwnership(db, params.templateId, params.exerciseId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = postSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  // Enforce max 3 alternatives
  const { count } = await db
    .from('coach_template_exercise_alternatives')
    .select('id', { count: 'exact', head: true })
    .eq('exercise_id', params.exerciseId)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 alternatives par exercice' }, { status: 422 })
  }

  const { data, error } = await db
    .from('coach_template_exercise_alternatives')
    .insert({
      exercise_id: params.exerciseId,
      name: body.data.name,
      notes: body.data.notes ?? null,
      position: count ?? 0,
    })
    .select('id, name, notes, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const user = await getCoachAndVerifyOwnership(db, params.templateId, params.exerciseId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const alternativeId = searchParams.get('id')
  if (!alternativeId) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await db
    .from('coach_template_exercise_alternatives')
    .delete()
    .eq('id', alternativeId)
    .eq('exercise_id', params.exerciseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
