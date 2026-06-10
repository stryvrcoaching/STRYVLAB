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

async function resolveProtocol(coachId: string, clientId: string, protocolId: string) {
  const db = serviceClient()
  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  if (!cc) return null

  const { data } = await db
    .from('nutrition_protocols')
    .select(`*, days:nutrition_protocol_days(*), schedule_slots:nutrition_protocol_schedule_slots(*)`)
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .single()
  if (!data) return null

  return {
    ...data,
    days: (data.days ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
    schedule_slots: (data.schedule_slots ?? []).sort(
      (a: { week_index: number; dow: number }, b: { week_index: number; dow: number }) =>
        a.week_index - b.week_index || a.dow - b.dow,
    ),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; protocolId: string }> }
) {
  const { clientId, protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const protocol = await resolveProtocol(user.id, clientId, protocolId)
  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ protocol })
}

const updateDaySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  position: z.number().int().min(0),
  calories: z.number().nullable().optional(),
  protein_g: z.number().nullable().optional(),
  carbs_g: z.number().nullable().optional(),
  fat_g: z.number().nullable().optional(),
  hydration_ml: z.number().int().nullable().optional(),
  carb_cycle_type: z.enum(['high', 'medium', 'low']).nullable().optional(),
  cycle_sync_phase: z.enum(['follicular', 'ovulatory', 'luteal', 'menstrual']).nullable().optional(),
  recommendations: z.string().nullable().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycle_sync_enabled: z.boolean().optional(),
  tdee_auto_enabled: z.boolean().optional(),
  tdee_adaptive_active: z.boolean().optional(),
  tdee_reference: z.number().int().positive().optional(),
  schedule_slots: z.array(z.object({
    week_index: z.number().int().min(1).max(4),
    dow: z.number().int().min(1).max(7),
    protocol_day_position: z.number().int().min(0),
  })).optional(),
  days: z.array(updateDaySchema).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; protocolId: string }> }
) {
  const { clientId, protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await resolveProtocol(user.id, clientId, protocolId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = updateSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  if (body.data.name !== undefined || body.data.notes !== undefined || body.data.schedule_start_date !== undefined || body.data.cycle_sync_enabled !== undefined || body.data.tdee_auto_enabled !== undefined) {
    const updates: Record<string, unknown> = {}
    if (body.data.name !== undefined) updates.name = body.data.name
    if (body.data.notes !== undefined) updates.notes = body.data.notes
    if (body.data.schedule_start_date !== undefined) updates.schedule_start_date = body.data.schedule_start_date
    if (body.data.cycle_sync_enabled !== undefined) updates.cycle_sync_enabled = body.data.cycle_sync_enabled
    if (body.data.tdee_auto_enabled !== undefined) updates.tdee_auto_enabled = body.data.tdee_auto_enabled
    if (body.data.tdee_adaptive_active !== undefined) updates.tdee_adaptive_active = body.data.tdee_adaptive_active
    if (body.data.tdee_reference !== undefined) updates.tdee_reference = body.data.tdee_reference
    await db.from('nutrition_protocols').update(updates).eq('id', protocolId)
  }

  if (body.data.days !== undefined) {
    await db.from('nutrition_protocol_days').delete().eq('protocol_id', protocolId)
    const daysToInsert = body.data.days.map(d => ({
      protocol_id: protocolId,
      name: d.name,
      position: d.position,
      calories: d.calories ?? null,
      protein_g: d.protein_g ?? null,
      carbs_g: d.carbs_g ?? null,
      fat_g: d.fat_g ?? null,
      hydration_ml: d.hydration_ml ?? null,
      carb_cycle_type: d.carb_cycle_type ?? null,
      cycle_sync_phase: d.cycle_sync_phase ?? null,
      recommendations: d.recommendations ?? null,
    }))
    await db.from('nutrition_protocol_days').insert(daysToInsert)
  }

  if (body.data.schedule_slots !== undefined) {
    await db.from('nutrition_protocol_schedule_slots').delete().eq('protocol_id', protocolId)
    if (body.data.schedule_slots.length > 0) {
      const slotsToInsert = body.data.schedule_slots.map((slot) => ({
        protocol_id: protocolId,
        week_index: slot.week_index,
        dow: slot.dow,
        protocol_day_position: slot.protocol_day_position,
      }))
      await db.from('nutrition_protocol_schedule_slots').insert(slotsToInsert)
    }
  }

  const updated = await resolveProtocol(user.id, clientId, protocolId)
  return NextResponse.json({ protocol: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string; protocolId: string }> }
) {
  const { clientId, protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await resolveProtocol(user.id, clientId, protocolId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = serviceClient()

  // Remove metric annotations created when this protocol was shared
  await db
    .from('metric_annotations')
    .delete()
    .eq('source_id', protocolId)
    .eq('client_id', clientId)

  await db.from('nutrition_protocols').delete().eq('id', protocolId)

  return NextResponse.json({ success: true })
}
