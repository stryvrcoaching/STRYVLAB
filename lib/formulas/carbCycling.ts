/**
 * Carb Cycling Calculator — Scientifically validated
 * Sources:
 *   BMR: Mifflin-St Jeor 1990 (Am J Clin Nutr)
 *   PAL: FAO/WHO/UNU 2004 + Ainsworth Compendium 2011
 *   PAL cap: Westerterp 2013 (Br J Nutr)
 *   Protein: Morton 2018 ISSN + Helms 2014
 *   Fats: Helms 2014, Volek 1997, Loucks 2007
 *   Carb distribution: Aragon 2017
 *   Navy BF fallback: Hodgdon & Beckett 1984
 */

export type CarbCycleProtocol = '2/1' | '3/1' | '4/1' | '5/2';
export type CarbCycleGoal = 'aggressive' | 'moderate' | 'recomp' | 'performance' | 'bulk';
export type CarbCycleSex = 'male' | 'female';
export type CarbCycleOccupation = 'sedentaire' | 'debout' | 'physique';
export type CarbCycleIntensity = 'legere' | 'moderee' | 'intense' | 'tres_intense';
export type CarbCyclePhase = 'hypertrophie' | 'force' | 'endurance' | 'cut';
export type CarbCycleInsulin = 'elevee' | 'normale' | 'reduite';

export interface CarbCyclingInput {
  gender: CarbCycleSex;
  age: number;
  weight: number;   // kg
  height: number;   // cm
  bodyFat?: number; // % direct — if absent, Navy method used
  waist?: number;   // cm — for Navy fallback
  neck?: number;    // cm — for Navy fallback
  hips?: number;    // cm — for Navy fallback (female)
  occupation: CarbCycleOccupation;
  sessionsPerWeek: number;
  sessionDuration: number; // minutes
  intensity: CarbCycleIntensity;
  goal: CarbCycleGoal;
  phase: CarbCyclePhase;
  protocol: CarbCycleProtocol;
  insulin: CarbCycleInsulin;
}

export interface CarbCyclingMacros {
  p: number;    // g protein
  f: number;    // g fat
  c: number;    // g carbs
  kcal: number; // total kcal
}

export interface CarbCyclingResult {
  bmr: number;
  pal: number;
  tdee: number;
  targetTdee: number;
  bf: number;
  lbm: number;
  low: CarbCyclingMacros;
  high: CarbCyclingMacros;
  days: { low: number; high: number };
  weeklyAvg: number;
  deficit: number;
  warnings: string[];
}

// --- Constants ---
const OCCUPATION_PAL: Record<CarbCycleOccupation, number> = { sedentaire: 1.40, debout: 1.55, physique: 1.70 };
const INTENSITY_MET: Record<CarbCycleIntensity, number>   = { legere: 3.5, moderee: 6.0, intense: 8.0, tres_intense: 10.0 };
const GOAL_ADJUSTMENTS: Record<CarbCycleGoal, number>     = { aggressive: 0.80, moderate: 0.85, recomp: 1.00, performance: 1.10, bulk: 1.15 };

function mifflinBMR(weight: number, height: number, age: number, gender: CarbCycleSex): number {
  return gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
}

function navyBF(weight: number, height: number, gender: CarbCycleSex, waist: number, neck: number, hips: number): number {
  if (gender === 'male' && waist && neck && height) {
    const density = 1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height);
    return (495 / density) - 450;
  }
  if (gender === 'female' && waist && neck && hips && height) {
    const density = 1.29579 - 0.35004 * Math.log10(waist + hips - neck) + 0.22100 * Math.log10(height);
    return (495 / density) - 450;
  }
  return gender === 'male' ? 15 : 25;
}

export function calculateCarbCycling(input: CarbCyclingInput): CarbCyclingResult {
  const { weight: w, height: h, age: a, gender, goal, protocol, phase, insulin, occupation, intensity } = input;

  // BMR
  const bmr = mifflinBMR(w, h, a, gender);

  // PAL
  const weeklyMEThours = input.sessionsPerWeek * (input.sessionDuration / 60) * INTENSITY_MET[intensity];
  const trainingPAL = (weeklyMEThours / 7) * 0.05;
  const pal = Math.min(OCCUPATION_PAL[occupation] + trainingPAL, 2.4);

  // TDEE & target
  const tdee = bmr * pal;
  const targetTdee = tdee * GOAL_ADJUSTMENTS[goal];

  // BF & LBM
  let bf = input.bodyFat && input.bodyFat > 0
    ? input.bodyFat
    : navyBF(w, h, gender, input.waist ?? 0, input.neck ?? 0, input.hips ?? 0);
  bf = Math.max(gender === 'male' ? 3 : 10, Math.min(bf, 50));
  const lbm = w * (1 - bf / 100);

  // Protocol days
  const protocolMap: Record<CarbCycleProtocol, [number, number]> = {
    '2/1': [2, 1], '3/1': [3, 1], '4/1': [4, 1], '5/2': [5, 2],
  };
  const [daysLow, daysHigh] = protocolMap[protocol];
  const totalCycle = daysLow + daysHigh;

  // Protein
  const proteinCategory = (goal === 'aggressive' || goal === 'moderate') ? 'deficit'
    : (goal === 'recomp' || goal === 'performance') ? 'maintenance' : 'surplus';
  const proteinRatios = {
    deficit: { low: 3.0, high: 2.6 },
    maintenance: { low: 2.6, high: 2.4 },
    surplus: { low: 2.4, high: 2.6 },
  };
  const pLow  = Math.round(lbm * proteinRatios[proteinCategory].low);
  const pHigh = Math.round(lbm * proteinRatios[proteinCategory].high);

  // Minimum fat
  const minFatRatioLBM = gender === 'male' ? 1.0 : 1.2;
  const absoluteMinFat = gender === 'male' ? 50 : 60;
  const minFat = Math.max(lbm * minFatRatioLBM, absoluteMinFat);

  // Caloric distribution
  let cycleFactor: { high: number; low: number };
  if (protocol === '2/1' && (goal === 'bulk' || goal === 'performance')) {
    cycleFactor = { high: 1.15, low: 1.05 };
  } else {
    const cycleFactorMap: Partial<Record<CarbCycleGoal, { high: number; low: number }>> = {
      bulk: { high: 1.25, low: 0.95 }, performance: { high: 1.20, low: 0.90 },
      recomp: { high: 1.15, low: 0.85 }, moderate: { high: 1.10, low: 0.75 },
    };
    cycleFactor = cycleFactorMap[goal] ?? { high: 1.05, low: 0.70 };
  }

  let kcalHigh = targetTdee * cycleFactor.high;
  let kcalLow = (targetTdee * totalCycle - kcalHigh * daysHigh) / daysLow;

  const minKcalLow = (goal === 'bulk' || goal === 'performance') ? 1800 : 1200;
  if (kcalLow < minKcalLow) {
    kcalLow = minKcalLow;
    kcalHigh = (targetTdee * totalCycle - kcalLow * daysLow) / daysHigh;
  }

  // Fats
  let fLow  = Math.round(Math.max(w * 1.2, minFat));
  let fHigh = Math.round(Math.max(w * 0.6, minFat * 0.8));

  // Carbs with multipliers
  const insulinMultiplier: Record<CarbCycleInsulin, number> = { elevee: 1.2, normale: 1.0, reduite: 0.75 };
  const phaseMultiplier: Record<CarbCyclePhase, number>    = { hypertrophie: 1.1, force: 1.0, endurance: 1.2, cut: 0.7 };
  const carbMultiplier = insulinMultiplier[insulin] * phaseMultiplier[phase];

  let remainingLow = kcalLow - pLow * 4 - fLow * 9;
  let cLow = Math.max(Math.round((remainingLow / 4) * carbMultiplier * 0.8), 50);
  if (remainingLow < 0) {
    fLow = Math.round((kcalLow - pLow * 4 - 200) / 9);
    cLow = 50;
  }

  let remainingHigh = kcalHigh - pHigh * 4 - fHigh * 9;
  let cHigh = Math.min(
    Math.max(Math.round((remainingHigh / 4) * carbMultiplier * 1.2), 100),
    w * 10,
  );
  if (remainingHigh < 0) {
    fHigh = Math.round((kcalHigh - pHigh * 4 - 400) / 9);
    cHigh = 100;
  }

  const finalKcalLow  = pLow  * 4 + fLow  * 9 + cLow  * 4;
  const finalKcalHigh = pHigh * 4 + fHigh * 9 + cHigh * 4;
  const weeklyAvg = (finalKcalLow * daysLow + finalKcalHigh * daysHigh) / totalCycle;
  const deficit   = weeklyAvg - tdee;

  // Warnings
  const warnings: string[] = [];
  if (cHigh / w > 8) warnings.push(`⚠️ Glucides hauts (${cHigh}g = ${Math.round(cHigh / w * 10) / 10}g/kg) : Risque inconfort digestif. Répartir sur 4-5 repas.`);
  if (kcalLow < 1200) warnings.push('⚠️ Calories jours bas <1200kcal : En dessous du seuil métabolique minimum. Risque de catabolisme musculaire.');
  if (kcalLow < 1500 && gender === 'female') warnings.push('⚠️ Calories jours bas <1500kcal (femme) : Risque de dysfonction hormonale (aménorrhée). Augmenter les lipides.');
  if (fLow < absoluteMinFat || fHigh < absoluteMinFat) warnings.push(`⚠️ Lipides sous plancher hormonal (${absoluteMinFat}g/j). Risque de dysfonction testostérone/œstrogène.`);
  if (deficit < -1000) warnings.push(`⚠️ Déficit moyen élevé (${Math.round(deficit)} kcal/semaine). Surveiller la récupération et la force.`);

  return {
    bmr: Math.round(bmr), pal: Math.round(pal * 100) / 100, tdee: Math.round(tdee), targetTdee: Math.round(targetTdee),
    bf: Math.round(bf * 10) / 10, lbm: Math.round(lbm * 10) / 10,
    low:  { p: pLow,  f: fLow,  c: cLow,  kcal: Math.round(finalKcalLow) },
    high: { p: pHigh, f: fHigh, c: cHigh, kcal: Math.round(finalKcalHigh) },
    days: { low: daysLow, high: daysHigh },
    weeklyAvg: Math.round(weeklyAvg),
    deficit: Math.round(deficit),
    warnings,
  };
}
