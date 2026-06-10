import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { calcEntryMacros } from '@/lib/nutrition/food-items'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import type { SmartPrepSlot } from '@/lib/nutrition/simulation-state'

export function createSupabaseService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function resolveClientIdFromUserId(
  userId: string,
): Promise<string | null> {
  const { data } = await createSupabaseService()
    .from('coach_clients')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

export const prepEntrySchema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
})

export type PrepEntryInput = z.infer<typeof prepEntrySchema>

export async function buildPrepEntries(entries: PrepEntryInput[]) {
  const db = createSupabaseService()
  const foodItemIds = Array.from(new Set(entries.map((e) => e.food_item_id)))
  const { data: foodItems, error } = await db
    .from('food_items')
    .select(
      'id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, is_verified',
    )
    .in('id', foodItemIds)

  if (error || !foodItems?.length) {
    return { error: 'Food items not found' as const }
  }

  const foodMap = Object.fromEntries(foodItems.map((item) => [item.id, item]))
  const prepared = entries.map((entry) => {
    const item = foodMap[entry.food_item_id]
    if (!item) return null
    const macros = calcEntryMacros(item as any, entry.quantity_g)
    return {
      food_item_id: entry.food_item_id,
      name_fr: item.name_fr,
      category_l1: item.category_l1 as string,
      quantity_g: entry.quantity_g,
      calories_kcal: macros.calories_kcal,
      protein_g: macros.protein_g,
      carbs_g: macros.carbs_g,
      fat_g: macros.fat_g,
      fiber_g: macros.fiber_g,
    }
  })

  if (prepared.some((entry) => entry === null)) {
    return { error: 'Food item missing from catalog' as const }
  }

  const safeEntries = prepared as NonNullable<(typeof prepared)[number]>[]
  const totalsBase = safeEntries.reduce(
    (acc, entry) => ({
      protein_g: Math.round((acc.protein_g + entry.protein_g) * 10) / 10,
      carbs_g: Math.round((acc.carbs_g + entry.carbs_g) * 10) / 10,
      fat_g: Math.round((acc.fat_g + entry.fat_g) * 10) / 10,
      fiber_g: Math.round((acc.fiber_g + entry.fiber_g) * 10) / 10,
    }),
    { protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  )

  return {
    entries: safeEntries,
    totals: {
      total_protein_g: totalsBase.protein_g,
      total_carbs_g: totalsBase.carbs_g,
      total_fat_g: totalsBase.fat_g,
      total_fiber_g: totalsBase.fiber_g,
      total_calories: computeMacroEnergy(totalsBase),
    },
  }
}

export async function setPrepActivation({
  clientId,
  prepId,
  physiologicalDate,
  mealSlot,
  variantGroupId,
  scenarioKey,
}: {
  clientId: string
  prepId: string
  physiologicalDate: string
  mealSlot: SmartPrepSlot
  variantGroupId: string
  scenarioKey: string
}) {
  const db = createSupabaseService()

  const peerUpdate = await db
    .from('client_nutrition_preps')
    .update({ is_active: false })
    .eq('client_id', clientId)
    .eq('physiological_date', physiologicalDate)
    .eq('status', 'planned')
    .eq('scenario_key', scenarioKey)
    .eq('meal_slot', mealSlot)
    .eq('variant_group_id', variantGroupId)
    .neq('id', prepId)

  if (peerUpdate.error) return peerUpdate.error

  const activeUpdate = await db
    .from('client_nutrition_preps')
    .update({ is_active: true })
    .eq('id', prepId)
    .eq('client_id', clientId)

  return activeUpdate.error ?? null
}
