// lib/nutrition/engine/tdeeComponents.ts
// Conservative TDEE breakdown per STRYVR brief — avoids PAL multiplier overestimation
// TDEE = BMR + NEAT (steps + occupation) + EAT (training, conservative) + TEF (9% BMR)
import type { EngineGender, TdeeComponents } from './types'

// Mifflin-St Jeor — default when no measured BMR
export function computeBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: EngineGender,
  measuredBmr?: number,
): number {
  if (measuredBmr) return measuredBmr
  const s = gender === 'male' ? 5 : -161
  return Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + s)
}

// NEAT: steps × 0.04 kcal/step × weight_factor + occupation bonus
// Hall et al. 2012 NIDDK simplified
export function computeNEAT(
  weight_kg: number,
  stepsPerDay: number,
  occupationMultiplier: number,
): number {
  const stepKcal = stepsPerDay * 0.04 * (weight_kg / 70)
  const occupationBonus = (occupationMultiplier - 1.0) * 200
  return Math.round(stepKcal + occupationBonus)
}

// EAT: conservative estimate for resistance training
// ~4 kcal/min for moderate intensity musculation (Ainsworth 2011)
// Per-session cap of 450 kcal to prevent overestimation
const KCAL_PER_MIN_RESISTANCE = 4.0
const MAX_KCAL_PER_SESSION = 450
const MAX_EAT_KCAL_PER_DAY = 500

export function computeEAT(
  sessionsPerWeek: number,
  sessionDurationMin: number,
): number {
  if (sessionsPerWeek === 0) return 0
  const kcalPerSession = Math.min(
    sessionDurationMin * KCAL_PER_MIN_RESISTANCE,
    MAX_KCAL_PER_SESSION,
  )
  const weeklyEat = kcalPerSession * sessionsPerWeek
  return Math.min(MAX_EAT_KCAL_PER_DAY, Math.round(weeklyEat / 7))
}

// TEF: 9% of BMR — Westerterp 2004
export function computeTEF(bmr: number): number {
  return Math.round(bmr * 0.09)
}

export interface TdeeInput {
  stepsPerDay: number
  sessionsPerWeek: number
  sessionDurationMin: number
  occupationMultiplier: number
  measuredBmr?: number
}

export function computeTDEE(
  weight_kg: number,
  height_cm: number,
  age: number,
  gender: EngineGender,
  input: TdeeInput,
): TdeeComponents {
  const bmr = computeBMR(weight_kg, height_cm, age, gender, input.measuredBmr)
  const neat = computeNEAT(weight_kg, input.stepsPerDay, input.occupationMultiplier)
  const eat = computeEAT(input.sessionsPerWeek, input.sessionDurationMin)
  const tef = computeTEF(bmr)
  return { bmr, neat, eat, tef, total: bmr + neat + eat + tef }
}
