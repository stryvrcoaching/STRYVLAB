import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { callLLM } from "@/lib/llm/callLLM"
import {
  computeEquivalentQuantity,
  computePlanMealsTotals,
  roundPlanTotals,
  type NutritionPlanFood,
  type NutritionPlanMeal,
} from "@/lib/nutrition/protocol-builder"
import {
  evaluateFoodCompatibility,
  sortFoodsByCompatibility,
} from "@/lib/nutrition/food-compatibility"
import { loadClientFoodProfile } from "@/lib/nutrition/food-profile-service"
import {
  matchesVisibleLeaf,
  sortVisibleLeafItems,
  type VisibleLeafKey,
} from "@/lib/nutrition/food-taxonomy"

export const nutritionAiGenerationInputSchema = z.object({
  protocol_id: z.string().uuid().nullable().optional(),
  day_name: z.string().trim().min(1).max(120),
  target_meal_title: z.string().trim().min(1).max(80).optional(),
  day_role: z.enum(["training", "rest", "neutral"]).default("neutral"),
  calories: z.number().int().min(100).max(6000),
  protein_g: z.number().min(1).max(500),
  carbs_g: z.number().min(0).max(900),
  fat_g: z.number().min(0).max(300),
  hydration_ml: z.number().int().min(500).max(10000).nullable().optional(),
  meal_count: z.number().int().min(1).max(8),
})

const selectionSchema = z.object({
  meals: z.array(z.object({
    title: z.string().trim().min(1).max(80),
    items: z.array(z.object({
      food_id: z.string().uuid(),
      quantity_g: z.number().min(1).max(1500),
    })).min(1).max(6),
  })).min(1).max(8),
})

export type NutritionAiGenerationInput = z.infer<typeof nutritionAiGenerationInputSchema>

type CandidateFood = NutritionPlanFood & {
  dietary_tags?: string[] | null
  allergen_tags?: string[] | null
  ingredients_known?: boolean | null
}

const EVERYDAY_FOOD_LEAVES: Partial<Record<CandidateFood["category_l1"], VisibleLeafKey[]>> = {
  proteins: ["chicken", "turkey", "eggs", "beef", "fish", "dairy-protein", "plant-protein", "pork"],
  carbs: ["rice", "pasta", "potatoes", "bread", "cereals", "legumes"],
  fats: ["oils", "nuts-seeds", "avocado-olives", "nut-butters", "butter-spreads"],
  vegetables: ["leafy", "cruciferous", "roots", "mediterranean", "other-vegetables"],
  fruits: ["fresh-fruits"],
}

const UNCOMMON_OR_PROCESSED_TERMS = [
  "morue salee", "morue salée", "seche", "sèche", "fume", "fumé", "jambon", "serrano",
  "grisons", "charcuterie", "saucisson", "salami", "chorizo", "foie", "abat", "preemballe",
  "préemballé", "sans croute", "sans croûte", "margarine", "pepins de raisin", "pépins de raisin",
  "huile de palme", "huile de poisson",
]

const COMMON_OIL_TERMS = ["huile d'olive", "huile de colza", "huile de tournesol", "huile de noix", "huile d’avocat", "huile d'avocat"]

function normalizeFoodName(value: string) {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
}

function isPreferenceExplicitlyKept(food: CandidateFood) {
  return food.compatibility?.status === "priority" || food.compatibility?.status === "liked"
}

function isUncommonOrProcessed(food: CandidateFood) {
  const name = normalizeFoodName(food.name_fr)
  return UNCOMMON_OR_PROCESSED_TERMS.some((term) => name.includes(normalizeFoodName(term)))
}

function isEverydayFood(food: CandidateFood) {
  if (isPreferenceExplicitlyKept(food)) return true

  if (isUncommonOrProcessed(food)) return false

  const leaves = EVERYDAY_FOOD_LEAVES[food.category_l1] ?? []
  if (!leaves.some((leaf) => matchesVisibleLeaf(food, leaf))) return false

  if (food.category_l1 === "fats" && matchesVisibleLeaf(food, "oils")) {
    const name = normalizeFoodName(food.name_fr)
    return COMMON_OIL_TERMS.some((term) => name.includes(normalizeFoodName(term)))
  }
  return true
}

/**
 * Keeps AI generation on an intentionally small, coach-friendly pantry.
 * The normal catalogue remains fully available to the coach in Nutrition Studio.
 */
export function selectEverydayGenerationFoods(candidates: CandidateFood[]) {
  const ordered: CandidateFood[] = []
  const seen = new Set<string>()
  const add = (food: CandidateFood) => {
    if (!seen.has(food.id)) {
      seen.add(food.id)
      ordered.push(food)
    }
  }

  for (const category of ["proteins", "carbs", "fats", "vegetables", "fruits"] as const) {
    const categoryCandidates = candidates.filter((food) => food.category_l1 === category && isEverydayFood(food))
    for (const leaf of EVERYDAY_FOOD_LEAVES[category] ?? []) {
      for (const food of sortVisibleLeafItems(
        categoryCandidates.filter((candidate) => matchesVisibleLeaf(candidate, leaf)),
        leaf,
      ) as CandidateFood[]) {
        add(food)
      }
    }
  }

  // A food the client explicitly asked to retain is always eligible, even if it is not a default staple.
  candidates.filter(isPreferenceExplicitlyKept).forEach(add)

  const requiredCategories: CandidateFood["category_l1"][] = ["proteins", "carbs", "fats"]
  // The taxonomy is deliberately strict. If it cannot recognize a basic catalogue label,
  // retain compatible, non-processed foods from the missing category rather than opening
  // the generation back up to the entire catalogue.
  for (const category of requiredCategories) {
    if (ordered.some((food) => food.category_l1 === category)) continue
    candidates
      .filter((food) => food.category_l1 === category && (isPreferenceExplicitlyKept(food) || !isUncommonOrProcessed(food)))
      .sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr", { sensitivity: "base" }))
      .forEach(add)
  }
  return requiredCategories.every((category) => ordered.some((food) => food.category_l1 === category))
    ? ordered
    : candidates
}

type NutritionAiContext = {
  baseline: {
    age: number | null
    gender: string | null
    transformation_phase: string | null
    training_goal: string | null
    weekly_frequency: number | null
  }
  assessment: Record<string, unknown>
  recovery_7d: {
    sleep_hours: number | null
    sleep_quality: number | null
    energy_level: number | null
    stress_level: number | null
    hunger_level: number | null
    muscle_soreness: number | null
    samples: number
  }
  professional_review_flags: string[]
}

function responseValue(response: {
  value_number?: number | null
  value_text?: string | null
  value_json?: unknown
}) {
  if (response.value_json !== null && response.value_json !== undefined) return response.value_json
  if (response.value_number !== null && response.value_number !== undefined) return response.value_number
  return response.value_text ?? null
}

function meaningfulSafetyAnswer(value: unknown) {
  if (value === null || value === undefined || value === false) return false
  if (Array.isArray(value)) return value.length > 0
  const normalized = String(value).trim().toLocaleLowerCase("fr")
  return !["", "non", "aucun", "aucune", "ras", "néant", "neant", "false"].includes(normalized)
}

function average(rows: Array<Record<string, unknown>>, key: string) {
  const values = rows
    .map((row) => Number(row[key]))
    .filter((value) => Number.isFinite(value))
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

async function loadNutritionAiContext(
  db: SupabaseClient,
  clientId: string,
): Promise<NutritionAiContext> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 7)
  const [{ data: client }, { data: submission }, { data: checkins }] = await Promise.all([
    db
      .from("coach_clients")
      .select("date_of_birth, gender, transformation_phase, training_goal, weekly_frequency")
      .eq("id", clientId)
      .maybeSingle(),
    db
      .from("assessment_submissions")
      .select("id, assessment_responses(field_key, value_number, value_text, value_json)")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("client_daily_checkins")
      .select("sleep_hours, sleep_quality, energy_level, stress_level, hunger_level, muscle_soreness")
      .eq("client_id", clientId)
      .gte("date", since.toISOString().slice(0, 10))
      .order("date", { ascending: false }),
  ])

  const relevantFields = new Set([
    "diet_type",
    "meals_per_day",
    "diet_budget",
    "meal_timing",
    "daily_meal_routine",
    "primary_goal",
    "sleep_duration_h",
    "sleep_quality",
    "stress_level",
    "energy_level",
    "training_frequency",
    "relationship_with_food",
    "injuries_active",
    "pathologies",
    "medications",
    "therapy_or_psy",
    "medical_notes",
  ])
  const assessment: Record<string, unknown> = {}
  for (const response of (submission?.assessment_responses ?? []) as Array<{
    field_key: string
    value_number: number | null
    value_text: string | null
    value_json: unknown
  }>) {
    if (relevantFields.has(response.field_key)) {
      assessment[response.field_key] = responseValue(response)
    }
  }
  const safetyKeys = ["relationship_with_food", "injuries_active", "pathologies", "medications", "therapy_or_psy", "medical_notes"]
  const professionalReviewFlags = safetyKeys.filter((key) => meaningfulSafetyAnswer(assessment[key]))
  const operationalAssessment = Object.fromEntries(
    Object.entries(assessment).filter(([key]) => !safetyKeys.includes(key)),
  )
  const birthDate = client?.date_of_birth ? new Date(`${client.date_of_birth}T00:00:00.000Z`) : null
  const age = birthDate && Number.isFinite(birthDate.getTime())
    ? new Date().getUTCFullYear() - birthDate.getUTCFullYear()
    : null
  const rows = (checkins ?? []) as Array<Record<string, unknown>>

  return {
    baseline: {
      age,
      gender: client?.gender ?? null,
      transformation_phase: client?.transformation_phase ?? null,
      training_goal: client?.training_goal ?? null,
      weekly_frequency: client?.weekly_frequency ?? null,
    },
    assessment: operationalAssessment,
    recovery_7d: {
      sleep_hours: average(rows, "sleep_hours"),
      sleep_quality: average(rows, "sleep_quality"),
      energy_level: average(rows, "energy_level"),
      stress_level: average(rows, "stress_level"),
      hunger_level: average(rows, "hunger_level"),
      muscle_soreness: average(rows, "muscle_soreness"),
      samples: rows.length,
    },
    professional_review_flags: professionalReviewFlags,
  }
}

function parseJsonObject(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(cleaned)
}

function objective(meals: NutritionPlanMeal[], target: NutritionAiGenerationInput) {
  const totals = computePlanMealsTotals(meals)
  const relative = (actual: number, expected: number) =>
    expected > 0 ? (actual - expected) / expected : 0
  return (
    relative(totals.calories, target.calories) ** 2 * 0.7 +
    relative(totals.protein, target.protein_g) ** 2 +
    relative(totals.carbs, target.carbs_g) ** 2 +
    relative(totals.fat, target.fat_g) ** 2
  )
}

function optimizeQuantities(meals: NutritionPlanMeal[], target: NutritionAiGenerationInput) {
  let best = structuredClone(meals)
  let bestScore = objective(best, target)
  for (let pass = 0; pass < 18; pass += 1) {
    let improved = false
    for (let mealIndex = 0; mealIndex < best.length; mealIndex += 1) {
      for (let itemIndex = 0; itemIndex < best[mealIndex].items.length; itemIndex += 1) {
        const current = best[mealIndex].items[itemIndex]
        const step = current.food.category_l1 === "fats" ? 2 : 5
        const min = current.food.category_l1 === "fats" ? 3 : 20
        for (const delta of [-step, step]) {
          const quantity = Math.max(min, Math.min(1000, current.quantity_g + delta))
          const trial = structuredClone(best)
          trial[mealIndex].items[itemIndex].quantity_g = quantity
          const score = objective(trial, target)
          if (score + 0.000001 < bestScore) {
            best = trial
            bestScore = score
            improved = true
          }
        }
      }
    }
    if (!improved) break
  }
  return best
}

function mealTitles(count: number, targetMealTitle?: string) {
  if (count === 1) return [targetMealTitle ?? "Repas"]
  if (count === 2) return ["Déjeuner", "Dîner"]
  if (count === 3) return ["Petit-déjeuner", "Déjeuner", "Dîner"]
  return ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation", "Repas 5", "Repas 6", "Repas 7", "Repas 8"].slice(0, count)
}

function deterministicSelection(candidates: CandidateFood[], input: NutritionAiGenerationInput) {
  const byCategory = (category: CandidateFood["category_l1"]) =>
    candidates.filter((food) => food.category_l1 === category)
  const proteins = byCategory("proteins")
  const carbs = byCategory("carbs")
  const fats = byCategory("fats")
  const plants = [...byCategory("vegetables"), ...byCategory("fruits")]
  if (!proteins.length || !carbs.length || !fats.length) {
    throw new Error("Catalogue compatible insuffisant pour générer le plan.")
  }

  return {
    meals: mealTitles(input.meal_count, input.target_meal_title).map((title, index) => ({
      title,
      items: [
        {
          food_id: proteins[index % proteins.length].id,
          quantity_g: Math.max(50, Math.round((input.protein_g / input.meal_count / Math.max(proteins[index % proteins.length].protein_per_100g, 5)) * 100)),
        },
        {
          food_id: carbs[index % carbs.length].id,
          quantity_g: Math.max(40, Math.round((input.carbs_g / input.meal_count / Math.max(carbs[index % carbs.length].carbs_per_100g, 5)) * 100)),
        },
        {
          food_id: fats[index % fats.length].id,
          quantity_g: Math.max(5, Math.round((input.fat_g / input.meal_count / Math.max(fats[index % fats.length].fat_per_100g, 5)) * 100)),
        },
        ...(plants.length > 0 && index < Math.min(input.meal_count, 3)
          ? [{ food_id: plants[index % plants.length].id, quantity_g: 100 }]
          : []),
      ],
    })),
  }
}

function resolveMeals(
  selection: z.infer<typeof selectionSchema>,
  candidates: CandidateFood[],
) {
  const foodById = new Map(candidates.map((food) => [food.id, food]))
  const categoryAlternatives = new Map<string, CandidateFood[]>()
  for (const food of candidates) {
    const list = categoryAlternatives.get(food.category_l1) ?? []
    list.push(food)
    categoryAlternatives.set(food.category_l1, list)
  }

  return selection.meals.map<NutritionPlanMeal>((meal, mealIndex) => ({
    id: mealIndex === 0 ? "breakfast" : mealIndex === 1 ? "lunch" : mealIndex === 2 ? "dinner" : mealIndex === 3 ? "snack" : `ai-meal-${mealIndex + 1}`,
    title: meal.title,
    items: meal.items.map((item, itemIndex) => {
      const food = foodById.get(item.food_id)
      if (!food) throw new Error("Le modèle a sélectionné un aliment non autorisé.")
      const base = {
        id: `ai-item-${mealIndex + 1}-${itemIndex + 1}`,
        food,
        quantity_g: Math.max(1, Math.min(1000, Math.round(item.quantity_g))),
        alternatives: [],
      }
      const alternative = (categoryAlternatives.get(food.category_l1) ?? [])
        .find((candidate) => candidate.id !== food.id)
      return {
        ...base,
        alternatives: alternative
          ? [{
              id: `ai-alt-${mealIndex + 1}-${itemIndex + 1}`,
              food: alternative,
              quantity_g: computeEquivalentQuantity(base, alternative),
            }]
          : [],
      }
    }),
  }))
}

function confidenceFor(meals: NutritionPlanMeal[], input: NutritionAiGenerationInput) {
  const totals = roundPlanTotals(computePlanMealsTotals(meals))
  const errors = [
    Math.abs(totals.calories - input.calories) / input.calories,
    Math.abs(totals.protein - input.protein_g) / input.protein_g,
    Math.abs(totals.carbs - input.carbs_g) / input.carbs_g,
    Math.abs(totals.fat - input.fat_g) / input.fat_g,
  ]
  const maxError = Math.max(...errors)
  return {
    totals,
    confidence: maxError <= 0.1 ? "high" as const : maxError <= 0.2 ? "medium" as const : "low" as const,
    warnings: maxError > 0.2 ? ["Les quantités nécessitent une vérification coach approfondie."] : [],
  }
}

export function buildDeterministicNutritionMeals(
  candidates: CandidateFood[],
  input: NutritionAiGenerationInput,
) {
  const everydayCandidates = selectEverydayGenerationFoods(candidates)
  const selection = selectionSchema.parse(deterministicSelection(everydayCandidates, input))
  return optimizeQuantities(resolveMeals(selection, everydayCandidates), input)
}

export function evaluateGeneratedNutritionDay(
  meals: NutritionPlanMeal[],
  input: NutritionAiGenerationInput,
) {
  return confidenceFor(meals, input)
}

export async function generateNutritionDayDraft(params: {
  db: SupabaseClient
  clientId: string
  coachId: string
  input: NutritionAiGenerationInput
}) {
  const profile = await loadClientFoodProfile(params.db, params.clientId)
  if (!profile || profile.allergy_status === "unknown") {
    throw new Error("Le statut allergique doit être confirmé avant toute génération.")
  }
  const context = await loadNutritionAiContext(params.db, params.clientId)

  const candidateCategories = ["proteins", "carbs", "fats", "vegetables", "fruits"] as const
  const categoryResults = await Promise.all(
    candidateCategories.map((category) =>
      params.db
        .from("food_items")
        .select(`
          id, name_fr, category_l1, category_l2, icon_key, item_key,
          kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
          source, is_verified, dietary_tags, allergen_tags, ingredients_known
        `)
        .eq("source", "internal")
        .eq("is_verified", true)
        .eq("category_l1", category)
        .order("name_fr")
        .limit(1000),
    ),
  )
  const categoryError = categoryResults.find((result) => result.error)?.error
  if (categoryError) throw categoryError
  const data = categoryResults.flatMap((result) => result.data ?? [])

  const compatible = sortFoodsByCompatibility(
    (data ?? []).map((food) => ({
      ...(food as CandidateFood),
      compatibility: evaluateFoodCompatibility(food as CandidateFood, profile),
    })),
  ).filter((food) => ["priority", "liked", "neutral"].includes(food.compatibility.status))
  const generationCandidates = selectEverydayGenerationFoods(compatible)
  if (generationCandidates.length < 8) throw new Error("Catalogue compatible insuffisant.")

  const promptFoods = generationCandidates.slice(0, 100).map((food) => ({
    id: food.id,
    name: food.name_fr,
    category: food.category_l1,
    subcategory: food.category_l2,
    kcal: food.kcal_per_100g,
    p: food.protein_per_100g,
    c: food.carbs_per_100g,
    f: food.fat_per_100g,
    preference: food.compatibility.status,
  }))

  const llmResult = await callLLM({
    clientId: params.clientId,
    coachId: params.coachId,
    maxTokens: 1800,
    contextSummary: {
      target: params.input,
      candidate_count: promptFoods.length,
      context,
    },
    systemPrompt:
      "Tu composes un brouillon nutritionnel pour un coach. Utilise uniquement les food_id fournis. Privilégie les aliments simples, courants, faciles à cuisiner et à trouver en supermarché. Ne choisis pas de charcuterie, produit salé/séché/fumé, plat préemballé ou huile atypique sauf si cet aliment est explicitement préféré par le client. Retourne uniquement un objet JSON {meals:[{title,items:[{food_id,quantity_g}]}]}. Aucun diagnostic, supplément ou conseil médical. Respecte exactement le nombre de repas demandé.",
    userMessage: JSON.stringify({
      target: params.input,
      context,
      allowed_foods: promptFoods,
    }),
  }, { db: params.db })

  let selection: z.infer<typeof selectionSchema>
  let modelUsed = "deterministic-fallback"
  try {
    selection = selectionSchema.parse(parseJsonObject(llmResult?.content ?? ""))
    if (selection.meals.length !== params.input.meal_count) throw new Error("Nombre de repas invalide")
    modelUsed = "gpt-4o-mini"
  } catch {
    selection = selectionSchema.parse(deterministicSelection(generationCandidates, params.input))
  }

  const optimizedMeals = optimizeQuantities(resolveMeals(selection, generationCandidates), params.input)
  for (const meal of optimizedMeals) {
    for (const item of meal.items) {
      const compatibility = evaluateFoodCompatibility(item.food as CandidateFood, profile)
      if (!["priority", "liked", "neutral"].includes(compatibility.status)) {
        throw new Error(`${item.food.name_fr} n’est plus compatible avec le profil alimentaire.`)
      }
    }
  }

  const quality = confidenceFor(optimizedMeals, params.input)
  const warnings = [
    ...quality.warnings,
    ...(context.professional_review_flags.length > 0
      ? ["Des informations de santé ou de rapport à l’alimentation imposent une validation professionnelle."]
      : []),
  ]
  return {
    meal_plan: optimizedMeals,
    model: modelUsed,
    totals: quality.totals,
    confidence: quality.confidence,
    warnings,
    signals_used: {
      assessment: Object.keys(context.assessment),
      checkin_samples: context.recovery_7d.samples,
      phase: context.baseline.transformation_phase,
      professional_review_required: context.professional_review_flags.length > 0,
    },
    context_snapshot: context,
  }
}
