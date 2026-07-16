import type { MealType } from "@/lib/nutrition/food-items"
import type { NutritionParseItemSnapshot, NutritionParseSnapshot } from "@/lib/nutrition/parse-feedback"
import { normalizeVoiceCatalogText } from "@/lib/nutrition/voice-catalog"

export interface NutritionParseEvalMetrics {
  matched_items: number
  expected_items: number
  predicted_items: number
  precision: number
  recall: number
  id_match_rate: number
  quantity_accuracy: number
  meal_type_match: boolean
  score: number
}

type IndexedItem = NutritionParseItemSnapshot & {
  normalizedName: string
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizedMealType(value: MealType | string | null | undefined): string | null {
  const raw = String(value ?? "").trim()
  return raw || null
}

function toIndexedItems(snapshot: NutritionParseSnapshot): IndexedItem[] {
  return (snapshot.items ?? []).map((item) => ({
    ...item,
    quantity_g: Number(item.quantity_g) || 0,
    normalizedName: normalizeVoiceCatalogText(item.name ?? ""),
  }))
}

function itemMatchScore(expected: IndexedItem, predicted: IndexedItem): number {
  if (expected.food_item_id && predicted.food_item_id && expected.food_item_id === predicted.food_item_id) {
    return 1000
  }

  if (expected.normalizedName && predicted.normalizedName && expected.normalizedName === predicted.normalizedName) {
    return 800
  }

  let tokenScore = 0
  const expectedTokens = expected.normalizedName.split(/\s+/).filter(Boolean)
  const predictedTokens = predicted.normalizedName.split(/\s+/).filter(Boolean)

  for (const token of expectedTokens) {
    if (predictedTokens.includes(token)) tokenScore += 20
    else if (predictedTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) tokenScore += 8
  }

  const quantityGap = Math.abs((expected.quantity_g || 0) - (predicted.quantity_g || 0))
  const quantityPenalty = Math.min(quantityGap / 5, 30)
  return tokenScore - quantityPenalty
}

export function evaluateNutritionParse(
  expected: NutritionParseSnapshot,
  predicted: NutritionParseSnapshot,
): NutritionParseEvalMetrics {
  const expectedItems = toIndexedItems(expected)
  const predictedItems = toIndexedItems(predicted)
  const usedPredicted = new Set<number>()

  let matchedItems = 0
  let idMatches = 0
  let quantityAccuracySum = 0

  for (const expectedItem of expectedItems) {
    let bestIndex = -1
    let bestScore = 0

    for (let index = 0; index < predictedItems.length; index += 1) {
      if (usedPredicted.has(index)) continue
      const candidateScore = itemMatchScore(expectedItem, predictedItems[index])
      if (candidateScore > bestScore) {
        bestScore = candidateScore
        bestIndex = index
      }
    }

    if (bestIndex === -1 || bestScore < 20) continue

    usedPredicted.add(bestIndex)
    matchedItems += 1

    const predictedItem = predictedItems[bestIndex]
    if (
      expectedItem.food_item_id &&
      predictedItem.food_item_id &&
      expectedItem.food_item_id === predictedItem.food_item_id
    ) {
      idMatches += 1
    }

    const denominator = Math.max(expectedItem.quantity_g || 0, predictedItem.quantity_g || 0, 1)
    const quantityGap = Math.abs((expectedItem.quantity_g || 0) - (predictedItem.quantity_g || 0))
    quantityAccuracySum += clamp01(1 - quantityGap / denominator)
  }

  const precision = predictedItems.length ? matchedItems / predictedItems.length : expectedItems.length === 0 ? 1 : 0
  const recall = expectedItems.length ? matchedItems / expectedItems.length : 1
  const idMatchRate = matchedItems ? idMatches / matchedItems : 0
  const quantityAccuracy = matchedItems ? quantityAccuracySum / matchedItems : 0
  const mealTypeMatch = normalizedMealType(expected.meal_type) === normalizedMealType(predicted.meal_type)

  const score =
    clamp01(precision) * 0.3 +
    clamp01(recall) * 0.35 +
    clamp01(idMatchRate) * 0.2 +
    clamp01(quantityAccuracy) * 0.1 +
    (mealTypeMatch ? 0.05 : 0)

  return {
    matched_items: matchedItems,
    expected_items: expectedItems.length,
    predicted_items: predictedItems.length,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    id_match_rate: Number(idMatchRate.toFixed(4)),
    quantity_accuracy: Number(quantityAccuracy.toFixed(4)),
    meal_type_match: mealTypeMatch,
    score: Math.round(score * 1000) / 10,
  }
}
