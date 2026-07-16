import type { MealType } from "@/lib/nutrition/food-items"
import type {
  PhotoMealAnalysisSummary,
  PhotoMealFinalResult,
  PhotoMealFinalComponent,
} from "@/lib/nutrition/photo-log-types"
import { validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

type VoiceParsedItem = {
  name: string
  quantity_g: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  category_l1?: PhotoMealFinalComponent["category_hint"]
}

function toPer100(total: number, quantityG: number) {
  if (!Number.isFinite(quantityG) || quantityG <= 0) return 0
  return Math.round((total / quantityG) * 1000) / 10
}

export function buildTextOnlyPhotoLogDraft({
  transcript,
  mealType,
  items,
  lang = "fr",
}: {
  transcript: string
  mealType: MealType
  items: VoiceParsedItem[]
  lang?: ClientLang
}) {
  const components: PhotoMealFinalComponent[] = items
    .filter((item) => String(item.name ?? "").trim().length > 0 && Number(item.quantity_g ?? 0) > 0)
    .map((item) => ({
      name_fr: String(item.name).trim(),
      category_hint: item.category_l1 ?? "extras",
      quantity_g: Math.round(Number(item.quantity_g)),
      quantity_source: "user_note",
      nutrition_source: "user_note",
      component_confidence: 0.92,
      kcal_per_100g: toPer100(Number(item.kcal ?? 0), Number(item.quantity_g ?? 0)),
      protein_per_100g: toPer100(Number(item.protein_g ?? 0), Number(item.quantity_g ?? 0)),
      carbs_per_100g: toPer100(Number(item.carbs_g ?? 0), Number(item.quantity_g ?? 0)),
      fat_per_100g: toPer100(Number(item.fat_g ?? 0), Number(item.quantity_g ?? 0)),
      fiber_per_100g: toPer100(Number(item.fiber_g ?? 0), Number(item.quantity_g ?? 0)),
      source_note: ct(lang, "nutrition.photo.status.ready"),
      catalog_metadata: null,
    }))

  const baseResult: PhotoMealFinalResult = {
    meal_type: mealType,
    analysis_mode: null,
    source_context: "text_note_v1",
    status_copy: ct(lang, "nutrition.photo.log.stage.validation"),
    ready_to_log: false,
    leftovers_recommended: false,
    validation_issues: [],
    confidence_breakdown: null,
    product_reference: null,
    components,
    pending_question: null,
  }

  const validation = validatePhotoMealResult(baseResult, lang)
  const result: PhotoMealFinalResult = {
    ...baseResult,
    ready_to_log: components.length > 0 && validation.issues.length === 0,
    validation_issues: validation.issues,
    status_copy: validation.issues[0] ?? baseResult.status_copy,
  }

  const analysis: PhotoMealAnalysisSummary = {
    meal_type: mealType,
    analysis_mode: null,
    source_context: "text_note_v1",
    scale_weight_g: null,
    scale_weight_confidence: null,
    manual_weight_g: null,
    manual_detail: transcript,
    confidence_breakdown: null,
    product_reference: null,
    photo_timeline: [],
    leftovers_estimate: null,
    components: components.map((component) => ({
      name_fr: component.name_fr,
      category_hint: component.category_hint,
      grams_estimate: component.quantity_g,
      unit_count: null,
      kcal_per_100g: component.kcal_per_100g,
      protein_per_100g: component.protein_per_100g,
      carbs_per_100g: component.carbs_per_100g,
      fat_per_100g: component.fat_per_100g,
      fiber_per_100g: component.fiber_per_100g,
      ambiguity_tags: [],
      rationale: ct(lang, "nutrition.photo.status.ready"),
      edible_yield_ratio: null,
      catalog_metadata: component.catalog_metadata ?? null,
      nutrition_source: "user_note",
      component_confidence: 0.92,
    })),
    ambiguity_tags: [],
    leftovers_recommended: false,
    vision_notes: ct(lang, "nutrition.photo.log.stage.analysis"),
  }

  return { analysis, result }
}
