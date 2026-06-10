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
  title: z.string().min(1).max(100),
})

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  order: z.number().int().optional(),
})

// GET /api/organisation/boards — list all boards for the coach
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      console.error('[boards GET] auth:', authErr.message)
      return NextResponse.json({ error: 'Auth error' }, { status: 401 })
    }
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = serviceClient()
    const { data, error } = await db
      .from('kanban_boards')
      .select('*')
      .eq('coach_id', user.id)
      .order('order', { ascending: true })

    if (error) {
      console.error('[boards GET] db:', JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[boards GET] uncaught:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST /api/organisation/boards — create a board (max 10) + seed 3 default columns
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  // Enforce max 10 boards per coach
  const { count } = await db
    .from('kanban_boards')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Maximum 10 tableaux autorisés' }, { status: 400 })
  }

  const { data: board, error: boardErr } = await db
    .from('kanban_boards')
    .insert({ coach_id: user.id, title: body.data.title })
    .select()
    .single()

  if (boardErr) return NextResponse.json({ error: boardErr.message }, { status: 500 })

  // Seed 3 default columns
  const defaultColumns = [
    { coach_id: user.id, board_id: board.id, title: 'À faire', order: 0 },
    { coach_id: user.id, board_id: board.id, title: 'En cours', order: 1 },
    { coach_id: user.id, board_id: board.id, title: 'Terminé', order: 2 },
  ]
  await db.from('kanban_columns').insert(defaultColumns)

  return NextResponse.json(board, { status: 201 })
}

// PATCH /api/organisation/boards?id=... — rename or reorder a board
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = patchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db
    .from('kanban_boards')
    .update(body.data)
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/organisation/boards?id=... — delete a board (min 1 must remain)
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = serviceClient()

  const { count } = await db
    .from('kanban_boards')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', user.id)

  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Impossible de supprimer le dernier tableau' }, { status: 400 })
  }

  const { error } = await db
    .from('kanban_boards')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
