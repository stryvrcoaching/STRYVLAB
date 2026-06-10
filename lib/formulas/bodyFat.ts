/**
 * Body Fat Formulas — Scientifically validated
 * Sources:
 *   US Navy: Hodgdon & Beckett 1984 (Naval Health Research Center Report No. 84-29)
 *   Jackson-Pollock: 1985 (Practical Assessment of Body Composition)
 *   Siri Conversion: Siri 1961
 *   ACE Categories: American Council on Exercise
 */

import { navyBodyFatPct } from '@/lib/health/healthMath';

export type BodyFatGender = 'male' | 'female';
export type BodyFatMethod = 'navy' | 'skinfold';

export interface NavyInput {
  gender: BodyFatGender;
  weight: number;  // kg
  height: number;  // cm
  neck: number;    // cm
  waist: number;   // cm
  hips?: number;   // cm — required for female
}

export interface SkinfoldInput {
  gender: BodyFatGender;
  age: number;
  // male: chest + abdominal + thigh
  chest?: number;    // mm
  abdominal?: number; // mm
  thigh?: number;    // mm
  // female: triceps + suprailiac + thigh
  triceps?: number;   // mm
  suprailiac?: number; // mm
}

export interface BodyFatResult {
  bodyFat: number;   // %
  fatMass: number;   // kg
  leanMass: number;  // kg
  bmi: number;
  category: BodyFatCategory;
  marginOfError: '±3-5%' | '±3-4%';
  methodUsed: string;
  warnings: string[];
}

export interface BodyFatCategory {
  label: string;
  desc: string;
  colorClass: string; // Tailwind bg+text+border
}

/** US Navy Method (Hodgdon & Beckett 1984) — precision ±3-5% */
export function navyBodyFat(input: NavyInput): number {
  return navyBodyFatPct(input.gender, input.waist, input.neck, input.height, input.hips);
}

/** Jackson-Pollock 3-Site (1985) — precision ±3-4% */
export function skinfoldBodyFat(input: SkinfoldInput): number {
  const { gender, age: a } = input;
  let sum3: number;
  if (gender === 'male') {
    sum3 = (input.chest ?? 0) + (input.abdominal ?? 0) + (input.thigh ?? 0);
    const bodyDensity = 1.10938 - (0.0008267 * sum3) + (0.0000016 * (sum3 ** 2)) - (0.0002574 * a);
    return ((4.95 / bodyDensity) - 4.50) * 100;
  } else {
    sum3 = (input.triceps ?? 0) + (input.suprailiac ?? 0) + (input.thigh ?? 0);
    const bodyDensity = 1.0994921 - (0.0009929 * sum3) + (0.0000023 * (sum3 ** 2)) - (0.0001392 * a);
    return ((4.95 / bodyDensity) - 4.50) * 100;
  }
}

/** ACE Body Fat Categories */
export function getBodyFatCategory(bf: number, gender: BodyFatGender): BodyFatCategory {
  if (gender === 'male') {
    if (bf < 2)  return { label: 'DANGEREUX',  desc: 'Risque hormonal sévère',         colorClass: 'bg-red-50 text-red-900 border-red-100' };
    if (bf < 6)  return { label: 'ESSENTIEL',  desc: 'Minimum physiologique',          colorClass: 'bg-orange-50 text-orange-900 border-orange-100' };
    if (bf < 14) return { label: 'ATHLÈTE',    desc: 'Performance élite',              colorClass: 'bg-yellow-50 text-yellow-900 border-yellow-100' };
    if (bf < 18) return { label: 'FITNESS',    desc: 'Forme optimale',                 colorClass: 'bg-emerald-50 text-emerald-900 border-emerald-100' };
    if (bf < 25) return { label: 'ACCEPTABLE', desc: 'Santé générale',                 colorClass: 'bg-blue-50 text-blue-900 border-blue-100' };
    return              { label: 'OBÉSITÉ',    desc: 'Risques cardiovasculaires',      colorClass: 'bg-slate-50 text-slate-900 border-slate-100' };
  } else {
    if (bf < 10) return { label: 'DANGEREUX',  desc: 'Risque aménorrhée',              colorClass: 'bg-red-50 text-red-900 border-red-100' };
    if (bf < 14) return { label: 'ESSENTIEL',  desc: 'Minimum physiologique',          colorClass: 'bg-orange-50 text-orange-900 border-orange-100' };
    if (bf < 21) return { label: 'ATHLÈTE',    desc: 'Performance élite',              colorClass: 'bg-yellow-50 text-yellow-900 border-yellow-100' };
    if (bf < 25) return { label: 'FITNESS',    desc: 'Forme optimale',                 colorClass: 'bg-emerald-50 text-emerald-900 border-emerald-100' };
    if (bf < 32) return { label: 'ACCEPTABLE', desc: 'Santé générale',                 colorClass: 'bg-blue-50 text-blue-900 border-blue-100' };
    return              { label: 'OBÉSITÉ',    desc: 'Risques cardiovasculaires',      colorClass: 'bg-slate-50 text-slate-900 border-slate-100' };
  }
}

export function getOptimalBFZone(gender: BodyFatGender): { range: string; desc: string; rationale: string } {
  return gender === 'male'
    ? { range: '14-17%', desc: 'Fitness Optimal', rationale: 'Équilibre performance/santé' }
    : { range: '21-24%', desc: 'Fitness Optimal', rationale: 'Santé hormonale + performance' };
}

const MIN_BF: Record<BodyFatGender, number> = { male: 3, female: 10 };
const MAX_BF = 60;

export function buildBodyFatWarnings(bf: number, bmi: number, gender: BodyFatGender, method: BodyFatMethod, waist?: number, height?: number): string[] {
  const warnings: string[] = [];
  if (bmi < 18.5) warnings.push('⚠️ IMC <18.5 : Précision réduite pour profils sous-poids.');
  if (bmi > 35)   warnings.push('⚠️ IMC >35 : Tendance à sous-estimer la masse grasse (adiposité viscérale).');
  if (method === 'navy' && waist && height) {
    const whr = waist / height;
    if (whr > 0.6) warnings.push('ℹ️ Ratio Taille/Hauteur >0.6 : Indique une adiposité abdominale élevée (risque métabolique).');
  }
  if (bf < 6 && gender === 'male')    warnings.push('⚠️ BF% <6% (homme) : Risque de dysfonction hormonale (testostérone).');
  if (bf < 14 && gender === 'female') warnings.push("⚠️ BF% <14% (femme) : Risque d'aménorrhée et perte de densité osseuse.");
  return warnings;
}

export function clampBodyFat(bf: number, gender: BodyFatGender): number {
  return Math.max(MIN_BF[gender], Math.min(bf, MAX_BF));
}
