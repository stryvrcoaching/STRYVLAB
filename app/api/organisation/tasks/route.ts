import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const createSchema = z.object({
  board_id:        z.string().uuid(),
  column_id:       z.string().uuid(),
  title:           z.string().min(1).max(500),
  description:     z.string().max(2000).optional().nullable(),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  priority:        z.enum(['high', 'medium', 'low']).default('medium'),
  linked_event_id: z.string().uuid().optional().nullable(),
})

const updateSchema = z.object({
  column_id:       z.string().uuid().optional(),
  title:           z.string().min(1).max(500).optional(),
  description:     z.string().max(2000).optional().nullable(),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  priority:        z.enum(['high', 'medium', 'low']).optional(),
  order:           z.number().int().optional(),
  is_completed:    z.boolean().optional(),
  linked_event_id: z.string().uuid().optional().nullable(),
})

// GET /api/organisation/tasks?boardId=... — list tasks for a board
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const boardId = searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db
    .from('kanban_tasks')
    .select('*')
    .eq('board_id', boardId)
    .eq('coach_id', user.id)
    .order('order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/organisation/tasks — create a task
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  // Determine order in column
  const { data: existing } = await db
    .from('kanban_tasks')
    .select('order')
    .eq('column_id', body.data.column_id)
    .eq('coach_id', user.id)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].order + 1 : 0

  const { data, error } = await db
    .from('kanban_tasks')
    .insert({
      coach_id:    user.id,
      board_id:    body.data.board_id,
      column_id:   body.data.column_id,
      title:       body.data.title,
      description: body.data.description ?? null,
      due_date:    body.data.due_date ?? null,
      priority:    body.data.priority,
      order:       nextOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/organisation/tasks?id=... — update a task (move column, rename, complete, etc.)
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = updateSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  // Build update payload — only send new sync columns if explicitly provided
  const { is_completed, linked_event_id, ...coreFields } = body.data
  const updatePayload: Record<string, unknown> = { ...coreFields }
  if (is_completed !== undefined)    updatePayload.is_completed    = is_completed
  if (linked_event_id !== undefined) updatePayload.linked_event_id = linked_event_id

  const { data, error } = await db
    .from('kanban_tasks')
    .update(updatePayload)
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror is_completed to linked agenda event
  if (body.data.is_completed !== undefined && data.linked_event_id) {
    await db
      .from('agenda_events')
      .update({ is_completed: body.data.is_completed })
      .eq('id', data.linked_event_id)
  }

  return NextResponse.json(data)
}

// DELETE /api/organisation/tasks?id=... — delete a task
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = serviceClient()
  const { error } = await db
    .from('kanban_tasks')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
