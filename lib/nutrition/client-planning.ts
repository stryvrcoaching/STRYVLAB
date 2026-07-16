import { calcEntryMacros } from "@/lib/nutrition/food-items"
import {
  normalizePlanMeals,
  type NutritionPlanMeal,
  type NutritionPlanItem,
} from "@/lib/nutrition/protocol-builder"
import { adjustPlanMealsForSmoothing } from "@/lib/nutrition/smoothing/meal-plan-adjustment"
import { adjustPlanMealsForCycle } from "@/lib/nutrition/cycle-meal-plan-adjustment"
import type { CycleSyncAdjustment } from "@/lib/nutrition/engine/cycleSync"
import type { NutritionSmoothingPlanDay } from "@/lib/nutrition/smoothing/types"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"

export type CoachPlanPrepSource = {
  source_type?: "client_planned" | "coach_plan" | null
  source_protocol_id?: string | null
  source_day_position?: number | null
  source_meal_id?: string | null
  source_snapshot?: unknown
}

export type ClientPlanningPrep = CoachPlanPrepSource & {
  id: string
  physiological_date: string
  title: string | null
  meal_type: string | null
  meal_slot: SmartPrepSlot
  variant_group_id: string
  scenario_key: string
  scenario_label: string
  is_active: boolean
  status: "planned" | "logged" | "cancelled"
  entries: Array<{
    food_item_id: string
    name_fr: string
    category_l1?: string | null
    category_l2?: string | null
    icon_key?: string | null
    quantity_g: number
    calories_kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
  }>
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_fiber_g: number
  consumed_meal_id?: string | null
  planned_for: string | null
  created_at?: string | null
  updated_at?: string | null
  is_virtual?: boolean
}

type ProtocolDayWithMealPlan = {
  id?: string
  position: number
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  hydration_ml?: number | null
  carb_cycle_type?: string | null
  meal_plan?: NutritionPlanMeal[] | null
  [key: string]: unknown
}

type ProtocolWithMealPlan = {
  id: string
  schedule_start_date?: string | null
  nutrition_protocol_days?: ProtocolDayWithMealPlan[]
  nutrition_protocol_schedule_slots?: Array<{
    week_index: number
    dow: number
    protocol_day_position: number
  }>
}

const SLOT_BY_MEAL_ID: Record<string, SmartPrepSlot> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function entryFromPlanItem(item: NutritionPlanItem) {
  const macros = calcEntryMacros(item.food, item.quantity_g)
  return {
    food_item_id: item.food.id,
    name_fr: item.food.name_fr,
    category_l1: item.food.category_l1,
    category_l2: item.food.category_l2,
    icon_key: item.food.icon_key,
    quantity_g: item.quantity_g,
    calories_kcal: macros.calories_kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
  }
}

export function totalsFromPlanningEntries(entries: ClientPlanningPrep["entries"]) {
  return entries.reduce(
    (acc, entry) => ({
      total_calories: round1(acc.total_calories + Number(entry.calories_kcal ?? 0)),
      total_protein_g: round1(acc.total_protein_g + Number(entry.protein_g ?? 0)),
      total_carbs_g: round1(acc.total_carbs_g + Number(entry.carbs_g ?? 0)),
      total_fat_g: round1(acc.total_fat_g + Number(entry.fat_g ?? 0)),
      total_fiber_g: round1(acc.total_fiber_g + Number(entry.fiber_g ?? 0)),
    }),
    {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
    },
  )
}

function buildVirtualCoachPrep({
  date,
  protocolId,
  dayPosition,
  meal,
  scenarioLabel,
}: {
  date: string
  protocolId: string
  dayPosition: number
  meal: NutritionPlanMeal
  scenarioLabel?: string
}): ClientPlanningPrep | null {
  const entries = meal.items.map(entryFromPlanItem)
  if (entries.length === 0) return null

  const slot = SLOT_BY_MEAL_ID[String(meal.id)] ?? "snack"
  const totals = totalsFromPlanningEntries(entries)

  return {
    id: `coach:${protocolId}:${date}:${dayPosition}:${String(meal.id)}`,
    physiological_date: date,
    title: meal.title,
    meal_type: slot,
    meal_slot: slot,
    variant_group_id: `coach:${protocolId}:${dayPosition}:${String(meal.id)}`,
    scenario_key: "default",
    scenario_label: scenarioLabel ?? "Planning",
    is_active: true,
    status: "planned",
    entries,
    ...totals,
    consumed_meal_id: null,
    planned_for: `${date}T12:00:00.000Z`,
    source_type: "coach_plan",
    source_protocol_id: protocolId,
    source_day_position: dayPosition,
    source_meal_id: String(meal.id),
    source_snapshot: meal,
    is_virtual: true,
  }
}

export function mergeCoachPlanPreps({
  date,
  protocol,
  protocolDay,
  persistedPreps,
  smoothingDay,
  cycleAdjustment,
}: {
  date: string
  protocol: ProtocolWithMealPlan | null | undefined
  protocolDay: ProtocolDayWithMealPlan | null | undefined
  persistedPreps: ClientPlanningPrep[]
  smoothingDay?: Pick<NutritionSmoothingPlanDay, "base_target_kcal" | "kcal_delta"> | null
  cycleAdjustment?: Pick<CycleSyncAdjustment, "proteinDelta" | "carbsDelta" | "fatDelta"> | null
}): ClientPlanningPrep[] {
  if (!protocol?.id || !protocolDay) return persistedPreps

  const persistedBySource = new Map<string, ClientPlanningPrep>()
  for (const prep of persistedPreps) {
    if (
      prep.source_type === "coach_plan" &&
      prep.source_protocol_id &&
      prep.source_day_position != null &&
      prep.source_meal_id
    ) {
      persistedBySource.set(
        `${prep.source_protocol_id}:${prep.source_day_position}:${prep.source_meal_id}`,
        prep,
      )
    }
  }

  const baseCoachMeals = normalizePlanMeals(protocolDay.meal_plan ?? [])
  const adjustedTargetKcal =
    smoothingDay != null
      ? Number(smoothingDay.base_target_kcal ?? 0) + Number(smoothingDay.kcal_delta ?? 0)
      : null
  const adjustedCoachMeals = adjustedTargetKcal != null
    ? adjustPlanMealsForSmoothing({
        meals: baseCoachMeals,
        baseTargetKcal: Number(smoothingDay?.base_target_kcal ?? protocolDay.calories ?? 0),
        adjustedTargetKcal,
      })
    : { meals: baseCoachMeals, scalingRatio: 1, strategy: "none" as const }
  const cycleAdjustedCoachMeals = cycleAdjustment
    ? adjustPlanMealsForCycle({ meals: adjustedCoachMeals.meals, adjustment: cycleAdjustment })
    : { meals: adjustedCoachMeals.meals, adjusted: false }
  const scenarioLabel = cycleAdjustedCoachMeals.adjusted
    ? adjustedCoachMeals.strategy !== "none" && adjustedCoachMeals.scalingRatio !== 1
      ? "Planning ajusté · Cycle Sync"
      : "Planning adapté au cycle"
    : adjustedCoachMeals.strategy !== "none" && adjustedCoachMeals.scalingRatio !== 1
      ? "Planning ajusté"
      : "Planning"
  const virtualPreps = cycleAdjustedCoachMeals.meals
    .map((meal) =>
      buildVirtualCoachPrep({
        date,
        protocolId: protocol.id,
        dayPosition: protocolDay.position,
        meal,
        scenarioLabel,
      }),
    )
    .filter((prep): prep is ClientPlanningPrep => Boolean(prep))
    .filter((prep) => {
      const sourceKey = `${prep.source_protocol_id}:${prep.source_day_position}:${prep.source_meal_id}`
      return !persistedBySource.has(sourceKey)
    })

  return [...persistedPreps, ...virtualPreps].sort((a, b) => {
    const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }
    return (order[a.meal_slot] ?? 9) - (order[b.meal_slot] ?? 9)
  })
}
