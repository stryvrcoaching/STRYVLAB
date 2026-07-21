import type { FoodItem } from '@/lib/nutrition/food-items'

/** Never render the internal French source field when the API supplied a localized label. */
export function getFoodDisplayName(item: Pick<FoodItem, 'name_fr' | 'name'> | null | undefined): string {
  return item?.name?.trim() || item?.name_fr?.trim() || '—'
}
