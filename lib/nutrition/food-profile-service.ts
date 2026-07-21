import type { SupabaseClient } from "@supabase/supabase-js"
import {
  FOOD_FRAMEWORKS,
  foodPreferenceAssessmentSchema,
  type FoodPreferenceAssessmentValue,
} from "@/lib/nutrition/food-preferences"
import type { FoodProfileSnapshot } from "@/lib/nutrition/food-compatibility"

type SyncFoodProfileParams = {
  clientId: string
  coachId: string
  value: unknown
  sourceType: "assessment" | "coach" | "client" | "system"
  sourceId?: string | null
  actorId?: string | null
  confirmAllergyRemoval?: boolean
}

export class FoodAllergyRemovalConfirmationError extends Error {
  constructor() {
    super("La suppression d’une allergie doit être confirmée explicitement.")
    this.name = "FoodAllergyRemovalConfirmationError"
  }
}

export async function loadClientFoodProfile(
  db: SupabaseClient,
  clientId: string,
): Promise<FoodProfileSnapshot | null> {
  const [{ data: profile }, { data: rules }] = await Promise.all([
    db
      .from("client_food_profiles")
      .select("allergy_status, version")
      .eq("client_id", clientId)
      .maybeSingle(),
    db
      .from("client_food_rules")
      .select(
        "id, kind, target_type, food_item_id, taxonomy_key, label, severity, classification_status, active",
      )
      .eq("client_id", clientId)
      .eq("active", true),
  ])

  if (!profile) return null
  return {
    allergy_status: profile.allergy_status,
    version: Number(profile.version ?? 1),
    rules: (rules ?? []) as FoodProfileSnapshot["rules"],
  }
}

function ruleRows(
  parsed: FoodPreferenceAssessmentValue,
  params: SyncFoodProfileParams,
) {
  const common = {
    client_id: params.clientId,
    coach_id: params.coachId,
    source_type: params.sourceType,
    source_id: params.sourceId ?? null,
    created_by: params.actorId ?? null,
    confirmed_at: new Date().toISOString(),
    active: true,
  }
  const target = (entry: {
    target_type: "food_item" | "taxonomy" | "free_text"
    food_item_id?: string | null
    taxonomy_key?: string | null
    label: string
  }) => ({
    target_type: entry.target_type,
    food_item_id: entry.food_item_id ?? null,
    taxonomy_key: entry.taxonomy_key ?? null,
    label: entry.label,
    classification_status:
      entry.target_type === "free_text" ? "unclassified" : "classified",
  })

  return [
    ...parsed.allergies.map((entry) => ({
      ...common,
      ...target(entry),
      kind: "allergy",
      severity: entry.severity,
    })),
    ...parsed.intolerances.map((entry) => ({
      ...common,
      ...target(entry),
      kind: "intolerance",
      severity: entry.severity,
    })),
    ...parsed.frameworks.map((framework) => ({
      ...common,
      kind: "framework",
      target_type: "taxonomy",
      taxonomy_key: framework,
      food_item_id: null,
      label:
        FOOD_FRAMEWORKS.find((entry) => entry.key === framework)?.label ??
        framework,
      severity: null,
      classification_status: "classified",
    })),
    ...parsed.preferences.map((entry) => ({
      ...common,
      ...target(entry),
      kind: entry.status,
      severity: null,
    })),
  ]
}

export async function syncClientFoodProfile(
  db: SupabaseClient,
  params: SyncFoodProfileParams,
) {
  const parsed = foodPreferenceAssessmentSchema.parse(params.value)
  const current = await loadClientFoodProfile(db, params.clientId)
  const targetKey = (target: {
    target_type: string
    food_item_id?: string | null
    taxonomy_key?: string | null
    label: string
  }) =>
    `${target.target_type}:${target.food_item_id ?? target.taxonomy_key ?? target.label.toLowerCase()}`
  const nextAllergyKeys = new Set(parsed.allergies.map(targetKey))
  const removedAllergies =
    current?.rules.filter((rule) => rule.kind === "allergy" && !nextAllergyKeys.has(targetKey(rule))) ?? []
  if (removedAllergies.length > 0 && !params.confirmAllergyRemoval) {
    throw new FoodAllergyRemovalConfirmationError()
  }
  const nextVersion = (current?.version ?? 0) + 1
  const now = new Date().toISOString()

  const { error: profileError } = await db.from("client_food_profiles").upsert(
    {
      client_id: params.clientId,
      coach_id: params.coachId,
      allergy_status: parsed.allergy_status,
      version: nextVersion,
      last_source_type: params.sourceType,
      last_source_id: params.sourceId ?? null,
      updated_by: params.actorId ?? null,
      updated_at: now,
    },
    { onConflict: "client_id" },
  )
  if (profileError) throw profileError

  const { error: deactivateError } = await db
    .from("client_food_rules")
    .update({
      active: false,
      deactivated_at: now,
      deactivated_by: params.actorId ?? null,
      deactivation_reason: `Remplacé par le profil v${nextVersion}`,
    })
    .eq("client_id", params.clientId)
    .eq("active", true)
  if (deactivateError) throw deactivateError

  const rows = ruleRows(parsed, params)
  if (rows.length > 0) {
    const { error: rulesError } = await db.from("client_food_rules").insert(rows)
    if (rulesError) throw rulesError
  }

  const snapshot = {
    allergy_status: parsed.allergy_status,
    frameworks: parsed.frameworks,
    allergies: parsed.allergies,
    intolerances: parsed.intolerances,
    preferences: parsed.preferences,
  }
  const { error: eventError } = await db.from("client_food_profile_events").insert({
    client_id: params.clientId,
    coach_id: params.coachId,
    profile_version: nextVersion,
    event_type:
      removedAllergies.length > 0
        ? "allergy_removed"
        : current
          ? "rules_updated"
          : "profile_created",
    actor_id: params.actorId ?? null,
    source_type: params.sourceType,
    source_id: params.sourceId ?? null,
    snapshot,
  })
  if (eventError) throw eventError

  return { version: nextVersion, profile: snapshot }
}

export function foodProfileValueFromRules(profile: FoodProfileSnapshot | null) {
  if (!profile) return null
  return {
    allergy_status: profile.allergy_status,
    allergies: profile.rules
      .filter((rule) => rule.kind === "allergy")
      .map((rule) => ({
        target_type: rule.target_type,
        food_item_id: rule.food_item_id ?? null,
        taxonomy_key: rule.taxonomy_key ?? null,
        label: rule.label,
        severity: rule.severity ?? "strict",
      })),
    intolerances: profile.rules
      .filter((rule) => rule.kind === "intolerance")
      .map((rule) => ({
        target_type: rule.target_type,
        food_item_id: rule.food_item_id ?? null,
        taxonomy_key: rule.taxonomy_key ?? null,
        label: rule.label,
        severity: rule.severity ?? "avoid",
      })),
    frameworks: profile.rules
      .filter((rule) => rule.kind === "framework")
      .map((rule) => rule.taxonomy_key)
      .filter(Boolean),
    preferences: profile.rules
      .filter((rule) => ["liked", "disliked", "must_keep"].includes(rule.kind))
      .map((rule) => ({
        target_type: rule.target_type,
        food_item_id: rule.food_item_id ?? null,
        taxonomy_key: rule.taxonomy_key ?? null,
        label: rule.label,
        status: rule.kind,
      })),
  }
}
