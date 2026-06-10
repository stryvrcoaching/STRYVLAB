import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { calcEntryMacros } from "@/lib/nutrition/food-items"
import { computeMacroEnergy } from "@/lib/nutrition/energy"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

async function recalcMealTotals(mealId: string, clientId: string) {
  const db = service()
  const { data: entries, error } = await db
    .from("nutrition_entries")
    .select("calories_kcal, protein_g, carbs_g, fat_g, fiber_g")
    .eq("meal_id", mealId)
    .eq("client_id", clientId)

  if (error) throw new Error(error.message)

  if (!entries?.length) {
    await db.from("nutrition_meals").delete().eq("id", mealId).eq("client_id", clientId)
    return { deletedMeal: true }
  }

  const totals = entries.reduce(
    (acc, entry: any) => ({
      total_protein_g: Math.round((acc.total_protein_g + Number(entry.protein_g ?? 0)) * 10) / 10,
      total_carbs_g: Math.round((acc.total_carbs_g + Number(entry.carbs_g ?? 0)) * 10) / 10,
      total_fat_g: Math.round((acc.total_fat_g + Number(entry.fat_g ?? 0)) * 10) / 10,
      total_fiber_g: Math.round((acc.total_fiber_g + Number(entry.fiber_g ?? 0)) * 10) / 10,
    }),
    { total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 }
  )
  const totalsWithCalories = {
    ...totals,
    total_calories: computeMacroEnergy({
      protein_g: totals.total_protein_g,
      carbs_g: totals.total_carbs_g,
      fat_g: totals.total_fat_g,
      fiber_g: totals.total_fiber_g,
    }),
  }

  const { error: updateError } = await db
    .from("nutrition_meals")
    .update(totalsWithCalories)
    .eq("id", mealId)
    .eq("client_id", clientId)

  if (updateError) throw new Error(updateError.message)
  return { deletedMeal: false, totals: totalsWithCalories }
}

const patchEntrySchema = z.object({
  quantity_g: z.number().positive().max(5000),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = patchEntrySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = service()
  const { data: entry } = await db
    .from("nutrition_entries")
    .select("id, meal_id, food_item_id")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const { data: foodItem } = await db
    .from("food_items")
    .select("id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, is_verified")
    .eq("id", entry.food_item_id)
    .single()

  if (!foodItem) return NextResponse.json({ error: "Food item not found" }, { status: 404 })

  const macros = calcEntryMacros(foodItem as any, body.data.quantity_g)

  const { data, error } = await db
    .from("nutrition_entries")
    .update({
      quantity_g: body.data.quantity_g,
      ...macros,
    })
    .eq("id", params.id)
    .eq("client_id", clientId)
    .select("id, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const meal = await recalcMealTotals(entry.meal_id, clientId)
  return NextResponse.json({ data, meal })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = service()
  const { data: entry } = await db
    .from("nutrition_entries")
    .select("id, meal_id")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  const { error } = await db
    .from("nutrition_entries")
    .delete()
    .eq("id", params.id)
    .eq("client_id", clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const meal = await recalcMealTotals(entry.meal_id, clientId)
  return NextResponse.json({ ok: true, meal })
}
