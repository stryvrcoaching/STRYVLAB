/**
 * healthMath.ts — Source de vérité mathématique pour les métriques biométriques
 *
 * Module pur : zéro dépendances React, zéro Prisma, zéro imports externes.
 * Toutes les valeurs numériques sont arrondies à 1 décimale.
 *
 * Références :
 *   BMI : WHO/CDC standard (kg/m²)
 *   US Navy : Hodgdon & Beckett 1984 (Naval Health Research Center Report No. 84-29)
 *   Siri conversion : Siri 1961
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female'

export interface BiometricInputs {
  // Obligatoires
  weight_kg: number
  height_cm: number
  age_at_measurement?: number       // calculé externe (depuis bilan_date - date_of_birth)
  sex: Sex

  // Composition corporelle — bi-directionnels (tous optionnels)
  body_fat_pct?: number
  fat_mass_kg?: number
  muscle_mass_kg?: number
  muscle_mass_pct?: number
  skeletal_muscle_pct?: number

  // Balance impédancemétrie (optionnels)
  visceral_fat_level?: number       // 1–30 (échelle Tanita)
  body_water_pct?: number
  bone_mass_kg?: number

  // Mensurations pour Navy fallback (optionnels)
  waist_cm?: number
  neck_cm?: number
  hips_cm?: number                  // femme uniquement

  // Âge métabolique — fourni par balance impédancemétrique (optionnel)
  metabolic_age?: number
}

export interface NavySuggestion {
  estimated_body_fat_pct: number
  method: 'us-navy'
  precision: '±3-5%'
  inputs_used: Array<'waist' | 'neck' | 'hips'>
}

export interface DerivedMetrics {
  bmi: number
  fat_mass_kg: number | null
  lean_mass_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  muscle_mass_pct: number | null
  skeletal_muscle_pct: number | null
  waist_height_ratio: number | null
  waist_hip_ratio: number | null
  visceral_fat_level: number | null
  body_water_pct: number | null
  bone_mass_kg: number | null
  metabolic_age_estimated: number | null
  metabolic_age_source: 'measured' | 'estimated_katch' | 'estimated_mifflin' | 'unavailable'

  body_fat_source: 'measured' | 'unavailable'
  muscle_mass_source: 'measured_kg' | 'measured_pct' | 'unavailable'

  navy_suggestion: NavySuggestion | null
}

// ---------------------------------------------------------------------------
// Utilitaire interne
// ---------------------------------------------------------------------------

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// ---------------------------------------------------------------------------
// Formules de dérivation — affichées dans les badges "Calculé" de BioNormsPanel
// ---------------------------------------------------------------------------

export const DERIVED_FORMULAS: Partial<Record<string, string>> = {
  bmi:                 'poids ÷ taille²',
  fat_mass_kg:         'poids × (BF% ÷ 100)',
  lean_mass_kg:        'poids × (1 − BF% ÷ 100)',
  body_fat_pct:        'masse grasse ÷ poids × 100',
  muscle_mass_kg:      'poids × (muscle% ÷ 100)',
  muscle_mass_pct:     'masse musculaire ÷ poids × 100',
  waist_height_ratio:  'tour de taille ÷ taille',
  waist_hip_ratio:     'tour de taille ÷ tour de hanche',
  metabolic_age_delta: 'BMR estimé → âge métabolique (Katch-McArdle / Mifflin)',
}

// ---------------------------------------------------------------------------
// Fonctions exportées
// ---------------------------------------------------------------------------

/** Calcul BMI — formule standard WHO (kg/m²), arrondi 1 décimale */
export function calculateBMI(weight_kg: number, height_cm: number): number {
  if (height_cm <= 0) return NaN
  const height_m = height_cm / 100
  return round1(weight_kg / (height_m * height_m))
}

/** Masse grasse en kg depuis le pourcentage */
export function fatMassFromPct(weight_kg: number, body_fat_pct: number): number {
  return round1(weight_kg * (body_fat_pct / 100))
}

/** Pourcentage de masse grasse depuis la masse en kg */
export function bodyFatPctFromMass(weight_kg: number, fat_mass_kg: number): number {
  if (weight_kg <= 0) return NaN
  return round1((fat_mass_kg / weight_kg) * 100)
}

/** Pourcentage de masse musculaire depuis la masse en kg */
export function musclePctFromKg(weight_kg: number, muscle_mass_kg: number): number {
  if (weight_kg <= 0) return NaN
  return round1((muscle_mass_kg / weight_kg) * 100)
}

/** Masse musculaire en kg depuis le pourcentage */
export function muscleKgFromPct(weight_kg: number, muscle_mass_pct: number): number {
  if (weight_kg <= 0) return NaN
  return round1(weight_kg * (muscle_mass_pct / 100))
}

/**
 * Méthode Navy (Hodgdon & Beckett 1984) — retourne %MG
 *
 * Homme  : density = 1.0324 - 0.19077×log10(waist-neck) + 0.15456×log10(height)
 * Femme  : density = 1.29579 - 0.35004×log10(waist+hips-neck) + 0.22100×log10(height)
 * Siri 1961 : BF% = (495/density) - 450
 *
 * Coefficients from NHRC Report 84-29, Table 2, p.14
 * Retourne NaN si hips_cm absent pour une femme ou si log10 reçoit un argument <= 0.
 */
export function navyBodyFatPct(
  sex: Sex,
  waist_cm: number,
  neck_cm: number,
  height_cm: number,
  hips_cm?: number,
): number {
  let density: number

  if (sex === 'male') {
    if (waist_cm - neck_cm <= 0) return NaN
    density =
      1.0324
      - 0.19077 * Math.log10(waist_cm - neck_cm)
      + 0.15456 * Math.log10(height_cm)
  } else {
    if (hips_cm === undefined) {
      return NaN
    }
    if (waist_cm + hips_cm - neck_cm <= 0) return NaN
    density =
      1.29579
      - 0.35004 * Math.log10(waist_cm + hips_cm - neck_cm)
      + 0.22100 * Math.log10(height_cm)
  }

  return round1((495 / density) - 450)
}

/**
 * Ratio taille/hauteur — Savva et al. 2010
 * Seuil critique universel : 0.5 (indépendant du sexe et de l'âge)
 */
export function calculateWaistHeightRatio(waist_cm: number, height_cm: number): number {
  if (height_cm <= 0) return NaN
  return Math.round((waist_cm / height_cm) * 1000) / 1000  // 3 décimales
}

/**
 * BMR via Katch-McArdle (1975) — nécessite lean_mass_kg
 * BMR = 370 + (21.6 × lean_mass_kg)
 */
function bmrKatchMcArdle(lean_mass_kg: number): number {
  return 370 + 21.6 * lean_mass_kg
}

/**
 * BMR via Mifflin-St Jeor (1990) — fallback sans composition corporelle
 * Homme  : BMR = 10×poids + 6.25×taille - 5×âge + 5
 * Femme  : BMR = 10×poids + 6.25×taille - 5×âge - 161
 */
function bmrMifflinStJeor(weight_kg: number, height_cm: number, age: number, sex: Sex): number {
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/**
 * BMR moyen de référence pour un individu du même sexe au même âge
 * basé sur des percentiles NHANES (Harris-Benedict population data).
 * Retourne le BMR médian attendu pour calibrage de l'âge métabolique.
 */
function referenceBMRForAge(age: number, sex: Sex): number {
  // Référence : adulte moyen 70kg/175cm (homme) ou 60kg/163cm (femme)
  if (sex === 'male') {
    return bmrMifflinStJeor(70, 175, age, 'male')
  } else {
    return bmrMifflinStJeor(60, 163, age, 'female')
  }
}

/**
 * Estime l'âge métabolique depuis le BMR calculé.
 *
 * Principe : on cherche l'âge X tel que referenceBMRForAge(X, sex) ≈ bmrActuel
 * On résout par recherche linéaire dans [10, 90].
 *
 * Source méthode : Tanita / InBody reference methodology
 */
export function estimateMetabolicAge(
  bmrActual: number,
  sex: Sex,
): number {
  let closestAge = 30
  let closestDiff = Infinity

  for (let age = 10; age <= 90; age++) {
    const diff = Math.abs(referenceBMRForAge(age, sex) - bmrActual)
    if (diff < closestDiff) {
      closestDiff = diff
      closestAge = age
    }
  }

  return closestAge
}

/**
 * Dérive toutes les métriques biométriques depuis les inputs.
 *
 * Règles de priorité :
 *   body_fat_pct > fat_mass_kg > Navy fallback (suggestion uniquement, non appliqué)
 *   muscle_mass_kg + muscle_mass_pct (directs) > muscle_mass_kg seul > muscle_mass_pct seul
 *   skeletal_muscle_pct : valeur directe balance, jamais calculée
 */
export function deriveMetrics(inputs: BiometricInputs): DerivedMetrics {
  const {
    weight_kg,
    height_cm,
    sex,
    body_fat_pct: inputBfPct,
    fat_mass_kg: inputFatMassKg,
    muscle_mass_kg: inputMuscleMassKg,
    muscle_mass_pct: inputMuscleMassPct,
    waist_cm,
    neck_cm,
    hips_cm,
  } = inputs

  // BMI — toujours calculé
  const bmi = calculateBMI(weight_kg, height_cm)

  // -------------------------------------------------------------------------
  // body_fat / fat_mass / lean_mass
  // -------------------------------------------------------------------------

  let body_fat_pct: number | null = null
  let fat_mass_kg: number | null = null
  let lean_mass_kg: number | null = null
  let body_fat_source: DerivedMetrics['body_fat_source'] = 'unavailable'
  let navy_suggestion: NavySuggestion | null = null

  if (inputBfPct !== undefined) {
    // 1. body_fat_pct direct
    body_fat_pct = round1(inputBfPct)
    fat_mass_kg = fatMassFromPct(weight_kg, inputBfPct)
    const leanFromPct = round1(weight_kg - fat_mass_kg)
    if (fat_mass_kg > weight_kg) {
      lean_mass_kg = null
      body_fat_source = 'unavailable'
    } else {
      lean_mass_kg = leanFromPct
      body_fat_source = 'measured'
    }
  } else if (inputFatMassKg !== undefined) {
    // 2. fat_mass_kg → dériver body_fat_pct
    fat_mass_kg = round1(inputFatMassKg)
    body_fat_pct = bodyFatPctFromMass(weight_kg, inputFatMassKg)
    const leanFromMass = round1(weight_kg - fat_mass_kg)
    if (fat_mass_kg > weight_kg) {
      lean_mass_kg = null
      body_fat_source = 'unavailable'
    } else {
      lean_mass_kg = leanFromMass
      body_fat_source = 'measured'
    }
  } else {
    // 3. Navy fallback — suggestion uniquement, non auto-appliqué
    const canRunNavy =
      waist_cm !== undefined &&
      neck_cm !== undefined &&
      (sex === 'male' || hips_cm !== undefined)

    if (canRunNavy && waist_cm !== undefined && neck_cm !== undefined) {
      const navyResult = navyBodyFatPct(sex, waist_cm, neck_cm, height_cm, hips_cm)

      if (!isNaN(navyResult) && isFinite(navyResult)) {
        const inputs_used: NavySuggestion['inputs_used'] = ['waist', 'neck']
        if (sex === 'female' && hips_cm !== undefined) {
          inputs_used.push('hips')
        }
        navy_suggestion = {
          estimated_body_fat_pct: round1(navyResult),
          method: 'us-navy',
          precision: '±3-5%',
          inputs_used,
        }
      }
    }

    body_fat_pct = null
    fat_mass_kg = null
    lean_mass_kg = null
    body_fat_source = 'unavailable'
  }

  // -------------------------------------------------------------------------
  // muscle_mass
  // -------------------------------------------------------------------------

  let muscle_mass_kg: number | null = null
  let muscle_mass_pct: number | null = null
  let muscle_mass_source: DerivedMetrics['muscle_mass_source'] = 'unavailable'

  // Seuil physiologique maximal admis pour la masse musculaire.
  // Les balances impédancimétriques (Tanita, InBody) mesurent la masse musculaire
  // totale (squelettique + lisse + cardiaque) qui peut atteindre 70%+ chez un athlète.
  // On accepte jusqu'à 75% pour couvrir ces cas.
  const MUSCLE_PCT_MAX_PHYSIOLOGICAL = 75

  if (inputMuscleMassKg !== undefined && inputMuscleMassPct !== undefined) {
    // 1. Les deux fournis directement par la balance — on les prend tels quels
    if (
      inputMuscleMassKg > 0 &&
      inputMuscleMassPct > 0 &&
      inputMuscleMassPct <= MUSCLE_PCT_MAX_PHYSIOLOGICAL
    ) {
      muscle_mass_kg = round1(inputMuscleMassKg)
      muscle_mass_pct = round1(inputMuscleMassPct)
      muscle_mass_source = 'measured_kg'
    }
  } else if (inputMuscleMassKg !== undefined) {
    // 2. kg seul — dériver le %
    const computedPct = musclePctFromKg(weight_kg, inputMuscleMassKg)
    if (computedPct <= MUSCLE_PCT_MAX_PHYSIOLOGICAL) {
      muscle_mass_kg = round1(inputMuscleMassKg)
      muscle_mass_pct = computedPct
      muscle_mass_source = 'measured_kg'
    }
    // else: valeur rejetée (probablement lean_mass confondu avec muscle_mass)
  } else if (inputMuscleMassPct !== undefined) {
    // 3. % seul — dériver kg
    if (inputMuscleMassPct <= MUSCLE_PCT_MAX_PHYSIOLOGICAL) {
      muscle_mass_pct = round1(inputMuscleMassPct)
      muscle_mass_kg = muscleKgFromPct(weight_kg, inputMuscleMassPct)
      muscle_mass_source = 'measured_pct'
    }
    // else: valeur rejetée
  }

  // -------------------------------------------------------------------------
  // waist_height_ratio
  // -------------------------------------------------------------------------

  let waist_height_ratio: number | null = null
  if (inputs.waist_cm !== undefined && inputs.waist_cm > 0) {
    const ratio = calculateWaistHeightRatio(inputs.waist_cm, height_cm)
    if (!isNaN(ratio) && isFinite(ratio)) {
      waist_height_ratio = ratio
    }
  }

  // -------------------------------------------------------------------------
  // metabolic_age
  // -------------------------------------------------------------------------

  let metabolic_age_estimated: number | null = null
  let metabolic_age_source: DerivedMetrics['metabolic_age_source'] = 'unavailable'

  if (inputs.metabolic_age !== undefined) {
    // Valeur directe mesurée par la balance
    metabolic_age_estimated = inputs.metabolic_age
    metabolic_age_source = 'measured'
  } else if (inputs.age_at_measurement !== undefined) {
    // Estimation depuis BMR
    let bmr: number | null = null

    if (lean_mass_kg !== null) {
      // Katch-McArdle si lean_mass disponible
      bmr = bmrKatchMcArdle(lean_mass_kg)
      metabolic_age_source = 'estimated_katch'
    } else {
      // Mifflin-St Jeor fallback
      bmr = bmrMifflinStJeor(weight_kg, height_cm, inputs.age_at_measurement, sex)
      metabolic_age_source = 'estimated_mifflin'
    }

    if (bmr !== null && !isNaN(bmr) && bmr > 0) {
      metabolic_age_estimated = estimateMetabolicAge(bmr, sex)
    } else {
      metabolic_age_source = 'unavailable'
    }
  }

  // waist_hip_ratio — derived from waist_cm + hips_cm
  const waist_hip_ratio =
    inputs.waist_cm !== undefined && inputs.hips_cm !== undefined && inputs.hips_cm > 0
      ? Math.round((inputs.waist_cm / inputs.hips_cm) * 1000) / 1000
      : null

  return {
    bmi,
    fat_mass_kg,
    lean_mass_kg,
    body_fat_pct,
    muscle_mass_kg,
    muscle_mass_pct,
    skeletal_muscle_pct: inputs.skeletal_muscle_pct !== undefined ? round1(inputs.skeletal_muscle_pct) : null,
    waist_height_ratio,
    waist_hip_ratio,
    visceral_fat_level: inputs.visceral_fat_level !== undefined ? inputs.visceral_fat_level : null,
    body_water_pct: inputs.body_water_pct !== undefined ? inputs.body_water_pct : null,
    bone_mass_kg: inputs.bone_mass_kg !== undefined ? inputs.bone_mass_kg : null,
    metabolic_age_estimated,
    metabolic_age_source,
    body_fat_source,
    muscle_mass_source,
    navy_suggestion,
  }
}
