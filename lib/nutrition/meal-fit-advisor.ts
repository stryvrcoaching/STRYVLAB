import type { CategoryL1 } from "@/lib/nutrition/food-items"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import { computeActionableRemaining, type ActionableRemainingProfile } from "@/lib/nutrition/actionable-remaining"

export type MealFitStatus = "good" | "watch" | "adjust"
export type MealFitSeverity = "info" | "warning" | "critical"
export type MealFitReason = "calories" | "protein" | "carbs" | "fat"

export interface MealFitComponent {
  name: string
  category_hint: CategoryL1
  quantity_g: number
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
}

export interface MealFitPrimaryAction {
  type: "reduce" | "increase"
  componentIndex: number
  componentName: string
  fromG: number
  toG: number
  reason: MealFitReason
  copy: string
}

export interface MealFitSecondarySuggestion {
  type: "add"
  label: string
}

export interface MealFitAdvisorResult {
  status: MealFitStatus
  severity: MealFitSeverity
  title: string
  message: string
  primaryAction?: MealFitPrimaryAction
  secondarySuggestion?: MealFitSecondarySuggestion
  projected: Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">
}

export interface MealFitAdvisorInput {
  target: Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">
  consumedToday: Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">
  mealComponents: MealFitComponent[]
  measuredWeightG?: number | null
  profile?: ActionableRemainingProfile
}

const CALORIE_WARN_KCAL = 80
const CALORIE_CRITICAL_KCAL = 180
const PROTEIN_LOW_G = 20
const MACRO_WARN_G = 10

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function componentMacros(component: MealFitComponent) {
  const factor = Math.max(0, component.quantity_g) / 100
  return {
    kcal: round1(
      component.protein_per_100g * factor * 4 +
      component.carbs_per_100g * factor * 4 +
      component.fat_per_100g * factor * 9,
    ),
    protein_g: round1(component.protein_per_100g * factor),
    carbs_g: round1(component.carbs_per_100g * factor),
    fat_g: round1(component.fat_per_100g * factor),
  }
}

function sumMeal(components: MealFitComponent[]) {
  return components.reduce(
    (totals, component) => {
      const macros = componentMacros(component)
      totals.kcal = round1(totals.kcal + macros.kcal)
      totals.protein_g = round1(totals.protein_g + macros.protein_g)
      totals.carbs_g = round1(totals.carbs_g + macros.carbs_g)
      totals.fat_g = round1(totals.fat_g + macros.fat_g)
      return totals
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
}

function sumWeight(components: MealFitComponent[]) {
  return components.reduce((sum, component) => sum + Math.max(0, Number(component.quantity_g ?? 0)), 0)
}

function addTotals(
  left: Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
  right: Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
) {
  return {
    kcal: round1(left.kcal + right.kcal),
    protein_g: round1(left.protein_g + right.protein_g),
    carbs_g: round1(left.carbs_g + right.carbs_g),
    fat_g: round1(left.fat_g + right.fat_g),
  }
}

function getReducibleMacroPerGram(component: MealFitComponent, reason: "carbs" | "fat" | "calories") {
  if (reason === "carbs") return component.carbs_per_100g / 100
  if (reason === "fat") return component.fat_per_100g / 100
  return (
    component.protein_per_100g * 4 +
    component.carbs_per_100g * 4 +
    component.fat_per_100g * 9
  ) / 100
}

function chooseReductionCandidate(components: MealFitComponent[], reason: "carbs" | "fat" | "calories") {
  const candidates = components
    .map((component, index) => ({ component, index, density: getReducibleMacroPerGram(component, reason) }))
    .filter(({ component, density }) => component.quantity_g > 20 && density > 0)

  if (reason === "calories") {
    return candidates
      .filter(({ component }) => component.category_hint !== "proteins")
      .sort((a, b) => b.density - a.density)[0] ?? candidates.sort((a, b) => b.density - a.density)[0] ?? null
  }

  return candidates.sort((a, b) => b.density - a.density)[0] ?? null
}

function chooseProteinCandidate(components: MealFitComponent[]) {
  return components
    .map((component, index) => ({ component, index, density: component.protein_per_100g / 100 }))
    .filter(({ component, density }) => component.quantity_g > 0 && density > 0.08)
    .sort((a, b) => b.density - a.density)[0] ?? null
}

function buildReductionAction({
  components,
  reason,
  excess,
  strict,
}: {
  components: MealFitComponent[]
  reason: "carbs" | "fat" | "calories"
  excess: number
  strict: boolean
}): MealFitPrimaryAction | undefined {
  const candidate = chooseReductionCandidate(components, reason)
  if (!candidate) return undefined

  const perGram = getReducibleMacroPerGram(candidate.component, reason)
  if (perGram <= 0) return undefined

  const reductionG = Math.ceil(excess / perGram)
  const minPortion = candidate.component.category_hint === "fats" ? 3 : 40
  const toG = Math.max(minPortion, Math.round(candidate.component.quantity_g - reductionG))
  if (toG >= candidate.component.quantity_g) return undefined

  const verb = strict ? "Réduis" : "Tu peux réduire"
  const around = strict ? "à" : "autour de"
  const label = reason === "fat" ? "les lipides" : reason === "carbs" ? "les glucides" : "les calories"

  return {
    type: "reduce",
    componentIndex: candidate.index,
    componentName: candidate.component.name,
    fromG: Math.round(candidate.component.quantity_g),
    toG,
    reason,
    copy: `${verb} ${candidate.component.name} ${around} ${toG} g pour calmer ${label}.`,
  }
}

function buildProteinAction({
  components,
  missingProteinG,
  caloriesRemaining,
  measuredWeightG,
  currentTotalG,
  strict,
}: {
  components: MealFitComponent[]
  missingProteinG: number
  caloriesRemaining: number
  measuredWeightG?: number | null
  currentTotalG: number
  strict: boolean
}): MealFitPrimaryAction | undefined {
  const candidate = chooseProteinCandidate(components)
  if (!candidate) return undefined

  const proteinPerGram = candidate.component.protein_per_100g / 100
  if (proteinPerGram <= 0) return undefined

  const addG = Math.ceil(Math.min(missingProteinG, 25) / proteinPerGram)
  const addedKcal = addG * getReducibleMacroPerGram(candidate.component, "calories")
  if (caloriesRemaining < 80 && addedKcal > Math.max(40, caloriesRemaining + 40)) return undefined
  if (measuredWeightG && currentTotalG + addG > measuredWeightG * 1.08) return undefined

  const toG = Math.round(candidate.component.quantity_g + addG)
  const verb = strict ? "Monte" : "Tu peux monter"

  return {
    type: "increase",
    componentIndex: candidate.index,
    componentName: candidate.component.name,
    fromG: Math.round(candidate.component.quantity_g),
    toG,
    reason: "protein",
    copy: `${verb} ${candidate.component.name} autour de ${toG} g pour sécuriser les protéines.`,
  }
}

export function evaluateMealFit({
  target,
  consumedToday,
  mealComponents,
  measuredWeightG,
  profile,
}: MealFitAdvisorInput): MealFitAdvisorResult {
  const mealTotals = sumMeal(mealComponents)
  const currentTotalG = sumWeight(mealComponents)
  const projected = addTotals(consumedToday, mealTotals)
  const before = computeActionableRemaining({ target, consumed: consumedToday, profile })
  const after = computeActionableRemaining({ target, consumed: projected, profile })

  const calorieOverflow = Math.max(0, projected.kcal - target.kcal)
  const proteinMissing = Math.max(0, target.protein_g - projected.protein_g)
  const carbsOverflow = after.overflow.carbs_g
  const fatOverflow = after.overflow.fat_g
  const caloriesRemaining = target.kcal - projected.kcal
  const strict = calorieOverflow >= CALORIE_CRITICAL_KCAL || carbsOverflow >= 25 || fatOverflow >= 12

  if (calorieOverflow > CALORIE_WARN_KCAL) {
    const reason: "carbs" | "fat" | "calories" =
      carbsOverflow >= MACRO_WARN_G || before.overflow.fat_g > 0
        ? "carbs"
        : fatOverflow >= MACRO_WARN_G
          ? "fat"
          : "calories"
    const excess = reason === "carbs"
      ? Math.max(carbsOverflow, calorieOverflow / 4)
      : reason === "fat"
        ? Math.max(fatOverflow, calorieOverflow / 9)
        : calorieOverflow
    const primaryAction = buildReductionAction({ components: mealComponents, reason, excess, strict })

    return {
      status: "adjust",
      severity: strict ? "critical" : "warning",
      title: strict ? "Calories trop hautes" : "Calories à surveiller",
      message: primaryAction?.copy ?? "Le repas dépasse ton budget calorique. Garde les protéines et ajuste surtout les glucides ou les lipides.",
      primaryAction,
      projected,
    }
  }

  if (proteinMissing >= PROTEIN_LOW_G) {
    const primaryAction = buildProteinAction({
      components: mealComponents,
      missingProteinG: proteinMissing,
      caloriesRemaining,
      measuredWeightG,
      currentTotalG,
      strict: false,
    })
    const proteinAlreadyStrong = mealTotals.protein_g >= 30

    return {
      status: "watch",
      severity: "warning",
      title: proteinAlreadyStrong ? "Objectif protéines encore incomplet" : "Protéines en retard",
      message:
        primaryAction?.copy ??
        (proteinAlreadyStrong
          ? "Le repas apporte déjà une base protéinée correcte, mais tu restes encore sous l'objectif du jour. Tu peux le valider puis compléter plus tard si besoin."
          : "Ce repas reste léger en protéines. Tu peux le valider tel quel, puis prévoir une source protéinée sur le prochain repas."),
      primaryAction,
      secondarySuggestion: primaryAction ? undefined : { type: "add", label: "Ajouter une source protéinée si c'est encore possible." },
      projected,
    }
  }

  if (carbsOverflow >= MACRO_WARN_G || fatOverflow >= MACRO_WARN_G) {
    const reason = carbsOverflow >= fatOverflow * 2 || before.overflow.fat_g > 0 ? "carbs" : "fat"
    const primaryAction = buildReductionAction({
      components: mealComponents,
      reason,
      excess: reason === "carbs" ? carbsOverflow : fatOverflow,
      strict: false,
    })

    return {
      status: "watch",
      severity: "warning",
      title: reason === "carbs" ? "Glucides un peu hauts" : "Lipides un peu hauts",
      message: primaryAction?.copy ?? "Le repas reste dans les calories, mais un macro commence à prendre trop de place.",
      primaryAction,
      projected,
    }
  }

  return {
    status: "good",
    severity: "info",
    title: "Repas bien aligné",
    message: "Ce repas s'intègre correctement dans ta journée. Tu peux valider sans ajustement prioritaire.",
    projected,
  }
}
