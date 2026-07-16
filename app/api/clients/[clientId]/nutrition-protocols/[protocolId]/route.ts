import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { upsertProtocolUpdatedAnnotation } from '@/lib/nutrition/protocolAnnotations'
import { closeNutritionProtocolAssignment } from '@/lib/assignments/clientAssignments'
import { inferNutritionDayRole } from '@/lib/nutrition/day-role'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { setClientTdeeAutoEnabled } from '@/lib/nutrition/tdee-state'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isMissingNutritionProtocolDayRoleColumnError(error: { message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    message.includes("could not find the 'role' column") &&
    message.includes('nutrition_protocol_days')
  ) || (
    message.includes('nutrition_protocol_days') &&
    message.includes('schema cache') &&
    message.includes('role')
  )
}

const cycleSyncProfileSchema = z.object({
  mode: z.enum(['conservative', 'standard', 'custom']).optional().default('standard'),
  intensity_percent: z.number().int().min(25).max(125).optional().default(100),
})

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
  name: z.string().min(1).max(200).optional(),
  position: z.number().int().min(0).optional(),
  calories: z.number().nullable().optional(),
  protein_g: z.number().nullable().optional(),
  carbs_g: z.number().nullable().optional(),
  fat_g: z.number().nullable().optional(),
  hydration_ml: z.number().int().nullable().optional(),
  role: z.enum(['training', 'rest', 'neutral']).optional(),
  carb_cycle_type: z.enum(['high', 'medium', 'low']).nullable().optional(),
  cycle_sync_phase: z.enum(['follicular', 'ovulatory', 'luteal', 'menstrual']).nullable().optional(),
  recommendations: z.string().nullable().optional(),
  meal_plan: z.array(z.object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(80),
    items: z.array(z.object({
      id: z.string().min(1).max(120),
      quantity_g: z.number().positive().max(10000),
      cycle_adjustment: z.object({
        locked: z.boolean().optional(),
        priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        min_quantity_g: z.number().min(1).max(10000).optional(),
        max_quantity_g: z.number().min(1).max(10000).optional(),
      }).optional(),
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
  })).max(12).optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycle_sync_enabled: z.boolean().optional(),
  cycle_sync_profile: cycleSyncProfileSchema.optional(),
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
  const shouldLogProtocolUpdate =
    existing.status === 'shared' &&
    (
      body.data.name !== undefined ||
      body.data.notes !== undefined ||
      body.data.schedule_start_date !== undefined ||
      body.data.cycle_sync_enabled !== undefined ||
      body.data.cycle_sync_profile !== undefined ||
      body.data.days !== undefined ||
      body.data.schedule_slots !== undefined
    )

  if (body.data.name !== undefined || body.data.notes !== undefined || body.data.schedule_start_date !== undefined || body.data.cycle_sync_enabled !== undefined || body.data.cycle_sync_profile !== undefined || body.data.tdee_auto_enabled !== undefined || body.data.tdee_adaptive_active !== undefined || body.data.tdee_reference !== undefined) {
    const updates: Record<string, unknown> = {}
    if (body.data.name !== undefined) updates.name = body.data.name
    if (body.data.notes !== undefined) updates.notes = body.data.notes
    if (body.data.schedule_start_date !== undefined) updates.schedule_start_date = body.data.schedule_start_date
    if (body.data.cycle_sync_enabled !== undefined) updates.cycle_sync_enabled = body.data.cycle_sync_enabled
    if (body.data.cycle_sync_profile !== undefined) updates.cycle_sync_profile = body.data.cycle_sync_profile
    if (body.data.tdee_auto_enabled !== undefined) updates.tdee_auto_enabled = body.data.tdee_auto_enabled
    if (body.data.tdee_adaptive_active !== undefined) updates.tdee_adaptive_active = body.data.tdee_adaptive_active
    if (body.data.tdee_reference !== undefined) {
      updates.tdee_reference = body.data.tdee_reference
      updates.tdee_snapshot_source = 'manual'
      updates.tdee_snapshot_used_at = new Date().toISOString()
    }
    const { error } = await db.from('nutrition_protocols').update(updates).eq('id', protocolId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (body.data.tdee_auto_enabled !== undefined) {
      await setClientTdeeAutoEnabled(db as any, clientId, body.data.tdee_auto_enabled)
    }
  }

  if (body.data.days !== undefined) {
    const invalidDay = body.data.days.find((d) => !d.name || d.position === undefined)
    if (invalidDay) {
      return NextResponse.json(
        { error: 'Each protocol day requires name and position.' },
        { status: 400 },
      )
    }

    const remainingExistingDayIds = new Set(
      ((existing.days ?? []) as Array<{ id: string }>).map((day) => day.id),
    )

    for (const day of body.data.days) {
      const payload = {
        name: day.name!,
        position: day.position!,
        calories: day.calories ?? null,
        protein_g: day.protein_g ?? null,
        carbs_g: day.carbs_g ?? null,
        fat_g: day.fat_g ?? null,
        hydration_ml: day.hydration_ml ?? null,
        role: day.role ?? 'neutral',
        carb_cycle_type: day.carb_cycle_type ?? null,
        cycle_sync_phase: day.cycle_sync_phase ?? null,
        recommendations: day.recommendations ?? null,
        meal_plan: day.meal_plan ?? [],
      }

      if (day.id) {
        let { error } = await db
          .from('nutrition_protocol_days')
          .update(payload)
          .eq('protocol_id', protocolId)
          .eq('id', day.id)
        if (error && isMissingNutritionProtocolDayRoleColumnError(error)) {
          const { role, ...fallbackPayload } = payload
          const fallbackResult = await db
            .from('nutrition_protocol_days')
            .update(fallbackPayload)
            .eq('protocol_id', protocolId)
            .eq('id', day.id)
          error = fallbackResult.error
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        remainingExistingDayIds.delete(day.id)
      } else {
        let { error } = await db
          .from('nutrition_protocol_days')
          .insert({ protocol_id: protocolId, ...payload })
        if (error && isMissingNutritionProtocolDayRoleColumnError(error)) {
          const { role, ...fallbackPayload } = payload
          const fallbackResult = await db
            .from('nutrition_protocol_days')
            .insert({ protocol_id: protocolId, ...fallbackPayload })
          error = fallbackResult.error
        }
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    for (const dayId of Array.from(remainingExistingDayIds)) {
      const { error } = await db
        .from('nutrition_protocol_days')
        .delete()
        .eq('protocol_id', protocolId)
        .eq('id', dayId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (body.data.schedule_slots !== undefined) {
    const { error: deleteSlotsError } = await db
      .from('nutrition_protocol_schedule_slots')
      .delete()
      .eq('protocol_id', protocolId)
    if (deleteSlotsError) {
      return NextResponse.json({ error: deleteSlotsError.message }, { status: 500 })
    }
    if (body.data.schedule_slots.length > 0) {
      const slotsToInsert = body.data.schedule_slots.map((slot) => ({
        protocol_id: protocolId,
        week_index: slot.week_index,
        dow: slot.dow,
        protocol_day_position: slot.protocol_day_position,
      }))
      const { error } = await db.from('nutrition_protocol_schedule_slots').insert(slotsToInsert)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (shouldLogProtocolUpdate) {
    await upsertProtocolUpdatedAnnotation(db, {
      clientId,
      coachId: user.id,
      protocolId,
      protocolName: body.data.name ?? existing.name,
    })

    await createClientAppNotification(db, {
      clientId,
      coachId: user.id,
      type: 'program_updated',
      copyKey: 'nutrition.updated',
      actionUrl: '/client/nutrition',
      pushKind: 'program',
      pushTag: `stryv-nutrition-updated-${protocolId}`,
      payload: { protocol_id: protocolId },
    })
  }

  const updated = await resolveProtocol(user.id, clientId, protocolId)
  if (updated?.days) {
    updated.days = updated.days.map((day: any) => ({
      ...day,
      role: day.role ?? inferNutritionDayRole(day),
    }))
  }
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

  await closeNutritionProtocolAssignment(db, {
    clientId,
    protocolId,
    endedBy: user.id,
    reason: 'delete',
  })

  await db.from('nutrition_protocols').delete().eq('id', protocolId)

  return NextResponse.json({ success: true })
}
