import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

export const assessmentFoodCatalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  category: z
    .enum(["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(80).optional().default(48),
})

export async function searchAssessmentFoodCatalog(
  db: SupabaseClient,
  input: z.infer<typeof assessmentFoodCatalogSearchSchema>,
) {
  let query = db
    .from("food_items")
    .select(
      `
      id, name_fr, category_l1, category_l2, item_key, icon_key,
      kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
      source, is_verified, dietary_tags, allergen_tags, ingredients_known
    `,
    )
    .eq("source", "internal")
    .eq("is_verified", true)
    .order("name_fr")
    .limit(input.limit)

  if (input.category) query = query.eq("category_l1", input.category)
  const normalized = input.q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    query = query.or(`name_fr.ilike.${token}%,name_fr.ilike.% ${token}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
