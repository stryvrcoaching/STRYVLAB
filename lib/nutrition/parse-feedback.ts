import type { MealType } from "@/lib/nutrition/food-items"

export type NutritionParseSource = "voice" | "text"

export interface NutritionParseItemSnapshot {
  name: string
  quantity_g: number
  food_item_id?: string | null
  category_l1?: string | null
  category_l2?: string | null
}

export interface NutritionParseSnapshot {
  items: NutritionParseItemSnapshot[]
  meal_type?: MealType | null
}

export interface NutritionParseFeedbackPayload {
  meal_id?: string | null
  source: NutritionParseSource
  transcript: string
  meal_type?: MealType | null
  parsed: NutritionParseSnapshot
  corrected: NutritionParseSnapshot
  notes?: string | null
}

export interface NutritionParseEvalCase {
  id: string
  source: NutritionParseSource
  transcript: string
  expected: NutritionParseSnapshot
  tags?: string[]
}
