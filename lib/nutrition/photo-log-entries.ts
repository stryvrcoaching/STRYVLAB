import type { InputMode } from "@/lib/nutrition/food-items"
import type { PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"

export interface PhotoLogResolvedEntry {
  food_item_id: string
  quantity_g: number
  input_mode: InputMode
}

export function buildPhotoGuidedEntries(
  result: PhotoMealFinalResult,
  resolvedIds: Record<string, string>,
): PhotoLogResolvedEntry[] {
  return result.components
    .map((component) => {
      const foodItemId = resolvedIds[component.name_fr]
      if (!foodItemId) return null
      return {
        food_item_id: foodItemId,
        quantity_g: component.quantity_g,
        input_mode: "photo_guided" as const,
      }
    })
    .filter((entry): entry is PhotoLogResolvedEntry => entry !== null)
}
