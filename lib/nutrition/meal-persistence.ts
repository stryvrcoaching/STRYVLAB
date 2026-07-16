import type { SupabaseClient } from "@supabase/supabase-js"
import { calcEntryMacros, type FoodItem, type InputMode, type MealType } from "@/lib/nutrition/food-items"
import { computeMacroEnergy } from "@/lib/nutrition/energy"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

export type MealSource =
  | "manual"
  | "voice"
  | "text"
  | "composer"
  | "auto_adjusted"
  | "flash_estimate"
  | "photo_guided"

export interface MealEntryInput {
  food_item_id: string
  quantity_g: number
  input_mode: InputMode
}

export interface ResolvedMealContext {
  clientId: string
  physiologicalDate: string
  loggedAtIso: string
  mealType: MealType
  lang?: ClientLang
}

interface MealFoodRow {
  id: string
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

export interface PersistMealOptions {
  db: SupabaseClient
  context: ResolvedMealContext
  entries: MealEntryInput[]
  mealSource?: MealSource | null
  notes?: string | null
  existingMealId?: string | null
}

export interface PersistMealResult {
  id: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_fiber_g: number
}

function toFoodItem(row: MealFoodRow): FoodItem {
  return {
    ...row,
    name_fr: "",
    category_l1: "proteins",
    category_l2: null,
    item_key: "",
    source: "internal",
    is_verified: true,
  }
}

async function fetchFoodMap(db: SupabaseClient, entries: MealEntryInput[]) {
  const foodItemIds = Array.from(new Set(entries.map((entry) => entry.food_item_id)))
  const { data: foodItems, error } = await db
    .from("food_items")
    .select("id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .in("id", foodItemIds)

  if (error || !foodItems?.length) {
    return { error: "Food items not found" as const }
  }

  const foodMap = Object.fromEntries(foodItems.map((item) => [item.id, item as MealFoodRow]))
  for (const entry of entries) {
    if (!foodMap[entry.food_item_id]) {
      return { error: `food_item_id not found: ${entry.food_item_id}` as const }
    }
  }

  return { foodMap }
}

function computeEntryMacros(entries: MealEntryInput[], foodMap: Record<string, MealFoodRow>) {
  return entries.map((entry) => {
    const item = foodMap[entry.food_item_id]
    const macros = calcEntryMacros(toFoodItem(item), entry.quantity_g)
    return { ...entry, ...macros }
  })
}

function computeTotals(
  entryMacros: Array<MealEntryInput & {
    calories_kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
  }>,
) {
  const totalsBase = entryMacros.reduce(
    (acc, entry) => ({
      total_protein_g: Math.round((acc.total_protein_g + entry.protein_g) * 10) / 10,
      total_carbs_g: Math.round((acc.total_carbs_g + entry.carbs_g) * 10) / 10,
      total_fat_g: Math.round((acc.total_fat_g + entry.fat_g) * 10) / 10,
      total_fiber_g: Math.round((acc.total_fiber_g + entry.fiber_g) * 10) / 10,
    }),
    { total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 },
  )

  return {
    ...totalsBase,
    total_calories: computeMacroEnergy({
      protein_g: totalsBase.total_protein_g,
      carbs_g: totalsBase.total_carbs_g,
      fat_g: totalsBase.total_fat_g,
      fiber_g: totalsBase.total_fiber_g,
    }),
  }
}

export async function persistResolvedMeal({
  db,
  context,
  entries,
  mealSource,
  notes,
  existingMealId,
}: PersistMealOptions): Promise<{ data?: PersistMealResult; error?: string }> {
  const foodResult = await fetchFoodMap(db, entries)
  if ("error" in foodResult) return { error: foodResult.error }

  const entryMacros = computeEntryMacros(entries, foodResult.foodMap)
  const newTotals = computeTotals(entryMacros)

  let mealId = existingMealId ?? null

  if (mealId) {
    const { data: existing } = await db
      .from("nutrition_meals")
      .select("id, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
      .eq("id", mealId)
      .eq("client_id", context.clientId)
      .single()

    if (!existing) return { error: "Meal not found" }

    const updatedTotals = {
      total_protein_g: Math.round((Number(existing.total_protein_g) + newTotals.total_protein_g) * 10) / 10,
      total_carbs_g: Math.round((Number(existing.total_carbs_g) + newTotals.total_carbs_g) * 10) / 10,
      total_fat_g: Math.round((Number(existing.total_fat_g) + newTotals.total_fat_g) * 10) / 10,
      total_fiber_g: Math.round((Number(existing.total_fiber_g) + newTotals.total_fiber_g) * 10) / 10,
    }
    const updatedPayload = {
      ...updatedTotals,
      total_calories: computeMacroEnergy({
        protein_g: updatedTotals.total_protein_g,
        carbs_g: updatedTotals.total_carbs_g,
        fat_g: updatedTotals.total_fat_g,
        fiber_g: updatedTotals.total_fiber_g,
      }),
    }

    await db.from("nutrition_meals").update(updatedPayload).eq("id", mealId)
  } else {
    const { data: meal, error } = await db
      .from("nutrition_meals")
      .insert({
        client_id: context.clientId,
        physiological_date: context.physiologicalDate,
        meal_type: context.mealType,
        meal_source: mealSource ?? "composer",
        logged_at: context.loggedAtIso,
        notes: notes ?? null,
        ...newTotals,
      })
      .select("id")
      .single()

    if (error || !meal) {
      return { error: error?.message ?? "Insert failed" }
    }
    mealId = meal.id

    await db.from("smart_agenda_events").insert({
      client_id: context.clientId,
      event_type: "meal",
      event_date: context.physiologicalDate,
      event_time: new Date(context.loggedAtIso).toTimeString().slice(0, 8),
      source_id: mealId,
      title: ct(context.lang ?? "fr", "nutrition.agenda.mealTitle", {
        label: ct(context.lang ?? "fr", `meal.type.${context.mealType}` as const),
      }),
      summary: `${Math.round(newTotals.total_calories)} kcal · P ${newTotals.total_protein_g}g · G ${newTotals.total_carbs_g}g · L ${newTotals.total_fat_g}g`,
      data: newTotals,
    })

    await db.from("client_points").insert({
      client_id: context.clientId,
      action_type: "meal",
      points: 3,
      reference_id: mealId,
      earned_at: context.loggedAtIso,
    })
  }

  const entriesPayload = entryMacros.map((entry) => ({
    meal_id: mealId,
    client_id: context.clientId,
    food_item_id: entry.food_item_id,
    physiological_date: context.physiologicalDate,
    quantity_g: entry.quantity_g,
    calories_kcal: entry.calories_kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g,
    input_mode: entry.input_mode,
    confidence_score:
      entry.input_mode === "composer"
        ? 0.85
        : entry.input_mode === "text"
          ? 0.75
        : entry.input_mode === "voice"
          ? 0.7
          : entry.input_mode === "portion"
            ? 0.65
            : entry.input_mode === "photo_guided"
              ? 0.82
              : 0.55,
  }))

  const { error: entriesError } = await db.from("nutrition_entries").insert(entriesPayload)
  if (entriesError) {
    if (!existingMealId && mealId) await db.from("nutrition_meals").delete().eq("id", mealId)
    return { error: entriesError.message }
  }

  return {
    data: {
      id: mealId!,
      ...newTotals,
    },
  }
}
