import type { NutritionMeal } from "@/lib/nutrition/food-items"
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"

export const NUTRITION_LIVE_EVENT = "stryv:nutrition-live-refresh"
const NUTRITION_LIVE_STORAGE_KEY = "stryv:nutrition-live-refresh:v1"
const NUTRITION_INVALIDATION_STORAGE_KEY = "stryv:nutrition-invalidation:v1"

export type NutritionLiveDelta = Partial<Pick<NutritionMacros, "kcal" | "protein_g" | "carbs_g" | "fat_g">>

export interface NutritionLiveRefreshPayload {
  date: string
  consumedDelta?: NutritionLiveDelta
  prep?: SmartNutritionPrep | null
  removePrepIds?: string[]
  meal?: NutritionMeal | null
}

function isBrowser() {
  return typeof window !== "undefined"
}

function readQueue(): NutritionLiveRefreshPayload[] {
  if (!isBrowser()) return []
  try {
    const raw = window.sessionStorage.getItem(NUTRITION_LIVE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue: NutritionLiveRefreshPayload[]) {
  if (!isBrowser()) return
  try {
    window.sessionStorage.setItem(NUTRITION_LIVE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // ignore storage failures
  }
}

export function queueNutritionLiveRefresh(payload: NutritionLiveRefreshPayload) {
  if (!isBrowser()) return
  try {
    window.sessionStorage.setItem(NUTRITION_INVALIDATION_STORAGE_KEY, String(Date.now()))
  } catch {
    // ignore storage failures
  }
  const queue = readQueue()
  queue.push(payload)
  writeQueue(queue)
  window.dispatchEvent(new CustomEvent<NutritionLiveRefreshPayload>(NUTRITION_LIVE_EVENT, { detail: payload }))
}

export function hasNutritionInvalidation() {
  if (!isBrowser()) return false
  try {
    return window.sessionStorage.getItem(NUTRITION_INVALIDATION_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function clearNutritionInvalidation() {
  if (!isBrowser()) return
  try {
    window.sessionStorage.removeItem(NUTRITION_INVALIDATION_STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}

export function consumeNutritionLiveRefreshQueue(date: string) {
  const queue = readQueue()
  const matched = queue.filter((item) => item?.date === date)
  if (matched.length === 0) return []
  writeQueue(queue.filter((item) => item?.date !== date))
  return matched
}

export function applyNutritionLiveDelta(
  consumed: NutritionMacros,
  delta?: NutritionLiveDelta,
): NutritionMacros {
  if (!delta) return consumed
  return {
    ...consumed,
    kcal: consumed.kcal + (delta.kcal ?? 0),
    protein_g: consumed.protein_g + (delta.protein_g ?? 0),
    carbs_g: consumed.carbs_g + (delta.carbs_g ?? 0),
    fat_g: consumed.fat_g + (delta.fat_g ?? 0),
  }
}
