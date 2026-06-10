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
  title:                 z.string().min(1).max(500),
  event_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time:            z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  event_time_end:        z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  description:           z.string().max(2000).optional().nullable(),
  priority:              z.enum(['high', 'medium', 'low']).default('medium'),
  client_id:             z.string().uuid().optional().nullable(),
  template_type:         z.string().max(100).optional().nullable(),
  notify_minutes_before: z.number().int().min(0).max(10080).optional().nullable(),
  linked_task_id:        z.string().uuid().optional().nullable(),
  // If provided, creates a linked task in the target board/column
  target_board_id:       z.string().uuid().optional(),
  target_column_id:      z.string().uuid().optional(),
})

const updateSchema = z.object({
  title:                 z.string().min(1).max(500).optional(),
  event_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  event_time:            z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  event_time_end:        z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  description:           z.string().max(2000).optional().nullable(),
  priority:              z.enum(['high', 'medium', 'low']).optional(),
  client_id:             z.string().uuid().optional().nullable(),
  template_type:         z.string().max(100).optional().nullable(),
  notify_minutes_before: z.number().int().min(0).max(10080).optional().nullable(),
  is_completed:          z.boolean().optional(),
  linked_task_id:        z.string().uuid().optional().nullable(),
  linked_column_title:   z.string().optional().nullable(),
})

// GET /api/organisation/events — list all events for the coach
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { data, error } = await db
    .from('agenda_events')
    .select('*')
    .eq('coach_id', user.id)
    .order('event_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/organisation/events — create an event (optionally linked to a new Kanban task)
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()
  const { target_board_id, target_column_id, ...eventFields } = body.data

  // Step 1 — insert the event (linked_task_id will be filled in step 3 if applicable)
  // Build insert payload — only include new sync columns if migration has been applied.
  // Core fields always present; extended fields added only when provided (non-undefined).
  const evInsert: Record<string, unknown> = {
    coach_id:   user.id,
    title:      eventFields.title,
    event_date: eventFields.event_date,
    event_time: eventFields.event_time ?? null,
    description: eventFields.description ?? null,
    priority:   eventFields.priority,
  }
  if (eventFields.event_time_end !== undefined)        evInsert.event_time_end        = eventFields.event_time_end ?? null
  if (eventFields.client_id !== undefined)             evInsert.client_id             = eventFields.client_id ?? null
  if (eventFields.template_type !== undefined)         evInsert.template_type         = eventFields.template_type ?? null
  if (eventFields.notify_minutes_before !== undefined) evInsert.notify_minutes_before = eventFields.notify_minutes_before ?? null
  if (eventFields.linked_task_id !== undefined)        evInsert.linked_task_id        = eventFields.linked_task_id ?? null

  const { data: event, error: evErr } = await db
    .from('agenda_events')
    .insert(evInsert)
    .select()
    .single()

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 })

  // Step 2 — if caller wants a linked task created, create it and cross-link
  if (target_board_id && target_column_id) {
    try {
      // Determine order in target column
      const { data: existing } = await db
        .from('kanban_tasks')
        .select('order')
        .eq('column_id', target_column_id)
        .eq('coach_id', user.id)
        .order('order', { ascending: false })
        .limit(1)
      const nextOrder = existing && existing.length > 0 ? existing[0].order + 1 : 0

      // Get column title for the tag
      const { data: colRow } = await db
        .from('kanban_columns')
        .select('title')
        .eq('id', target_column_id)
        .single()
      const colTitle = colRow?.title ?? null

      // Create the task with linked_event_id already set
      const { data: task, error: taskErr } = await db
        .from('kanban_tasks')
        .insert({
          coach_id:        user.id,
          board_id:        target_board_id,
          column_id:       target_column_id,
          title:           eventFields.title,
          description:     eventFields.description ?? null,
          due_date:        eventFields.event_date,
          priority:        eventFields.priority,
          order:           nextOrder,
          linked_event_id: event.id,
        })
        .select()
        .single()

      if (!taskErr && task) {
        // Step 3 — patch the event with linked_task_id and the column tag
        await db
          .from('agenda_events')
          .update({
            linked_task_id:      task.id,
            linked_column_title: colTitle,
          })
          .eq('id', event.id)

        return NextResponse.json(
          { ...event, linked_task_id: task.id, linked_column_title: colTitle },
          { status: 201 }
        )
      }
    } catch {
      // Task creation failed — event still usable, just unlinked
    }
  }

  return NextResponse.json(event, { status: 201 })
}

// PATCH /api/organisation/events?id=... — update an event
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

  // Build update payload — only send new sync columns if they were explicitly provided
  const { linked_task_id, linked_column_title, is_completed, event_time_end,
          client_id, template_type, notify_minutes_before, ...coreFields } = body.data
  const updatePayload: Record<string, unknown> = { ...coreFields }
  if (linked_task_id !== undefined)        updatePayload.linked_task_id        = linked_task_id
  if (linked_column_title !== undefined)   updatePayload.linked_column_title   = linked_column_title
  if (is_completed !== undefined)          updatePayload.is_completed          = is_completed
  if (event_time_end !== undefined)        updatePayload.event_time_end        = event_time_end
  if (client_id !== undefined)             updatePayload.client_id             = client_id
  if (template_type !== undefined)         updatePayload.template_type         = template_type
  if (notify_minutes_before !== undefined) updatePayload.notify_minutes_before = notify_minutes_before

  const { data, error } = await db
    .from('agenda_events')
    .update(updatePayload)
    .eq('id', id)
    .eq('coach_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror is_completed to linked task
  if (body.data.is_completed !== undefined && data.linked_task_id) {
    await db
      .from('kanban_tasks')
      .update({ is_completed: body.data.is_completed })
      .eq('id', data.linked_task_id)
  }

  return NextResponse.json(data)
}

// DELETE /api/organisation/events?id=... — delete an event
export async function DELETE(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = serviceClient()
  const { error } = await db
    .from('agenda_events')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
