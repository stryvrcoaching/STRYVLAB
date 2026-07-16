import type { SupabaseClient } from "@supabase/supabase-js"
import { computePhysiologicalDateInTimezone, utcRangeForPhysiologicalDate } from "@/lib/client/checkin/timeWindows"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { computeMacroEnergy } from "@/lib/nutrition/energy"
import { resolveProtocolDayByDate, resolveRestProtocolDay } from "@/lib/nutrition/protocol-schedule"
import { fetchClientDayOverride } from "@/lib/client/day-kind"
import { applySmoothingOverlay } from "@/lib/nutrition/smoothing/apply-overlay"
import { buildSmoothingPlanDays } from "@/lib/nutrition/smoothing/compute-plan"
import { fetchActiveSmoothingPlanDaysForDates, fetchActiveSmoothingPlanForCoach } from "@/lib/nutrition/smoothing/fetch"
import { buildSmoothingProposal } from "@/lib/nutrition/smoothing/rules"
import type {
  NutritionSmoothingDirection,
  NutritionSmoothingPlan,
  NutritionSmoothingPlanDay,
  NutritionSmoothingPlanDayCandidate,
  NutritionSmoothingProposal,
  SmoothingDurationOption,
} from "@/lib/nutrition/smoothing/types"
import {
  normalizePlanMeals,
  type NutritionPlanMeal,
} from "@/lib/nutrition/protocol-builder"
import { calcEntryMacros } from "@/lib/nutrition/food-items"
import { setPrepActivation } from "@/lib/nutrition/preps-service"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { adjustPlanMealsForSmoothing } from "@/lib/nutrition/smoothing/meal-plan-adjustment"

const PROPOSAL_THRESHOLD_KCAL = 150
const MIN_SURPLUS_MEALS_LOGGED = 2
const MIN_SURPLUS_TARGET_RATIO = 0.6
const MIN_DEFICIT_MEALS_LOGGED = 2
const MIN_DEFICIT_TARGET_RATIO = 0.7
const MIN_DEFICIT_DAY_PROGRESS_RATIO = 0.8

type ProtocolDayRecord = {
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
}

type ScheduleSlotRecord = {
  week_index: number
  dow: number
  protocol_day_position: number
}

type SharedProtocolRecord = {
  id: string
  name: string
  schedule_start_date?: string | null
  nutrition_protocol_days?: ProtocolDayRecord[]
  nutrition_protocol_schedule_slots?: ScheduleSlotRecord[]
}

type ConsumedDay = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  mealCount: number
}

type DayTarget = {
  label: string
  protocolDay: ProtocolDayRecord | null
  target: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    water_ml: number
  }
}

type PrepEntryRecord = {
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
  fiber_g: number
}

type ExistingPrepRecord = {
  id: string
  title: string | null
  meal_type: string | null
  meal_slot: SmartPrepSlot
  variant_group_id: string
  scenario_key: string
  scenario_label: string
  is_active: boolean
  status: "planned" | "logged" | "cancelled"
  entries: PrepEntryRecord[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  total_fiber_g: number
  planned_for: string | null
  source_snapshot: Record<string, unknown> | null
}

type CoachPlanMealImpact = {
  mealId: string
  title: string
  baseCalories: number
  adjustedCalories: number
  scalingRatio: number
  itemCount: number
}

export type CoachSmoothingPreviewDay = {
  date: string
  label: string
  baseTargetKcal: number
  adjustedTargetKcal: number
  kcalDelta: number
  scalingRatio: number
  hasCoachPlan: boolean
  meals: CoachPlanMealImpact[]
}

export type CoachSmoothingRecommendationState = {
  date: string
  protocolId: string | null
  protocolName: string | null
  activePlan: NutritionSmoothingPlan | null
  proposal: NutritionSmoothingProposal
  previewDays: CoachSmoothingPreviewDay[]
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function shiftDate(iso: string, offsetDays: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function inferDrinkSlot(mealId: string): SmartPrepSlot {
  if (mealId === "breakfast" || mealId === "lunch" || mealId === "dinner" || mealId === "snack") {
    return mealId
  }
  return "snack"
}

function computeDayProgressRatio(date: string, timezone: string, now = new Date()): number {
  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0
  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), total)
  return elapsed / total
}

export async function fetchLatestSharedProtocol(
  db: SupabaseClient,
  clientId: string,
): Promise<SharedProtocolRecord | null> {
  const { data } = await db
    .from("nutrition_protocols")
    .select("id, name, schedule_start_date, nutrition_protocol_days(id, position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type, meal_plan), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)")
    .eq("client_id", clientId)
    .eq("status", "shared")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as SharedProtocolRecord | null) ?? null
}

export async function resolveDayTarget(
  db: SupabaseClient,
  clientId: string,
  date: string,
  protocol?: SharedProtocolRecord | null,
): Promise<DayTarget> {
  const sharedProtocol = protocol ?? await fetchLatestSharedProtocol(db, clientId)
  const days = (sharedProtocol?.nutrition_protocol_days as ProtocolDayRecord[]) ?? []
  const slots = (sharedProtocol?.nutrition_protocol_schedule_slots as ScheduleSlotRecord[]) ?? []
  const dayOverride = await fetchClientDayOverride(db, clientId, date)
  const baseProtocolDay = resolveProtocolDayByDate(
    date,
    sharedProtocol?.schedule_start_date ?? null,
    days,
    slots,
  )
  const protocolDay = dayOverride?.kind === "off"
    ? resolveRestProtocolDay(days) ?? baseProtocolDay
    : baseProtocolDay

  return {
    label: String(protocolDay?.name ?? "Jour"),
    protocolDay: (protocolDay as ProtocolDayRecord | null) ?? null,
    target: {
      kcal: Number((protocolDay as ProtocolDayRecord | null)?.calories ?? 0),
      protein_g: Number((protocolDay as ProtocolDayRecord | null)?.protein_g ?? 0),
      carbs_g: Number((protocolDay as ProtocolDayRecord | null)?.carbs_g ?? 0),
      fat_g: Number((protocolDay as ProtocolDayRecord | null)?.fat_g ?? 0),
      water_ml: Number((protocolDay as ProtocolDayRecord | null)?.hydration_ml ?? 2500),
    },
  }
}

export async function resolveConsumedForDate(
  db: SupabaseClient,
  clientId: string,
  date: string,
): Promise<ConsumedDay> {
  const { data: meals } = await db
    .from("nutrition_meals")
    .select("id, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
    .eq("client_id", clientId)
    .eq("physiological_date", date)
    .neq("meal_type", "drinks")

  return (meals ?? []).reduce(
    (acc, meal: any) => ({
      kcal: acc.kcal + computeMacroEnergy({
        protein_g: Number(meal.total_protein_g ?? 0),
        carbs_g: Number(meal.total_carbs_g ?? 0),
        fat_g: Number(meal.total_fat_g ?? 0),
        fiber_g: Number(meal.total_fiber_g ?? 0),
      }),
      protein_g: acc.protein_g + Number(meal.total_protein_g ?? 0),
      carbs_g: acc.carbs_g + Number(meal.total_carbs_g ?? 0),
      fat_g: acc.fat_g + Number(meal.total_fat_g ?? 0),
      mealCount: acc.mealCount + 1,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, mealCount: 0 },
  )
}

function computeMealCalories(meal: NutritionPlanMeal) {
  return meal.items.reduce((sum, item) => {
    const macros = calcEntryMacros(item.food as any, item.quantity_g)
    return sum + macros.calories_kcal
  }, 0)
}

function buildMealImpactPreview(
  baseMeals: NutritionPlanMeal[],
  adjustedMeals: NutritionPlanMeal[],
  scalingRatio: number,
): CoachPlanMealImpact[] {
  return baseMeals.map((meal, index) => {
    const adjustedMeal = adjustedMeals[index] ?? meal
    return {
      mealId: String(meal.id),
      title: meal.title,
      baseCalories: Math.round(computeMealCalories(meal)),
      adjustedCalories: Math.round(computeMealCalories(adjustedMeal)),
      scalingRatio,
      itemCount: meal.items.length,
    }
  })
}

function buildPrepEntriesFromMeal(meal: NutritionPlanMeal): {
  entries: PrepEntryRecord[]
  totals: {
    total_calories: number
    total_protein_g: number
    total_carbs_g: number
    total_fat_g: number
    total_fiber_g: number
  }
} {
  const entries = meal.items.map((item) => {
    const macros = calcEntryMacros(item.food as any, item.quantity_g)
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
  })

  const totals = entries.reduce(
    (acc, entry) => ({
      total_calories: acc.total_calories + Number(entry.calories_kcal ?? 0),
      total_protein_g: acc.total_protein_g + Number(entry.protein_g ?? 0),
      total_carbs_g: acc.total_carbs_g + Number(entry.carbs_g ?? 0),
      total_fat_g: acc.total_fat_g + Number(entry.fat_g ?? 0),
      total_fiber_g: acc.total_fiber_g + Number(entry.fiber_g ?? 0),
    }),
    {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
    },
  )

  return {
    entries,
    totals: {
      total_calories: round1(totals.total_calories),
      total_protein_g: round1(totals.total_protein_g),
      total_carbs_g: round1(totals.total_carbs_g),
      total_fat_g: round1(totals.total_fat_g),
      total_fiber_g: round1(totals.total_fiber_g),
    },
  }
}

export async function buildCoachSmoothingState(args: {
  db: SupabaseClient
  coachId: string
  clientId: string
  date: string
  durationDays?: SmoothingDurationOption
}): Promise<CoachSmoothingRecommendationState> {
  const protocol = await fetchLatestSharedProtocol(args.db, args.clientId)
  const activePlan = await fetchActiveSmoothingPlanForCoach(args.db, args.coachId, args.clientId)
  const { target } = await resolveDayTarget(args.db, args.clientId, args.date, protocol)
  const consumed = await resolveConsumedForDate(args.db, args.clientId, args.date)
  const activeOverlayDays = await fetchActiveSmoothingPlanDaysForDates(args.db, args.clientId, [args.date])
  const effectiveTarget = activeOverlayDays.length > 0 ? applySmoothingOverlay(target, activeOverlayDays).target : target
  const timezone = await resolveClientTimezone(args.db, args.clientId)
  const today = computePhysiologicalDateInTimezone(new Date(), timezone)
  const isPastDate = args.date < today
  const isToday = args.date === today
  const dayProgressRatio = isToday ? computeDayProgressRatio(args.date, timezone) : 1
  const targetCoverageRatio = effectiveTarget.kcal > 0 ? consumed.kcal / effectiveTarget.kcal : 0
  const hasEnoughDataForSurplus =
    consumed.mealCount >= MIN_SURPLUS_MEALS_LOGGED ||
    targetCoverageRatio >= MIN_SURPLUS_TARGET_RATIO
  const hasEnoughDataForDeficit =
    consumed.mealCount >= MIN_DEFICIT_MEALS_LOGGED &&
    targetCoverageRatio >= MIN_DEFICIT_TARGET_RATIO &&
    dayProgressRatio >= MIN_DEFICIT_DAY_PROGRESS_RATIO
  const allowSurplus = isPastDate || (isToday && hasEnoughDataForSurplus)
  const allowDeficit = isPastDate || (isToday && hasEnoughDataForDeficit)

  const proposal = buildSmoothingProposal({
    targetKcal: effectiveTarget.kcal,
    consumedKcal: consumed.kcal,
    thresholdKcal: PROPOSAL_THRESHOLD_KCAL,
    allowDeficit,
    allowSurplus,
  })

  const durationDays = args.durationDays ?? proposal.recommendedDurationDays ?? 3
  const previewDays: CoachSmoothingPreviewDay[] = []

  if (protocol && proposal.eligible && proposal.direction) {
    const futureCandidates: NutritionSmoothingPlanDayCandidate[] = []
    for (let index = 1; index <= durationDays; index += 1) {
      const nextDate = shiftDate(args.date, index)
      const resolved = await resolveDayTarget(args.db, args.clientId, nextDate, protocol)
      futureCandidates.push({
        date: nextDate,
        label: resolved.label,
        target_kcal: resolved.target.kcal,
      })
    }

    const planDays = buildSmoothingPlanDays({
      planId: "preview",
      direction: proposal.direction,
      smoothableDeltaKcal: proposal.smoothableDeltaKcal,
      futureDays: futureCandidates,
    })

    for (const day of planDays) {
      const resolved = await resolveDayTarget(args.db, args.clientId, day.date, protocol)
      const meals = normalizePlanMeals(resolved.protocolDay?.meal_plan ?? [])
      const adjustedTargetKcal = Number(day.base_target_kcal ?? 0) + Number(day.kcal_delta ?? 0)
      const adjustedPlan = adjustPlanMealsForSmoothing({
        meals,
        baseTargetKcal: Number(day.base_target_kcal ?? 0),
        adjustedTargetKcal,
      })

      previewDays.push({
        date: day.date,
        label: resolved.label,
        baseTargetKcal: Number(day.base_target_kcal ?? 0),
        adjustedTargetKcal: Math.max(0, Math.round(adjustedTargetKcal)),
        kcalDelta: Number(day.kcal_delta ?? 0),
        scalingRatio: adjustedPlan.scalingRatio,
        hasCoachPlan: meals.some((meal) => meal.items.length > 0),
        meals: buildMealImpactPreview(meals, adjustedPlan.meals, adjustedPlan.scalingRatio),
      })
    }
  }

  return {
    date: args.date,
    protocolId: protocol?.id ?? null,
    protocolName: protocol?.name ?? null,
    activePlan,
    proposal,
    previewDays,
  }
}

export async function resolveFutureCandidatesForPlan(
  db: SupabaseClient,
  clientId: string,
  sourceDate: string,
  durationDays: number,
  protocol?: SharedProtocolRecord | null,
): Promise<NutritionSmoothingPlanDayCandidate[]> {
  const sharedProtocol = protocol ?? await fetchLatestSharedProtocol(db, clientId)
  const candidates: NutritionSmoothingPlanDayCandidate[] = []

  for (let index = 1; index <= durationDays; index += 1) {
    const nextDate = shiftDate(sourceDate, index)
    const resolved = await resolveDayTarget(db, clientId, nextDate, sharedProtocol)
    candidates.push({
      date: nextDate,
      label: resolved.label,
      target_kcal: resolved.target.kcal,
    })
  }

  return candidates
}

function resolveDirectionFromSignedDelta(signedSmoothableDelta: number): NutritionSmoothingDirection {
  return signedSmoothableDelta >= 0 ? "surplus" : "deficit"
}

export function buildPlanFromProposal(args: {
  planId: string
  sourceDate: string
  direction: NutritionSmoothingDirection
  smoothableDeltaKcal: number
  futureDays: NutritionSmoothingPlanDayCandidate[]
}) {
  return buildSmoothingPlanDays({
    planId: args.planId,
    direction: args.direction,
    smoothableDeltaKcal: args.smoothableDeltaKcal,
    futureDays: args.futureDays,
  })
}

type PersistMode = "create_override" | "restore_existing"

async function upsertAdjustedPrepForMeal(args: {
  db: SupabaseClient
  clientId: string
  plan: NutritionSmoothingPlan
  date: string
  protocolId: string
  dayPosition: number
  meal: NutritionPlanMeal
  adjustedMeal: NutritionPlanMeal
  scalingRatio: number
  scenarioLabel?: string
}) {
  const prepared = buildPrepEntriesFromMeal(args.adjustedMeal)
  const sourceFilter = {
    client_id: args.clientId,
    physiological_date: args.date,
    source_type: "coach_plan",
    source_protocol_id: args.protocolId,
    source_day_position: args.dayPosition,
    source_meal_id: String(args.meal.id),
  }

  const { data: existing } = await args.db
    .from("client_nutrition_preps")
    .select("id, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, planned_for, source_snapshot")
    .match(sourceFilter)
    .neq("status", "cancelled")
    .maybeSingle()

  if ((existing as ExistingPrepRecord | null)?.status === "logged") {
    return
  }

  const mealSlot = inferDrinkSlot(String(args.meal.id))
  const variantGroupId = `coach:${args.protocolId}:${args.dayPosition}:${String(args.meal.id)}`
  const snapshot = {
    kind: "nutrition_smoothing",
    plan_id: args.plan.id,
    source_date: args.plan.source_date,
    scaling_ratio: args.scalingRatio,
    base_meal: args.meal,
    restore_mode: existing ? "restore_existing" : "create_override",
    original_prep: existing
      ? {
          title: existing.title,
          meal_type: existing.meal_type,
          meal_slot: existing.meal_slot,
          variant_group_id: existing.variant_group_id,
          scenario_key: existing.scenario_key,
          scenario_label: existing.scenario_label,
          is_active: existing.is_active,
          entries: existing.entries,
          total_calories: existing.total_calories,
          total_protein_g: existing.total_protein_g,
          total_carbs_g: existing.total_carbs_g,
          total_fat_g: existing.total_fat_g,
          total_fiber_g: existing.total_fiber_g,
          planned_for: existing.planned_for,
          source_snapshot: existing.source_snapshot,
        }
      : null,
    adjusted_meal: args.adjustedMeal,
  }

  const payload = {
    client_id: args.clientId,
    physiological_date: args.date,
    title: args.adjustedMeal.title,
    meal_type: mealSlot,
    meal_slot: mealSlot,
    variant_group_id: variantGroupId,
    scenario_key: "default",
    scenario_label: args.scenarioLabel ?? "Lissage coach",
    is_active: true,
    status: "planned",
    entries: prepared.entries,
    planned_for: `${args.date}T12:00:00.000Z`,
    source_type: "coach_plan",
    source_protocol_id: args.protocolId,
    source_day_position: args.dayPosition,
    source_meal_id: String(args.meal.id),
    source_snapshot: snapshot,
    ...prepared.totals,
  }

  const query = existing?.id
    ? args.db.from("client_nutrition_preps").update(payload).eq("id", existing.id)
    : args.db.from("client_nutrition_preps").insert(payload)

  const { data, error } = await query
    .select("id, physiological_date, meal_slot, variant_group_id, scenario_key")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Failed to persist smoothing prep")

  const activationError = await setPrepActivation({
    clientId: args.clientId,
    prepId: data.id,
    physiologicalDate: data.physiological_date,
    mealSlot: data.meal_slot as SmartPrepSlot,
    variantGroupId: data.variant_group_id,
    scenarioKey: data.scenario_key,
  })

  if (activationError) throw new Error(activationError.message)
}

export async function materializeCoachSmoothingPreps(args: {
  db: SupabaseClient
  clientId: string
  plan: NutritionSmoothingPlan
  protocol?: SharedProtocolRecord | null
}) {
  const protocol = args.protocol ?? await fetchLatestSharedProtocol(args.db, args.clientId)
  if (!protocol) return

  for (const planDay of args.plan.days ?? []) {
    const resolved = await resolveDayTarget(args.db, args.clientId, planDay.date, protocol)
    if (!resolved.protocolDay) continue
    const meals = normalizePlanMeals(resolved.protocolDay.meal_plan ?? []).filter((meal) => meal.items.length > 0)
    if (meals.length === 0) continue

    const adjustedTargetKcal = Number(planDay.base_target_kcal ?? 0) + Number(planDay.kcal_delta ?? 0)
    const adjustedPlan = adjustPlanMealsForSmoothing({
      meals,
      baseTargetKcal: Number(planDay.base_target_kcal ?? 0),
      adjustedTargetKcal,
    })

    for (let index = 0; index < meals.length; index += 1) {
      const meal = meals[index]
      const adjustedMeal = adjustedPlan.meals[index] ?? meal
      await upsertAdjustedPrepForMeal({
        db: args.db,
        clientId: args.clientId,
        plan: args.plan,
        date: planDay.date,
        protocolId: protocol.id,
        dayPosition: resolved.protocolDay.position,
        meal,
        adjustedMeal,
        scalingRatio: adjustedPlan.scalingRatio,
      })
    }
  }
}

export async function clearCoachSmoothingPreps(args: {
  db: SupabaseClient
  clientId: string
  plan: NutritionSmoothingPlan
}) {
  const dates = (args.plan.days ?? []).map((day) => day.date)
  if (dates.length === 0) return

  const { data: preps } = await args.db
    .from("client_nutrition_preps")
    .select("id, status, source_snapshot")
    .eq("client_id", args.clientId)
    .eq("source_type", "coach_plan")
    .in("physiological_date", dates)

  for (const prep of (preps ?? []) as Array<{ id: string; status: string; source_snapshot: any }>) {
    if (prep.status !== "planned") continue
    const snapshot = prep.source_snapshot as Record<string, any> | null
    if (snapshot?.kind !== "nutrition_smoothing" || snapshot?.plan_id !== args.plan.id) continue

    if (snapshot.restore_mode === "restore_existing" && snapshot.original_prep) {
      const original = snapshot.original_prep as Record<string, any>
      const { error } = await args.db
        .from("client_nutrition_preps")
        .update({
          title: original.title ?? null,
          meal_type: original.meal_type ?? null,
          meal_slot: original.meal_slot,
          variant_group_id: original.variant_group_id,
          scenario_key: original.scenario_key,
          scenario_label: original.scenario_label,
          is_active: original.is_active,
          entries: original.entries ?? [],
          total_calories: original.total_calories ?? 0,
          total_protein_g: original.total_protein_g ?? 0,
          total_carbs_g: original.total_carbs_g ?? 0,
          total_fat_g: original.total_fat_g ?? 0,
          total_fiber_g: original.total_fiber_g ?? 0,
          planned_for: original.planned_for ?? null,
          source_snapshot: original.source_snapshot ?? null,
        })
        .eq("id", prep.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await args.db
        .from("client_nutrition_preps")
        .delete()
        .eq("id", prep.id)
      if (error) throw new Error(error.message)
    }
  }
}

export async function ensureCoachSmoothingRecommendationNotification(args: {
  db: SupabaseClient
  coachId: string
  clientId: string
  protocolId: string | null
  sourceDate: string
  proposal: NutritionSmoothingProposal
}) {
  const payloadMatcher = {
    source_date: args.sourceDate,
    entity_type: "nutrition_smoothing_recommendation",
  }

  const { data: existing } = await args.db
    .from("coach_notifications")
    .select("id, status")
    .eq("coach_id", args.coachId)
    .eq("client_id", args.clientId)
    .eq("category", "nutrition_trend")
    .eq("subcategory", "calorie_smoothing_recommended")
    .contains("payload", payloadMatcher)

  if (!args.proposal.eligible || !args.proposal.direction || !args.protocolId) {
    if ((existing ?? []).length > 0) {
      await args.db
        .from("coach_notifications")
        .update({ status: "resolved" })
        .eq("coach_id", args.coachId)
        .eq("client_id", args.clientId)
        .eq("category", "nutrition_trend")
        .eq("subcategory", "calorie_smoothing_recommended")
        .contains("payload", payloadMatcher)
    }
    return
  }

  if ((existing ?? []).some((row: any) => row.status === "pending")) return

  await args.db.from("coach_notifications").insert({
    coach_id: args.coachId,
    client_id: args.clientId,
    category: "nutrition_trend",
    subcategory: "calorie_smoothing_recommended",
    priority: 3,
    status: "pending",
    email_sent: false,
    title: "Lissage calorique recommandé",
    body: "Un lissage calorique coach peut être appliqué depuis Nutrition Studio.",
    payload: {
      entity_type: "nutrition_smoothing_recommendation",
      source_date: args.sourceDate,
      direction: args.proposal.direction,
      smoothable_delta_kcal: args.proposal.smoothableDeltaKcal,
      duration_days: args.proposal.recommendedDurationDays,
      action_url: `/coach/clients/${args.clientId}/protocoles/nutrition/${args.protocolId}/edit?smoothingDate=${args.sourceDate}&tab=builder`,
    },
  })
}

export function combineSmoothableDelta(activePlan: NutritionSmoothingPlan | null, proposal: NutritionSmoothingProposal, mode: "create" | "add" | "replace") {
  let signedSmoothableDelta = proposal.smoothableDeltaKcal
  if (proposal.direction === "deficit") {
    signedSmoothableDelta = -Math.abs(signedSmoothableDelta)
  }

  if (activePlan && mode === "add") {
    signedSmoothableDelta += Number(activePlan.smoothable_delta_kcal ?? 0)
  }

  return {
    signedSmoothableDelta,
    direction: resolveDirectionFromSignedDelta(signedSmoothableDelta),
  }
}
