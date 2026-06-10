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

async function ownershipCheck(coachId: string, clientId: string) {
  const db = serviceClient()
  const { data } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownershipCheck(user.id, clientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const db = serviceClient()
  const { data, error } = await db
    .from('nutrition_protocols')
    .select(`*, days:nutrition_protocol_days(*), schedule_slots:nutrition_protocol_schedule_slots(*)`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const protocols = (data ?? []).map(p => ({
    ...p,
    days: (p.days ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
    schedule_slots: (p.schedule_slots ?? []).sort(
      (a: { week_index: number; dow: number }, b: { week_index: number; dow: number }) =>
        a.week_index - b.week_index || a.dow - b.dow,
    ),
  }))

  return NextResponse.json({ protocols })
}

const daySchema = z.object({
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

const slotSchema = z.object({
  week_index: z.number().int().min(1).max(4),
  dow: z.number().int().min(1).max(7),
  protocol_day_position: z.number().int().min(0),
})

const createSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().optional().nullable(),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycle_sync_enabled: z.boolean().optional().default(false),
  days: z.array(daySchema).min(1),
  schedule_slots: z.array(slotSchema).optional().default([]),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownershipCheck(user.id, clientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  const { data: protocol, error: protoError } = await db
    .from('nutrition_protocols')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      name: body.data.name,
      notes: body.data.notes ?? null,
      schedule_start_date: body.data.schedule_start_date ?? new Date().toISOString().slice(0, 10),
      cycle_sync_enabled: body.data.cycle_sync_enabled ?? false,
    })
    .select('*')
    .single()

  if (protoError || !protocol) {
    return NextResponse.json({ error: protoError?.message ?? 'Failed to create protocol' }, { status: 500 })
  }

  const daysToInsert = body.data.days.map(d => ({
    protocol_id: protocol.id,
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

  const { data: days, error: daysError } = await db
    .from('nutrition_protocol_days')
    .insert(daysToInsert)
    .select('*')

  if (daysError) {
    return NextResponse.json({ error: daysError.message }, { status: 500 })
  }

  let slots: unknown[] = []
  if (body.data.schedule_slots.length > 0) {
    const { data: insertedSlots, error: slotsError } = await db
      .from('nutrition_protocol_schedule_slots')
      .insert(
        body.data.schedule_slots.map((slot) => ({
          protocol_id: protocol.id,
          week_index: slot.week_index,
          dow: slot.dow,
          protocol_day_position: slot.protocol_day_position,
        })),
      )
      .select('*')
    if (slotsError) return NextResponse.json({ error: slotsError.message }, { status: 500 })
    slots = insertedSlots ?? []
  }

  return NextResponse.json({ protocol: { ...protocol, days: days ?? [], schedule_slots: slots } }, { status: 201 })
}
