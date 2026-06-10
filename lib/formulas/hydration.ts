/**
 * Hydration Calculator — Scientifically calibrated
 * Sources:
 *   Base: EFSA 2010 (European Food Safety Authority) — 35ml/kg
 *   Gender offset: EFSA 2010 (AI: men 2.5L/day, women 2.0L/day sedentary)
 *   Activity bonus: ACSM 2007 (Sawka et al.) — recalibrated for recreational athletes
 *   Climate bonus: Sawka et al. 2015
 *
 * Calibration rationale:
 *   Original activity bonuses (900–1200ml) were designed for professional athletes
 *   training 2× daily. Recreational athletes (3–6 sessions/week) need 300–500ml extra.
 *   This version targets realistic ranges: 2.0–2.5L sedentary, 2.5–3.5L active,
 *   3.5–4.0L elite/hot climate — matching observed intake in fit, non-competing adults.
 */

export type HydrationGender = 'male' | 'female';
export type HydrationActivity = 'sedentary' | 'light' | 'moderate' | 'intense' | 'athlete';
export type HydrationClimate = 'cold' | 'temperate' | 'hot' | 'veryHot';

export interface HydrationInput {
  weight: number; // kg
  gender: HydrationGender;
  activity: HydrationActivity;
  climate: HydrationClimate;
}

export interface HydrationResult {
  liters: number;
  glasses: number; // 250ml glasses
  breakdown: {
    base: number;    // ml
    gender: number;  // ml offset
    activity: number; // ml
    climate: number;  // ml
  };
  warnings: string[];
}

// EFSA 2010 — 35ml/kg base
const BASE_ML_PER_KG = 35;

// Gender offset ml — EFSA 2010 (AI: men 2500ml vs women 2000ml sedentary)
// Applied as flat offset rather than multiplier to avoid compounding with weight
const GENDER_OFFSET_ML: Record<HydrationGender, number> = {
  male: 200,    // +200ml: higher lean mass ratio, larger blood volume
  female: -100, // -100ml: slightly lower total water requirements per EFSA AI
};

// Activity bonus ml — recalibrated from ACSM 2007 for recreational athletes
// Original paper values (900–1500ml) target competitive/elite athletes training 2×/day
// These values apply to typical coach clients: recreational to advanced, 2–6 sessions/week
const ACTIVITY_BONUS_ML: Record<HydrationActivity, number> = {
  sedentary: 0,    // desk job, <5k steps — no bonus
  light: 150,      // 1–2 sessions/week, light walks — minimal sweat loss
  moderate: 300,   // 3 sessions/week, ~60min — covers sweat + thermoregulation
  intense: 450,    // 4–5 sessions/week, 60–90min — covers daily training deficit
  athlete: 700,    // 6+ sessions/week or 2×/day — approaching ACSM elite range
};

// Climate bonus ml — Sawka et al. 2015, adjusted for realistic exposure
// Cold bonus retained: vasoconstriction reduces thirst sensation, underdrinking common
const CLIMATE_BONUS_ML: Record<HydrationClimate, number> = {
  cold:      200,  // reduced thirst perception requires conscious intake
  temperate: 0,    // baseline — no adjustment
  hot:       400,  // >25°C ambient, typical warm season
  veryHot:   800,  // >32°C or high humidity, summer competition prep
};

// Hard cap: water loading protocols (RP Strength) max ~6L for elite athletes
const MAX_LITERS = 6.0;

export function calculateHydration(input: HydrationInput): HydrationResult {
  const { weight, gender, activity, climate } = input;

  const baseML = weight * BASE_ML_PER_KG;
  const genderOffset = GENDER_OFFSET_ML[gender];
  const activityBonus = ACTIVITY_BONUS_ML[activity];
  const climateBonus = CLIMATE_BONUS_ML[climate];

  const totalMLRaw = baseML + genderOffset + activityBonus + climateBonus;
  const totalML = Math.round(totalMLRaw);
  const litersRaw = totalML / 1000;
  const liters = Math.round(Math.min(litersRaw, MAX_LITERS) * 10) / 10;
  const glasses = Math.round((liters * 1000) / 250);

  const warnings: string[] = [];
  if (litersRaw > MAX_LITERS) warnings.push(`⚠️ Volume calculé ${(litersRaw).toFixed(1)}L plafonné à ${MAX_LITERS}L — limite sécuritaire pour le water loading (RP Strength protocol).`);
  if (liters > 4.5) warnings.push('⚠️ Volume élevé (>4.5L) : Répartir sur 14–16h (max 350ml/h). Ajouter électrolytes sodium 500–700mg/L (IOC 2012).');
  if (liters < 1.5) warnings.push('⚠️ Volume <1.5L : Sous le seuil minimal EFSA 2010. Déshydratation chronique probable.');
  if (climate === 'veryHot') warnings.push('ℹ️ Chaleur extrême : Électrolytes indispensables. Sodium 500–700mg/L, potassium 200mg/L (IOC Consensus 2012).');
  if (climate === 'cold') warnings.push('ℹ️ Climat froid : Sensation de soif réduite (vasoconstriction). Programmer rappels toutes les 90–120min.');
  if (liters >= 2.0 && liters <= 3.5) warnings.push('✓ Volume optimal (2–3.5L) — Euhydratation conforme EFSA 2010.');

  return {
    liters,
    glasses,
    breakdown: {
      base: Math.round(baseML),
      gender: genderOffset,
      activity: activityBonus,
      climate: climateBonus,
    },
    warnings,
  };
}
