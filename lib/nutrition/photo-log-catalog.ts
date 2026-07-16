import { createSupabaseService } from "@/lib/nutrition/preps-service"
import type { PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export async function resolveOrCreateFoodItemsForPhotoResult({
  clientId,
  result,
}: {
  clientId: string
  result: PhotoMealFinalResult
}) {
  const db = createSupabaseService()
  const resolved: Record<string, string> = {}

  for (const component of result.components) {
    const normalizedName = normalize(component.name_fr)
    const slug = normalizedName.replace(/\s+/g, "-") || "photo-guided"
    const itemKey =
      component.catalog_metadata?.item_key?.trim() ||
      `photo-guided-${slug}-${clientId.slice(0, 8)}`
    const { data: candidates } = await db
      .from("food_items")
      .select("id, name_fr, client_id, source, is_verified")
      .or(`and(source.eq.internal,is_verified.eq.true),client_id.eq.${clientId}`)
      .limit(250)

    const exactMatch = (candidates ?? []).find((candidate) => normalize(candidate.name_fr) === normalizedName)
    if (exactMatch) {
      resolved[component.name_fr] = exactMatch.id
      continue
    }

    const { data: inserted, error } = await db
      .from("food_items")
      .insert({
        name_fr: component.name_fr,
        category_l1: component.category_hint,
        category_l2:
          component.category_hint === "proteins" && /whey|protein|proteine/i.test(component.name_fr)
            ? "complements"
            : null,
        item_key: itemKey,
        kcal_per_100g: component.kcal_per_100g,
        protein_per_100g: component.protein_per_100g,
        carbs_per_100g: component.carbs_per_100g,
        fat_per_100g: component.fat_per_100g,
        fiber_per_100g: component.fiber_per_100g,
        source: "user",
        is_verified: false,
        client_id: clientId,
      })
      .select("id")
      .single()

    if (error || !inserted) {
      const isDuplicateKey =
        error?.message?.toLowerCase().includes("duplicate key") ||
        error?.message?.toLowerCase().includes("unique")

      if (isDuplicateKey) {
        const { data: existingByKey, error: existingError } = await db
          .from("food_items")
          .select("id")
          .eq("item_key", itemKey)
          .maybeSingle()

        if (!existingError && existingByKey?.id) {
          resolved[component.name_fr] = existingByKey.id
          continue
        }
      }

      throw new Error(error?.message ?? `Unable to resolve food item for ${component.name_fr}`)
    }

    resolved[component.name_fr] = inserted.id
  }

  return resolved
}
