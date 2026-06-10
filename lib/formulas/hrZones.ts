/**
 * Heart Rate Zones — Scientifically validated
 * Sources:
 *   FC Max Homme: Tanaka et al. 2001 (JACC, n=18,712)
 *   FC Max Femme: Gulati et al. 2010 (Circulation, n=5,437)
 *   Zones: ACSM 2011 (6-zone model)
 *   Karvonen method: Karvonen 1957 (Annals of Medicine)
 */

export type HRGender = 'male' | 'female';

export interface HRZonesInput {
  age: number;
  gender: HRGender;
  restingHR?: number; // bpm — optional, defaults to population average
}

export interface HRZone {
  zone: number;
  name: string;
  range: string;    // e.g. "50-59%"
  bpm: string;      // e.g. "112-130"
  minBPM: number;
  maxBPM: number;
  desc: string;
  usage: string;
  color: string;    // Tailwind gradient class
  border: string;   // Tailwind border class
}

export interface HRZonesResult {
  maxHR: number;
  restingHR: number;
  hrReserve: number;
  zones: HRZone[];
  formulaUsed: string;
  warnings: string[];
}

const DEFAULT_RESTING_HR: Record<HRGender, number> = { male: 65, female: 70 };

/** FC Max — Tanaka 2001 (male) / Gulati 2010 (female) */
export function calculateMaxHR(age: number, gender: HRGender): number {
  return gender === 'male'
    ? Math.round(208 - 0.7 * age)   // Tanaka 2001
    : Math.round(206 - 0.88 * age); // Gulati 2010
}

const ZONES_CONFIG = [
  { z: 1, name: 'Récupération Active', min: 0.40, max: 0.49, color: 'from-slate-50 to-slate-100/50',   border: 'border-slate-200/50',   desc: 'Flux sanguin sans stress métabolique',                       usage: '20-30min post-training' },
  { z: 2, name: 'Endurance de Base',   min: 0.50, max: 0.59, color: 'from-green-50 to-green-100/50',   border: 'border-green-200/50',   desc: 'Oxydation lipides max, développement mitochondrial (Seiler, 2010)', usage: '60-90min, 3-5×/sem' },
  { z: 3, name: 'Aérobie',            min: 0.60, max: 0.69, color: 'from-blue-50 to-blue-100/50',     border: 'border-blue-200/50',    desc: 'Amélioration VO2 sous-maximal',                              usage: '45-60min, 2-3×/sem' },
  { z: 4, name: 'Seuil Lactique',      min: 0.70, max: 0.79, color: 'from-yellow-50 to-yellow-100/50', border: 'border-yellow-200/50',  desc: 'Équilibre production/clearance lactate (Billat, 2001)',       usage: '20-40min, 1-2×/sem' },
  { z: 5, name: 'VO2 Max',            min: 0.80, max: 0.89, color: 'from-orange-50 to-orange-100/50', border: 'border-orange-200/50',  desc: 'Puissance aérobie maximale, HIIT (Tabata, 1996)',             usage: '3-8min × 3-5 reps, 1×/sem max' },
  { z: 6, name: 'Anaérobie',          min: 0.90, max: 1.00, color: 'from-red-50 to-red-100/50',       border: 'border-red-200/50',     desc: 'ATP non-oxydatif, fibres IIx rapides',                       usage: '10-30s × 6-10 reps, confirmés uniquement' },
] as const;

export function calculateHRZones(input: HRZonesInput): HRZonesResult {
  const { age, gender } = input;
  const warnings: string[] = [];

  let rhr = input.restingHR ?? 0;
  if (!rhr) {
    rhr = DEFAULT_RESTING_HR[gender];
    warnings.push(`ℹ️ FC repos non renseignée : valeur moyenne utilisée (${rhr} bpm). Pour précision optimale, mesurez votre FC au réveil pendant 3 jours.`);
  }

  if (rhr < 40) warnings.push("⚠️ FC repos <40 bpm : Caractéristique athlètes d'endurance élite ou erreur de mesure. Vérifier.");
  else if (rhr > 90) warnings.push('⚠️ FC repos >90 bpm : Indicateur potentiel de déconditionnement cardiovasculaire. Consultation médicale recommandée.');
  else if (rhr <= 60) warnings.push('✓ FC repos excellente (40-60 bpm) : Indicateur de bonne condition cardiovasculaire (Karvonen, 1957).');

  const maxHR = calculateMaxHR(age, gender);
  const hrReserve = maxHR - rhr;
  const formulaUsed = gender === 'male' ? 'Tanaka 2001' : 'Gulati 2010';

  const zones: HRZone[] = ZONES_CONFIG.map(zone => {
    const minBPM = Math.round(hrReserve * zone.min + rhr);
    const maxBPM = Math.round(hrReserve * zone.max + rhr);
    return {
      zone: zone.z,
      name: zone.name,
      range: `${Math.round(zone.min * 100)}-${Math.round(zone.max * 100)}%`,
      bpm: `${minBPM}-${maxBPM}`,
      minBPM,
      maxBPM,
      desc: zone.desc,
      usage: zone.usage,
      color: zone.color,
      border: zone.border,
    };
  });

  if (age > 60) warnings.push('⚠️ Âge >60 ans : Clearance médicale obligatoire avant HIIT (zones 5-6) selon ACSM 2018.');
  if (age < 20) warnings.push('ℹ️ Âge <20 ans : Formules FC Max optimisées pour adultes (20-80 ans).');
  warnings.push(`ℹ️ FC Max calculée (${maxHR} bpm) selon formule ${formulaUsed}. Pour validation: test progressif maximal supervisé (Bruce Protocol).`);

  return { maxHR, restingHR: Math.round(rhr), hrReserve, zones, formulaUsed, warnings };
}
