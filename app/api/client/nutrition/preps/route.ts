export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { z } from "zod"
import { computePhysiologicalDate, inferMealType } from "@/lib/nutrition/physiological-date"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
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

const createPrepSchema = z.object({
  title: z.string().max(120).optional(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  meal_slot: prepSlotSchema.optional(),
  variant_group_id: z.string().trim().min(1).max(80).optional(),
  scenario_key: z.string().trim().min(1).max(80).optional(),
  scenario_label: z.string().trim().min(1).max(80).optional(),
  is_active: z.boolean().optional(),
  planned_for: z.string().datetime().optional(),
  entries: z.array(prepEntrySchema).min(1).max(30),
})

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientIdFromUserId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = createSupabaseService()
  const { searchParams } = new URL(req.url)
  const timezone = await resolveClientTimezone(db, clientId)
  const date = searchParams.get("date") ?? computePhysiologicalDate(new Date(), timezone)
  const status = searchParams.get("status") ?? "planned"

  const { data, error } = await db
    .from("client_nutrition_preps")
    .select("id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, planned_for, created_at, updated_at")
    .eq("client_id", clientId)
    .eq("physiological_date", date)
    .eq("status", status)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], date })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientIdFromUserId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = createPrepSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const lang = await resolveClientLanguage(db, clientId)
  const timezone = await resolveClientTimezone(db, clientId)
  const plannedFor = body.data.planned_for ? new Date(body.data.planned_for) : new Date()
  const physiologicalDate = computePhysiologicalDate(plannedFor, timezone)
  const mealType = body.data.meal_type ?? inferMealType(plannedFor, timezone)
  const mealSlot = body.data.meal_slot ?? mealType
  const variantGroupId = body.data.variant_group_id?.trim() || mealSlot
  const scenarioKey = body.data.scenario_key?.trim() || "default"
  const scenarioLabel = body.data.scenario_label?.trim() || ct(lang, 'nutrition.scenario.main')
  const shouldActivate = body.data.is_active ?? true
  const prepared = await buildPrepEntries(body.data.entries)

  if ("error" in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: 404 })
  }

  const { data, error } = await db
    .from("client_nutrition_preps")
    .insert({
      client_id: clientId,
      physiological_date: physiologicalDate,
      title: body.data.title?.trim() || null,
      meal_type: mealType,
      meal_slot: mealSlot,
      variant_group_id: variantGroupId,
      scenario_key: scenarioKey,
      scenario_label: scenarioLabel,
      is_active: shouldActivate,
      status: "planned",
      entries: prepared.entries,
      planned_for: plannedFor.toISOString(),
      ...prepared.totals,
    })
    .select("id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, planned_for, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (shouldActivate) {
    const activationError = await setPrepActivation({
      clientId,
      prepId: data.id,
      physiologicalDate,
      mealSlot: mealSlot as SmartPrepSlot,
      variantGroupId,
      scenarioKey,
    })
    if (activationError) return NextResponse.json({ error: activationError.message }, { status: 500 })
    data.is_active = true
  }
  return NextResponse.json({ data }, { status: 201 })
}
