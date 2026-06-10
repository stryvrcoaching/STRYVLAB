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
  board_id: z.string().uuid(),
  title: z.string().min(1).max(100),
})

const updateSchema = z.object({
  title: z.string().min(1).max(100),
})

// GET /api/organisation/columns?boardId=... — list columns for a board
export async function GET(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const boardId = searchParams.get('boardId')
  if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db
    .from('kanban_columns')
    .select('*')
    .eq('board_id', boardId)
    .eq('coach_id', user.id)
    .order('order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/organisation/columns — add a column to a board
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  // Determine max order in board
  const { data: existing } = await db
    .from('kanban_columns')
    .select('order')
    .eq('board_id', body.data.board_id)
    .eq('coach_id', user.id)
    .order('order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].order + 1 : 0

  const { data, error } = await db
    .from('kanban_columns')
    .insert({
      coach_id: user.id,
      board_id: body.data.board_id,
      title: body.data.title,
      order: nextOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/organisation/columns?id=... — rename a column
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
  const { data, error } = await db
    .from('kanban_columns')
    .update({ title: body.data.title })
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/organisation/columns?id=... — delete a column (moves tasks to first remaining)
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = serviceClient()

  // Find the column to get its board_id
  const { data: col } = await db
    .from('kanban_columns')
    .select('board_id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (!col) return NextResponse.json({ error: 'Column not found' }, { status: 404 })

  // Find remaining columns in same board
  const { data: remaining } = await db
    .from('kanban_columns')
    .select('id')
    .eq('board_id', col.board_id)
    .eq('coach_id', user.id)
    .neq('id', id)
    .order('order', { ascending: true })

  if (!remaining || remaining.length === 0) {
    return NextResponse.json({ error: 'Impossible de supprimer la dernière colonne' }, { status: 400 })
  }

  // Move tasks to first remaining column
  await db
    .from('kanban_tasks')
    .update({ column_id: remaining[0].id })
    .eq('column_id', id)
    .eq('coach_id', user.id)

  const { error } = await db
    .from('kanban_columns')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
