import type { CategoryL1, MealType } from "@/lib/nutrition/food-items"

export type PhotoMealLogStatus =
  | "capturing"
  | "analyzing"
  | "clarifying"
  | "ready_to_log"
  | "logged"
  | "refined"
  | "failed"

export type PhotoMealAnalysisMode = "plate" | "packaging" | "barcode" | "receipt" | "hybrid"

export type PhotoMealPhotoKind = "context" | "top" | "side" | "scale_zoom" | "leftovers"

export type PhotoMealPhotoRole =
  | "before_meal"
  | "after_meal_leftovers"
  | "separate_weighing"
  | "receipt"
  | "packaging_front"
  | "nutrition_label"
  | "barcode"
  | "detail"
  | "unknown"

export type PhotoMealScaleReadingScope = "meal_total" | "component" | "unknown"

export interface PhotoMealScaleReading {
  photo_index: number
  grams: number
  scope: PhotoMealScaleReadingScope
  food_name?: string | null
  confidence: number
  evidence?: string | null
}

export type PhotoMealAmbiguityTag =
  | "scale_unreadable"
  | "cooked_vs_raw"
  | "non_edible_parts"
  | "hidden_fats"
  | "partial_weight"

export interface PhotoMealConfidenceBreakdown {
  capture: number
  ocr: number
  quantity: number
  nutrition: number
}

export interface PhotoMealCatalogMetadata {
  item_key?: string | null
  reusable?: boolean | null
  brand?: string | null
  canonical_name_fr?: string | null
}

export type PhotoMealNutritionSource =
  | "label_read"
  | "user_note"
  | "catalog_fallback"
  | "visual_estimate"
  | "clarification"
  | "manual_addition"
  | "default"

export interface PhotoMealProductReference {
  brand?: string | null
  name_fr?: string | null
  canonical_name_fr?: string | null
  product_type?: string | null
  serving_size_g?: number | null
  serving_label?: string | null
  barcode_text?: string | null
  evidence?: string | null
  save_to_personal_library?: boolean | null
}

export type PhotoClarificationKey =
  | "egg_white_extra_g"
  | "starch_state"
  | "creamy_sauce_type"
  | "fat_type"
  | "fat_amount"
  | "includes_non_edible_parts"

export interface PhotoMealComponentCandidate {
  name_fr: string
  category_hint: CategoryL1
  grams_estimate: number
  quantity_unit?: "g" | "ml" | "serving" | null
  unit_count?: number | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  ambiguity_tags: PhotoMealAmbiguityTag[]
  rationale?: string | null
  edible_yield_ratio?: number | null
  catalog_metadata?: PhotoMealCatalogMetadata | null
  nutrition_source?: PhotoMealNutritionSource | null
  component_confidence?: number | null
}

export interface PhotoMealPhotoEvidence {
  index: number
  kind: PhotoMealPhotoKind
  signed_url: string
}

export interface PhotoMealPhotoTimelineItem {
  index: number
  role: PhotoMealPhotoRole
  evidence?: string | null
}

export interface PhotoMealLeftoversEstimate {
  detected: boolean
  grams_estimate: number | null
  confidence: number | null
  rationale?: string | null
}

export interface PhotoMealClarificationQuestion {
  key: PhotoClarificationKey
  prompt: string
  options: Array<{
    value: string
    label: string
  }>
}

export interface PhotoMealAnalysisSummary {
  meal_type: MealType
  analysis_mode?: PhotoMealAnalysisMode | null
  source_context?: string | null
  scale_weight_g: number | null
  scale_weight_confidence: number | null
  manual_weight_g: number | null
  manual_detail?: string | null
  confidence_breakdown?: PhotoMealConfidenceBreakdown | null
  product_reference?: PhotoMealProductReference | null
  photo_timeline?: PhotoMealPhotoTimelineItem[]
  scale_readings?: PhotoMealScaleReading[]
  leftovers_estimate?: PhotoMealLeftoversEstimate | null
  components: PhotoMealComponentCandidate[]
  ambiguity_tags: PhotoMealAmbiguityTag[]
  leftovers_recommended: boolean
  vision_notes?: string | null
}

export interface PhotoMealFinalComponent {
  name_fr: string
  category_hint: CategoryL1
  quantity_g: number
  quantity_unit?: "g" | "ml" | "serving" | null
  quantity_source?: "scale" | "user_note" | "label" | "visual_estimate" | "default" | "clarification" | "manual"
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  source_note?: string | null
  catalog_metadata?: PhotoMealCatalogMetadata | null
  nutrition_source?: PhotoMealNutritionSource | null
  component_confidence?: number | null
}

export interface PhotoMealFinalResult {
  meal_type: MealType
  analysis_mode?: PhotoMealAnalysisMode | null
  source_context?: string | null
  status_copy: string
  ready_to_log: boolean
  leftovers_recommended: boolean
  validation_issues?: string[]
  confidence_breakdown?: PhotoMealConfidenceBreakdown | null
  product_reference?: PhotoMealProductReference | null
  components: PhotoMealFinalComponent[]
  pending_question: PhotoMealClarificationQuestion | null
}
