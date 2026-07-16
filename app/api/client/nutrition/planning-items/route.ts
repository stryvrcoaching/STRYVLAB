export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { z } from "zod"
import {
  buildPrepEntries,
  createSupabaseService,
  resolveClientIdFromUserId,
  setPrepActivation,
} from "@/lib/nutrition/preps-service"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"

const slotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"])

const materializeSchema = z.object({
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().max(120).nullable().optional(),
  meal_type: slotSchema.optional(),
  meal_slot: slotSchema,
  variant_group_id: z.string().trim().min(1).max(180),
  scenario_key: z.string().trim().min(1).max(80).optional(),
  scenario_label: z.string().trim().min(1).max(80).optional(),
  is_active: z.boolean().optional(),
  planned_for: z.string().datetime().nullable().optional(),
  source_protocol_id: z.string().uuid(),
  source_day_position: z.number().int().min(0),
  source_meal_id: z.string().trim().min(1).max(120),
  source_snapshot: z.unknown().optional(),
  entries: z.array(z.object({
    food_item_id: z.string().uuid(),
    quantity_g: z.number().positive().max(5000),
  })).min(1).max(30),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientIdFromUserId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = materializeSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const prepared = await buildPrepEntries(body.data.entries)
  if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 404 })

  const sourceFilter = {
    client_id: clientId,
    physiological_date: body.data.physiological_date,
    source_type: "coach_plan",
    source_protocol_id: body.data.source_protocol_id,
    source_day_position: body.data.source_day_position,
    source_meal_id: body.data.source_meal_id,
  }

  const { data: existing } = await db
    .from("client_nutrition_preps")
    .select("id, status, consumed_meal_id")
    .match(sourceFilter)
    .neq("status", "cancelled")
    .maybeSingle()

  if (existing?.status === "logged") {
    return NextResponse.json({ error: "Planning item already logged" }, { status: 409 })
  }

  const payload = {
    client_id: clientId,
    physiological_date: body.data.physiological_date,
    title: body.data.title?.trim() || null,
    meal_type: body.data.meal_type ?? body.data.meal_slot,
    meal_slot: body.data.meal_slot,
    variant_group_id: body.data.variant_group_id.trim(),
    scenario_key: body.data.scenario_key?.trim() || "default",
    scenario_label: body.data.scenario_label?.trim() || "Planning",
    is_active: body.data.is_active ?? true,
    status: "planned",
    entries: prepared.entries,
    planned_for: body.data.planned_for ?? `${body.data.physiological_date}T12:00:00.000Z`,
    source_type: "coach_plan",
    source_protocol_id: body.data.source_protocol_id,
    source_day_position: body.data.source_day_position,
    source_meal_id: body.data.source_meal_id,
    source_snapshot: body.data.source_snapshot ?? null,
    ...prepared.totals,
  }

  const query = existing?.id
    ? db
        .from("client_nutrition_preps")
        .update(payload)
        .eq("id", existing.id)
        .eq("client_id", clientId)
        .eq("status", "planned")
    : db.from("client_nutrition_preps").insert(payload)

  const { data, error } = await query
    .select("id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, planned_for, created_at, updated_at, source_type, source_protocol_id, source_day_position, source_meal_id, source_snapshot")
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Planning item materialization failed" }, { status: 500 })
  }

  if (data.is_active) {
    const activationError = await setPrepActivation({
      clientId,
      prepId: data.id,
      physiologicalDate: data.physiological_date,
      mealSlot: data.meal_slot as SmartPrepSlot,
      variantGroupId: data.variant_group_id,
      scenarioKey: data.scenario_key,
    })
    if (activationError) return NextResponse.json({ error: activationError.message }, { status: 500 })
  }

  return NextResponse.json({ data: { ...data, is_virtual: false } }, { status: existing?.id ? 200 : 201 })
}
