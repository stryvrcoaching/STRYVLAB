import type { PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"
import type { BenchmarkCase, BenchmarkTruth, BenchmarkTruthComponent } from "./schema"

interface NutrientTotals {
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export interface BenchmarkCaseMetrics {
  score: number
  ready_to_log: boolean
  mode_match: boolean
  matched_items: number
  expected_items: number
  predicted_items: number
  item_precision: number
  item_recall: number
  item_f1: number
  quantity_accuracy: number | null
  kcal_accuracy: number | null
  protein_accuracy: number | null
  carbs_accuracy: number | null
  fat_accuracy: number | null
  fiber_accuracy: number | null
  duplicate_count: number
}

interface IndexedTruthComponent extends BenchmarkTruthComponent {
  normalizedNames: string[]
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function normalizeBenchmarkFoodName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(cuit|cuite|cuits|cuites|portion|produit|aliment|assiette)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function nameSimilarity(left: string, right: string) {
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.88

  const leftTokens = new Set(left.split(/\s+/).filter(Boolean))
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean))
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union ? intersection / union : 0
}

function truthNameSimilarity(expected: IndexedTruthComponent, predictedName: string) {
  const normalizedPrediction = normalizeBenchmarkFoodName(predictedName)
  return Math.max(...expected.normalizedNames.map((name) => nameSimilarity(name, normalizedPrediction)))
}

function resolveTruthTotals(truth: BenchmarkTruth): NutrientTotals {
  if (truth.totals) return truth.totals

  const keys: Array<keyof NutrientTotals> = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"]
  return keys.reduce<NutrientTotals>((totals, key) => {
    const values = truth.components.map((component) => component.nutrients[key])
    totals[key] = values.every((value) => value !== null)
      ? values.reduce<number>((sum, value) => sum + Number(value), 0)
      : null
    return totals
  }, { kcal: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null })
}

function resolvePredictedTotals(result: PhotoMealFinalResult): NutrientTotals {
  return result.components.reduce<NutrientTotals>((totals, component) => {
    const ratio = component.quantity_g / 100
    totals.kcal = Number(totals.kcal) + component.kcal_per_100g * ratio
    totals.protein_g = Number(totals.protein_g) + component.protein_per_100g * ratio
    totals.carbs_g = Number(totals.carbs_g) + component.carbs_per_100g * ratio
    totals.fat_g = Number(totals.fat_g) + component.fat_per_100g * ratio
    totals.fiber_g = Number(totals.fiber_g) + component.fiber_per_100g * ratio
    return totals
  }, { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })
}

function nutrientAccuracy(expected: number | null, predicted: number | null, floor: number) {
  if (expected === null || predicted === null) return null
  const denominator = Math.max(Math.abs(expected), Math.abs(predicted), floor)
  return clamp01(1 - Math.abs(expected - predicted) / denominator)
}

function countDuplicates(names: string[]) {
  const normalized = names.map(normalizeBenchmarkFoodName).filter(Boolean)
  const duplicates = new Set<number>()

  normalized.forEach((name, index) => {
    normalized.forEach((candidate, candidateIndex) => {
      if (candidateIndex <= index) return
      if (nameSimilarity(name, candidate) >= 0.88) duplicates.add(candidateIndex)
    })
  })

  return duplicates.size
}

function weightedAverage(entries: Array<{ value: number | null; weight: number }>) {
  const known = entries.filter((entry): entry is { value: number; weight: number } => entry.value !== null)
  const totalWeight = known.reduce((sum, entry) => sum + entry.weight, 0)
  if (!totalWeight) return 0
  return known.reduce((sum, entry) => sum + clamp01(entry.value) * entry.weight, 0) / totalWeight
}

export function scoreBenchmarkCase(benchmarkCase: BenchmarkCase, result: PhotoMealFinalResult): BenchmarkCaseMetrics {
  if (!benchmarkCase.truth) throw new Error(`missing_truth:${benchmarkCase.id}`)

  const expected = benchmarkCase.truth.components.map<IndexedTruthComponent>((component) => ({
    ...component,
    normalizedNames: [component.name_fr, ...component.aliases].map(normalizeBenchmarkFoodName).filter(Boolean),
  }))
  const usedPredicted = new Set<number>()
  const quantityAccuracies: number[] = []
  let matchedItems = 0

  expected.forEach((component) => {
    let bestIndex = -1
    let bestScore = 0
    result.components.forEach((predicted, index) => {
      if (usedPredicted.has(index)) return
      const similarity = truthNameSimilarity(component, predicted.name_fr)
      if (similarity > bestScore) {
        bestScore = similarity
        bestIndex = index
      }
    })

    if (bestIndex < 0 || bestScore < 0.45) return
    usedPredicted.add(bestIndex)
    matchedItems += 1

    if (component.quantity_g !== null) {
      const predictedQuantity = result.components[bestIndex].quantity_g
      const denominator = Math.max(component.quantity_g, predictedQuantity, 1)
      quantityAccuracies.push(clamp01(1 - Math.abs(component.quantity_g - predictedQuantity) / denominator))
    }
  })

  const precision = result.components.length ? matchedItems / result.components.length : 0
  const recall = expected.length ? matchedItems / expected.length : 1
  const itemF1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  const quantityAccuracy = quantityAccuracies.length
    ? quantityAccuracies.reduce((sum, value) => sum + value, 0) / quantityAccuracies.length
    : null
  const truthTotals = resolveTruthTotals(benchmarkCase.truth)
  const predictedTotals = resolvePredictedTotals(result)
  const kcalAccuracy = nutrientAccuracy(truthTotals.kcal, predictedTotals.kcal, 50)
  const proteinAccuracy = nutrientAccuracy(truthTotals.protein_g, predictedTotals.protein_g, 5)
  const carbsAccuracy = nutrientAccuracy(truthTotals.carbs_g, predictedTotals.carbs_g, 10)
  const fatAccuracy = nutrientAccuracy(truthTotals.fat_g, predictedTotals.fat_g, 5)
  const fiberAccuracy = nutrientAccuracy(truthTotals.fiber_g, predictedTotals.fiber_g, 3)
  const duplicateCount = countDuplicates(result.components.map((component) => component.name_fr))
  const modeMatch = result.analysis_mode === benchmarkCase.truth.analysis_mode
  const baseScore = weightedAverage([
    { value: result.ready_to_log ? 1 : 0, weight: 10 },
    { value: modeMatch ? 1 : 0, weight: 10 },
    { value: itemF1, weight: 25 },
    { value: quantityAccuracy, weight: 20 },
    { value: kcalAccuracy, weight: 15 },
    { value: proteinAccuracy, weight: 8 },
    { value: carbsAccuracy, weight: 5 },
    { value: fatAccuracy, weight: 5 },
    { value: fiberAccuracy, weight: 2 },
  ])
  const score = Math.max(0, baseScore * 100 - Math.min(15, duplicateCount * 5))

  return {
    score: round(score, 1),
    ready_to_log: result.ready_to_log,
    mode_match: modeMatch,
    matched_items: matchedItems,
    expected_items: expected.length,
    predicted_items: result.components.length,
    item_precision: round(precision),
    item_recall: round(recall),
    item_f1: round(itemF1),
    quantity_accuracy: quantityAccuracy === null ? null : round(quantityAccuracy),
    kcal_accuracy: kcalAccuracy === null ? null : round(kcalAccuracy),
    protein_accuracy: proteinAccuracy === null ? null : round(proteinAccuracy),
    carbs_accuracy: carbsAccuracy === null ? null : round(carbsAccuracy),
    fat_accuracy: fatAccuracy === null ? null : round(fatAccuracy),
    fiber_accuracy: fiberAccuracy === null ? null : round(fiberAccuracy),
    duplicate_count: duplicateCount,
  }
}
