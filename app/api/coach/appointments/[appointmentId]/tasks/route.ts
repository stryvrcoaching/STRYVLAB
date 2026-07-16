/**
 * POST /api/coach/appointments/[appointmentId]/tasks
 *
 * Crée une tâche Kanban de préparation ou de suivi liée à un rendez-vous.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const TaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  board_id: z.string().uuid().optional(),
  column_id: z.string().uuid().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  note: z.string().trim().max(2000).optional(),
})

type RouteContext = { params: { appointmentId: string } }

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const parsed = TaskSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const db = service()

  // Vérifie que le rendez-vous appartient au coach
  const { data: appt, error: apptErr } = await db
    .from('coaching_appointments')
    .select('id, client_id')
    .eq('id', params.appointmentId)
    .eq('coach_id', user.id)
    .single()

  if (apptErr || !appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = parsed.data

  // Résolution du board / colonne cible
  let boardId = body.board_id
  let columnId = body.column_id

  if (!boardId || !columnId) {
    const { data: target } = await db
      .from('kanban_boards')
      .select('id, kanban_columns(id)')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    boardId = boardId ?? target?.id
    columnId = columnId ?? (target as any)?.kanban_columns?.[0]?.id
  }

  if (!boardId || !columnId) {
    return NextResponse.json({ error: 'No kanban board or column available' }, { status: 400 })
  }

  // Vérifie que le board appartient au coach
  const { data: board } = await db
    .from('kanban_boards')
    .select('id')
    .eq('id', boardId)
    .eq('coach_id', user.id)
    .single()

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const { data: task, error: taskErr } = await db
    .from('kanban_tasks')
    .insert({
      board_id: boardId,
      column_id: columnId,
      title: body.title,
      description: body.note ?? null,
      client_id: appt.client_id,
      appointment_id: params.appointmentId,
      priority: body.priority,
    })
    .select('id')
    .single()

  if (taskErr || !task) {
    console.error('[appointments/tasks] insert error', taskErr)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, taskId: task.id }, { status: 201 })
}
