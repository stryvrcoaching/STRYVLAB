import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  computePhysiologicalDateInTimezone,
  utcRangeForPhysiologicalDate,
} from '@/lib/client/checkin/timeWindows'
import {
  aggregateMealsByDate,
  buildNutritionProtocolCardAnalytics,
} from '@/lib/nutrition/protocol-card-analytics'
import {
  buildProtocolDateKeysForAnalytics,
} from '@/lib/nutrition/protocol-card-date-keys'
import { fetchActiveSmoothingPlanDaysForDates } from '@/lib/nutrition/smoothing/fetch'

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

  const db = serviceClient()
  const { data: ownedClient } = await db
    .from('coach_clients')
    .select('id, timezone')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!ownedClient) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await db
    .from('nutrition_protocols')
    .select(`*, days:nutrition_protocol_days(*), schedule_slots:nutrition_protocol_schedule_slots(*)`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const timezone = String((ownedClient as any).timezone ?? '').trim() || 'Europe/Paris'
  const today = computePhysiologicalDateInTimezone(new Date(), timezone)
  const protocolsBase = (data ?? []).map(p => ({
    ...p,
    days: (p.days ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
    schedule_slots: (p.schedule_slots ?? []).sort(
      (a: { week_index: number; dow: number }, b: { week_index: number; dow: number }) =>
        a.week_index - b.week_index || a.dow - b.dow,
    ),
  }))

  const protocolIds = protocolsBase.map((protocol) => protocol.id)
  const { data: assignments } = protocolIds.length > 0
    ? await db
        .from('client_nutrition_protocol_assignments')
        .select('protocol_id, started_at, ended_at')
        .eq('client_id', clientId)
        .in('protocol_id', protocolIds)
        .order('started_at', { ascending: false })
    : { data: [] as any[] }

  const latestAssignmentByProtocol = new Map<string, { started_at: string; ended_at: string | null }>()
  for (const assignment of assignments ?? []) {
    const protocolId = String((assignment as any).protocol_id)
    if (!latestAssignmentByProtocol.has(protocolId)) {
      latestAssignmentByProtocol.set(protocolId, {
        started_at: String((assignment as any).started_at),
        ended_at: ((assignment as any).ended_at as string | null) ?? null,
      })
    }
  }

  const protocolDateKeys = new Map<string, string[]>()
  for (const protocol of protocolsBase) {
    const assignment = latestAssignmentByProtocol.get(protocol.id)
    const keys = buildProtocolDateKeysForAnalytics({
      protocol,
      assignment,
      referenceDateKey: today,
      timezone,
    })
    if (keys.length > 0) protocolDateKeys.set(protocol.id, keys)
  }

  const allDateKeys = Array.from(new Set(Array.from(protocolDateKeys.values()).flat())).sort((a, b) => a.localeCompare(b))
  if (allDateKeys.length === 0) {
    return NextResponse.json({
      protocols: protocolsBase.map((protocol) => ({
        ...protocol,
        analytics: buildNutritionProtocolCardAnalytics({
          dateKeys: [],
          referenceDateKey: today,
          protocol,
          mealsByDate: new Map(),
          waterByDate: new Map(),
        }),
      })),
    })
  }

  const earliestRange = utcRangeForPhysiologicalDate(allDateKeys[0], timezone)
  const latestRange = utcRangeForPhysiologicalDate(allDateKeys[allDateKeys.length - 1], timezone)

  const [mealsResult, waterResult, smoothingDays] = await Promise.all([
    db
      .from('nutrition_meals')
      .select('physiological_date, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .eq('client_id', clientId)
      .in('physiological_date', allDateKeys),
    db
      .from('client_water_logs')
      .select('amount_ml, logged_at')
      .eq('client_id', clientId)
      .gte('logged_at', earliestRange.start.toISOString())
      .lte('logged_at', latestRange.end.toISOString()),
    fetchActiveSmoothingPlanDaysForDates(db as any, clientId, allDateKeys),
  ])

  const globalMealsByDate = aggregateMealsByDate((mealsResult.data ?? []) as any[])
  const globalWaterByDate = new Map<string, number>()
  for (const dateKey of allDateKeys) {
    const range = utcRangeForPhysiologicalDate(dateKey, timezone)
    const total = ((waterResult.data ?? []) as Array<{ amount_ml: number | null; logged_at: string }>)
      .filter((entry) => {
        const timestamp = new Date(entry.logged_at).getTime()
        return timestamp >= range.start.getTime() && timestamp <= range.end.getTime()
      })
      .reduce((sum, entry) => sum + Number(entry.amount_ml ?? 0), 0)
    globalWaterByDate.set(dateKey, total)
  }
  const smoothingDaysByDate = new Map(
    smoothingDays.map((day) => [day.date, day] as const),
  )

  const protocols = protocolsBase.map((protocol) => {
    const protocolDates = protocolDateKeys.get(protocol.id) ?? []
    const mealsByDate = new Map(
      Array.from(globalMealsByDate.entries()).filter(([date]) => protocolDates.includes(date))
    )
    const waterByDate = new Map(
      Array.from(globalWaterByDate.entries()).filter(([date]) => protocolDates.includes(date))
    )
    return {
      ...protocol,
      analytics: buildNutritionProtocolCardAnalytics({
        dateKeys: protocolDates,
        referenceDateKey: today,
        protocol,
        smoothingDaysByDate: protocol.status === 'shared' ? smoothingDaysByDate : undefined,
        mealsByDate,
        waterByDate,
      }),
    }
  })

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
  role: z.enum(['training', 'rest', 'neutral']).optional().default('neutral'),
  carb_cycle_type: z.enum(['high', 'medium', 'low']).nullable().optional(),
  cycle_sync_phase: z.enum(['follicular', 'ovulatory', 'luteal', 'menstrual']).nullable().optional(),
  recommendations: z.string().nullable().optional(),
  meal_plan: z.array(z.object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(80),
    items: z.array(z.object({
      id: z.string().min(1).max(120),
      quantity_g: z.number().positive().max(10000),
      food: z.object({
        id: z.string().uuid(),
        name_fr: z.string().min(1).max(240),
        category_l1: z.enum(['proteins', 'carbs', 'vegetables', 'fruits', 'fats', 'drinks', 'extras']),
        category_l2: z.string().nullable(),
        item_key: z.string().min(1).max(240),
        kcal_per_100g: z.number().min(0).max(1000),
        protein_per_100g: z.number().min(0).max(100),
        carbs_per_100g: z.number().min(0).max(100),
        fat_per_100g: z.number().min(0).max(100),
        fiber_per_100g: z.number().min(0).max(100),
        source: z.string().min(1).max(80),
        is_verified: z.boolean(),
      }),
      alternatives: z.array(z.object({
        id: z.string().min(1).max(120),
        quantity_g: z.number().positive().max(10000),
        food: z.object({
          id: z.string().uuid(),
          name_fr: z.string().min(1).max(240),
          category_l1: z.enum(['proteins', 'carbs', 'vegetables', 'fruits', 'fats', 'drinks', 'extras']),
          category_l2: z.string().nullable(),
          item_key: z.string().min(1).max(240),
          kcal_per_100g: z.number().min(0).max(1000),
          protein_per_100g: z.number().min(0).max(100),
          carbs_per_100g: z.number().min(0).max(100),
          fat_per_100g: z.number().min(0).max(100),
          fiber_per_100g: z.number().min(0).max(100),
          source: z.string().min(1).max(80),
          is_verified: z.boolean(),
        }),
      })).max(5),
    })).max(80),
  })).max(12).optional().default([]),
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
    role: d.role ?? 'neutral',
    carb_cycle_type: d.carb_cycle_type ?? null,
    cycle_sync_phase: d.cycle_sync_phase ?? null,
    recommendations: d.recommendations ?? null,
    meal_plan: d.meal_plan ?? [],
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
