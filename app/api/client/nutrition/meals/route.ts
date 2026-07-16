
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import { computePhysiologicalDate, inferMealType } from "@/lib/nutrition/physiological-date"
import { type InputMode } from "@/lib/nutrition/food-items"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { resolveClientLanguage } from "@/lib/client/resolve-language"
import { persistResolvedMeal, type MealSource } from "@/lib/nutrition/meal-persistence"
import type { ClientLang } from "@/lib/i18n/clientTranslations"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const entrySchema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
  input_mode: z.enum(["composer", "portion", "photo_ai", "voice", "text", "photo_guided"]).default("composer"),
})

const createMealSchema = z.object({
  meal_id: z.string().uuid().optional(), // if present, append to existing meal
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  meal_source: z.enum(["manual", "voice", "text", "composer", "auto_adjusted", "flash_estimate", "photo_guided"]).optional(),
  logged_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  entries: z.array(entrySchema).min(1).max(30),
})

// POST /api/client/nutrition/meals
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = createMealSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { meal_id: existingMealId, meal_type, meal_source, logged_at, notes, entries } = body.data
  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, "id, timezone")
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
  const clientId = client.id as string
  const timezone = String(client.timezone ?? "").trim() || await resolveClientTimezone(db, clientId)
  const lang = await resolveClientLanguage(db, clientId) as ClientLang
  const loggedAt = logged_at ? new Date(logged_at) : new Date()
  const physiologicalDate = computePhysiologicalDate(loggedAt, timezone)
  const resolvedMealType = meal_type ?? inferMealType(loggedAt, timezone)

  const persistResult = await persistResolvedMeal({
    db,
    context: {
      clientId,
      physiologicalDate,
      loggedAtIso: loggedAt.toISOString(),
      mealType: resolvedMealType,
      lang,
    },
    entries: entries as Array<{ food_item_id: string; quantity_g: number; input_mode: InputMode }>,
    mealSource: (meal_source ?? "composer") as MealSource,
    notes: notes ?? null,
    existingMealId,
  })
  if (persistResult.error || !persistResult.data) {
    const status = persistResult.error === "Meal not found" || persistResult.error?.includes("food_item_id not found") || persistResult.error === "Food items not found" ? 404 : 500
    return NextResponse.json({ error: persistResult.error }, { status })
  }

  revalidatePath("/client/nutrition")
  return NextResponse.json(persistResult.data, { status: existingMealId ? 200 : 201 })
}

// GET /api/client/nutrition/meals?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, "id, timezone")
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })
  const clientId = client.id as string
  const timezone = String(client.timezone ?? "").trim() || await resolveClientTimezone(db, clientId)
  const date = searchParams.get("date") ?? computePhysiologicalDate(new Date(), timezone)

  const { data, error } = await db
    .from("nutrition_meals")
    .select(`
      id, title, meal_type, logged_at, physiological_date,
      meal_source,
      total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
      photo_urls, notes,
      nutrition_entries (
        id, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
        input_mode, confidence_score,
        food_items (id, name_fr, category_l1, category_l2, icon_key, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, is_verified)
      )
    `)
    .eq("client_id", clientId)
    .eq("physiological_date", date)
    .order("logged_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const normalized = (data ?? []).map((meal: any) => ({
    ...meal,
    entries: meal.nutrition_entries ?? [],
    nutrition_entries: undefined,
  }))

  return NextResponse.json({ data: normalized, date })
}
