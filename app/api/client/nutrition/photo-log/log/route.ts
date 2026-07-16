export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import { normalizeClientLang } from "@/lib/client/resolve-language"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import type { PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"
import { resolveOrCreateFoodItemsForPhotoResult } from "@/lib/nutrition/photo-log-catalog"
import { buildPhotoGuidedEntries } from "@/lib/nutrition/photo-log-entries"
import { persistResolvedMeal } from "@/lib/nutrition/meal-persistence"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { computePhysiologicalDate, constructLoggedAt } from "@/lib/nutrition/physiological-date"
import { validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"
import type { ClientLang } from "@/lib/i18n/clientTranslations"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"

const schema = z.object({
  session_id: z.string().uuid(),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(4000).optional(),
  result_override: z.object({
    meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    analysis_mode: z.enum(["plate", "packaging", "barcode", "receipt", "hybrid"]).nullable().optional(),
    source_context: z.string().nullable().optional(),
    status_copy: z.string(),
    ready_to_log: z.boolean(),
    leftovers_recommended: z.boolean(),
    validation_issues: z.array(z.string()).optional(),
    confidence_breakdown: z.object({
      capture: z.number(),
      ocr: z.number(),
      quantity: z.number(),
      nutrition: z.number(),
    }).nullable().optional(),
    product_reference: z.object({
      brand: z.string().nullable().optional(),
      name_fr: z.string().nullable().optional(),
      canonical_name_fr: z.string().nullable().optional(),
      product_type: z.string().nullable().optional(),
      serving_size_g: z.number().nullable().optional(),
      serving_label: z.string().nullable().optional(),
      barcode_text: z.string().nullable().optional(),
      evidence: z.string().nullable().optional(),
      save_to_personal_library: z.boolean().nullable().optional(),
    }).nullable().optional(),
    pending_question: z.any().nullable(),
    components: z.array(z.object({
      name_fr: z.string().min(1),
      category_hint: z.enum(["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"]),
      quantity_g: z.number().nonnegative(),
      quantity_unit: z.enum(["g", "ml", "serving"]).nullable().optional(),
      quantity_source: z.enum(["scale", "user_note", "label", "visual_estimate", "default", "clarification", "manual"]).optional(),
      nutrition_source: z.enum(["label_read", "user_note", "catalog_fallback", "visual_estimate", "clarification", "manual_addition", "default"]).nullable().optional(),
      component_confidence: z.number().min(0).max(1).nullable().optional(),
      kcal_per_100g: z.number().nonnegative(),
      protein_per_100g: z.number().nonnegative(),
      carbs_per_100g: z.number().nonnegative(),
      fat_per_100g: z.number().nonnegative(),
      fiber_per_100g: z.number().nonnegative(),
      source_note: z.string().nullable().optional(),
      catalog_metadata: z.object({
        item_key: z.string().nullable().optional(),
        reusable: z.boolean().nullable().optional(),
        brand: z.string().nullable().optional(),
        canonical_name_fr: z.string().nullable().optional(),
      }).nullable().optional(),
    })),
  }).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const { session, client: sessionClient } = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId: body.data.session_id,
    user,
    sessionSelect: "id, physiological_date, meal_type, analysis_result, status, meal_id",
    clientSelect: "id, timezone",
  })
  const resolvedClient = sessionClient
    ? null
    : await resolveClientFromUser(user.id, user.email, db, "id, timezone")
  // A review result is sufficient to save a meal. Keeping this fallback prevents an
  // already-reviewed text meal from being lost if a short-lived scan session expires.
  if ((!session || !sessionClient) && (!body.data.result_override || !resolvedClient)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const client = (sessionClient ?? resolvedClient) as Record<string, any>
  const clientId = String(client.id)
  const lang = normalizeClientLang(undefined) as ClientLang

  // The mobile client can retry after a timeout. Return the existing meal instead
  // of creating a second one when the first request already completed.
  if (session?.status === "logged" && session.meal_id) {
    const { data: existingMeal } = await db
      .from("nutrition_meals")
      .select("id, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
      .eq("id", String(session.meal_id))
      .eq("client_id", clientId)
      .maybeSingle()
    if (existingMeal) return NextResponse.json({ data: existingMeal }, { status: 200 })
  }

  const providedResult = (body.data.result_override ?? ((session as any)?.analysis_result ?? null)) as PhotoMealFinalResult | null
  if (!providedResult) {
    return NextResponse.json({ error: "Session is not ready to log" }, { status: 409 })
  }
  const validation = validatePhotoMealResult(providedResult, lang)
  const finalResult: PhotoMealFinalResult = {
    ...providedResult,
    ready_to_log: providedResult.components.length > 0 && validation.issues.length === 0,
    validation_issues: validation.issues,
  }

  if (!finalResult.ready_to_log) {
    return NextResponse.json({ error: validation.issues[0] ?? "Session is not ready to log" }, { status: 409 })
  }
  if (!finalResult.components.length) {
    return NextResponse.json({ error: "No loggable entries produced" }, { status: 422 })
  }

  const resolvedIds = await resolveOrCreateFoodItemsForPhotoResult({
    clientId,
    result: finalResult,
  })
  const entries = buildPhotoGuidedEntries(finalResult, resolvedIds)
  if (entries.length === 0) {
    return NextResponse.json({ error: "No loggable entries produced" }, { status: 422 })
  }

  const timezone = String(client.timezone ?? "").trim() || await resolveClientTimezone(db, clientId)
  const physiologicalDate = String(
    (session as any)?.physiological_date ?? body.data.physiological_date ?? computePhysiologicalDate(new Date(), timezone),
  )
  const loggedAtIso = constructLoggedAt(physiologicalDate, timezone, new Date())

  const persistResult = await persistResolvedMeal({
    db,
    context: {
      clientId,
      physiologicalDate,
      loggedAtIso,
      mealType: (finalResult.meal_type ?? (session as any).meal_type ?? "lunch"),
      lang,
    },
    entries,
    mealSource: "photo_guided",
    notes: body.data.notes?.trim() || finalResult.status_copy,
  })

  if (persistResult.error || !persistResult.data) {
    return NextResponse.json({ error: persistResult.error ?? "Failed to log meal" }, { status: 500 })
  }

  if (session) {
    const { error: updateError } = await db
      .from("client_photo_meal_logs")
      .update({
        status: "logged",
        meal_id: persistResult.data.id,
        analysis_result: finalResult,
      })
      .eq("id", body.data.session_id)
      .eq("client_id", clientId)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  revalidatePath("/client/nutrition")
  return NextResponse.json({ data: persistResult.data }, { status: 201 })
}
