export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { z } from "zod"
import {
  createSupabaseService,
  resolveClientIdFromUserId,
  buildPrepEntries,
  setPrepActivation,
  prepEntrySchema,
} from "@/lib/nutrition/preps-service"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { ct } from '@/lib/i18n/clientTranslations'
import { resolveClientLanguage } from '@/lib/client/resolve-language'

const prepSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snack"])

const updatePrepSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  meal_slot: prepSlotSchema.optional(),
  variant_group_id: z.string().trim().min(1).max(80).optional(),
  scenario_key: z.string().trim().min(1).max(80).optional(),
  scenario_label: z.string().trim().min(1).max(80).optional(),
  is_active: z.boolean().optional(),
  entries: z.array(prepEntrySchema).min(1).max(30).optional(),
})

async function authClient() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const clientId = await resolveClientIdFromUserId(user.id)
  if (!clientId) return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) }
  return { clientId }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authClient()
  if ("error" in auth) return auth.error

  const db = createSupabaseService()
  const lang = await resolveClientLanguage(db, auth.clientId)
  const { data: existing, error: existingError } = await db
    .from("client_nutrition_preps")
    .select("id, physiological_date, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active")
    .eq("id", params.id)
    .eq("client_id", auth.clientId)
    .eq("status", "planned")
    .single()

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? "Prep not found" }, { status: 404 })
  }

  const body = updatePrepSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.data.title !== undefined) update.title = body.data.title?.trim() || null
  if (body.data.meal_type) update.meal_type = body.data.meal_type
  if (body.data.meal_slot) update.meal_slot = body.data.meal_slot
  if (body.data.variant_group_id !== undefined) update.variant_group_id = body.data.variant_group_id.trim()
  if (body.data.scenario_key !== undefined) update.scenario_key = body.data.scenario_key.trim()
  if (body.data.scenario_label !== undefined) update.scenario_label = body.data.scenario_label.trim()
  if (body.data.is_active !== undefined) update.is_active = body.data.is_active

  if (body.data.entries) {
    const prepared = await buildPrepEntries(body.data.entries)
    if ("error" in prepared) return NextResponse.json({ error: prepared.error }, { status: 404 })
    update.entries = prepared.entries
    Object.assign(update, prepared.totals)
  }

  const nextMealSlot = (body.data.meal_slot ?? existing.meal_slot ?? body.data.meal_type ?? existing.meal_type ?? "snack") as SmartPrepSlot
  const nextVariantGroupId = body.data.variant_group_id?.trim() || existing.variant_group_id || nextMealSlot
  const nextScenarioKey = body.data.scenario_key?.trim() || existing.scenario_key || "default"
  const nextScenarioLabel = body.data.scenario_label?.trim() || existing.scenario_label || ct(lang, 'nutrition.scenario.main')
  update.meal_slot = nextMealSlot
  update.variant_group_id = nextVariantGroupId
  update.scenario_key = nextScenarioKey
  update.scenario_label = nextScenarioLabel

  const { data, error } = await db
    .from("client_nutrition_preps")
    .update(update)
    .eq("id", params.id)
    .eq("client_id", auth.clientId)
    .eq("status", "planned")
    .select("id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, planned_for, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data.is_active) {
    const activationError = await setPrepActivation({
      clientId: auth.clientId,
      prepId: data.id,
      physiologicalDate: data.physiological_date,
      mealSlot: nextMealSlot,
      variantGroupId: nextVariantGroupId,
      scenarioKey: nextScenarioKey,
    })
    if (activationError) return NextResponse.json({ error: activationError.message }, { status: 500 })
    data.is_active = true
  }
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authClient()
  if ("error" in auth) return auth.error

  const { error } = await createSupabaseService()
    .from("client_nutrition_preps")
    .update({ status: "cancelled" })
    .eq("id", params.id)
    .eq("client_id", auth.clientId)
    .eq("status", "planned")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
