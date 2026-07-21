import type { SupabaseClient } from "@supabase/supabase-js"
import type { AssessmentModule, BlockConfig, FieldConfig } from "@/types/assessment"
import { DEFAULT_MODULE_FIELDS, MODULE_LABELS } from "@/lib/assessments/modules"

export const RECOMMENDED_ASSESSMENT_SYSTEM_KEY = "stryv_onboarding"
export const RECOMMENDED_ASSESSMENT_VERSION = 1
export const RECOMMENDED_ASSESSMENT_NAME = "Bilan de démarrage recommandé"

const MODULES: AssessmentModule[] = [
  "general",
  "goals",
  "psychology",
  "lifestyle",
  "wellness",
  "cardio",
  "nutrition",
  "food_preferences",
  "medical",
  "training",
  "performance",
  "biometrics",
  "measurements",
  "photos",
]

const REQUIRED_KEYS = new Set([
  "birth_date",
  "gender",
  "height_cm",
  "occupation",
  "chronotype",
  "living_situation",
  "experience_level",
  "primary_goal",
  "motivation",
  "obstacles",
  "diet_history",
  "relationship_with_food",
  "body_image",
  "motivation_stage",
  "coaching_expectation",
  "previous_obstacles",
  "alcohol_weekly",
  "smoking",
  "screen_time_evening",
  "work_hours_per_week",
  "sleep_duration_h",
  "sleep_quality",
  "stress_level",
  "energy_level",
  "mood",
  "libido",
  "diet_type",
  "water_l",
  "meals_per_day",
  "meals_outside_per_week",
  "meal_timing",
  "diet_budget",
  "daily_meal_routine",
  "food_preferences_profile",
  "injuries_active",
  "injuries_history",
  "pathologies",
  "family_history",
  "training_frequency",
  "session_duration_min",
  "training_types",
  "equipment_preference",
  "weight_kg",
])

const HIDDEN_KEYS = new Set([
  "coaching_start_date",
  "blood_pressure",
  "blood_ferritin",
  "blood_vitamin_d",
  "blood_tsh",
  "blood_testosterone",
  "photo_relaxed",
  "skinfold_biceps_mm",
  "skinfold_triceps_mm",
  "skinfold_subscapular_mm",
  "skinfold_suprailiac_mm",
  "bmi",
])

const ACTIVATION_KEYS = new Set([
  "birth_date",
  "gender",
  "height_cm",
  "occupation",
  "experience_level",
  "primary_goal",
  "weight_kg",
  "training_frequency",
  "session_duration_min",
  "training_types",
  "equipment_preference",
  "sleep_duration_h",
  "sleep_quality",
  "stress_level",
  "energy_level",
  "injuries_active",
  "pathologies",
  "diet_type",
  "meals_per_day",
  "food_preferences_profile",
])

const ADVANCED_MODULES = new Set<AssessmentModule>([
  "performance",
  "biometrics",
  "measurements",
  "photos",
])

function stageFor(module: AssessmentModule, key: string): FieldConfig["stage"] {
  if (ACTIVATION_KEYS.has(key)) return "activation"
  if (ADVANCED_MODULES.has(module)) return "advanced"
  return "personalization"
}

export function buildRecommendedAssessmentBlocks(): BlockConfig[] {
  return MODULES.map((module, order) => ({
    id: `stryv_onboarding_v${RECOMMENDED_ASSESSMENT_VERSION}_${module}`,
    module,
    label: MODULE_LABELS[module],
    order,
    fields: DEFAULT_MODULE_FIELDS[module].map((field) => ({
      ...field,
      visible: HIDDEN_KEYS.has(field.key) ? false : true,
      required: REQUIRED_KEYS.has(field.key),
      stage: stageFor(module, field.key),
    })),
  }))
}

export async function ensureRecommendedAssessmentTemplate(
  db: SupabaseClient,
  coachId: string,
) {
  const { data: existing } = await db
    .from("assessment_templates")
    .select("*")
    .eq("coach_id", coachId)
    .eq("system_key", RECOMMENDED_ASSESSMENT_SYSTEM_KEY)
    .maybeSingle()
  if (existing) {
    if (existing.system_version === RECOMMENDED_ASSESSMENT_VERSION) return existing
    const { data: upgraded, error: upgradeError } = await db
      .from("assessment_templates")
      .update({
        name: RECOMMENDED_ASSESSMENT_NAME,
        description:
          "Le socle STRYV pour initialiser les objectifs, l’entraînement, la récupération, la nutrition et la sécurité du client.",
        template_type: "intake",
        blocks: buildRecommendedAssessmentBlocks(),
        origin: "stryv_system",
        system_version: RECOMMENDED_ASSESSMENT_VERSION,
      })
      .eq("id", existing.id)
      .select()
      .single()
    if (upgradeError) throw upgradeError
    return upgraded
  }

  const { data: currentDefault } = await db
    .from("assessment_templates")
    .select("id")
    .eq("coach_id", coachId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle()

  const { data, error } = await db
    .from("assessment_templates")
    .insert({
      coach_id: coachId,
      name: RECOMMENDED_ASSESSMENT_NAME,
      description:
        "Le socle STRYV pour initialiser les objectifs, l’entraînement, la récupération, la nutrition et la sécurité du client.",
      template_type: "intake",
      blocks: buildRecommendedAssessmentBlocks(),
      is_default: !currentDefault,
      origin: "stryv_system",
      system_key: RECOMMENDED_ASSESSMENT_SYSTEM_KEY,
      system_version: RECOMMENDED_ASSESSMENT_VERSION,
    })
    .select()
    .single()
  if (error?.code === "23505") {
    const { data: concurrent, error: concurrentError } = await db
      .from("assessment_templates")
      .select("*")
      .eq("coach_id", coachId)
      .eq("system_key", RECOMMENDED_ASSESSMENT_SYSTEM_KEY)
      .single()
    if (concurrentError) throw concurrentError
    return concurrent
  }
  if (error) throw error
  return data
}
