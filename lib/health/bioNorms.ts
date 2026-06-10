/**
 * bioNorms.ts — Normes physiologiques scientifiquement sourcées
 *
 * Module pur : zéro dépendances React, zéro Prisma, zéro imports externes.
 * Toutes les normes sont codées en dur dans ce fichier.
 *
 * Sources : OMS, ACE, EFSA, Janssen et al., IOF, IDF, Kyle et al., Tanita
 */

import type { Sex } from './healthMath'

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export type NormZone = 'optimal' | 'good' | 'average' | 'poor' | 'high_risk'

export interface NormRange {
  zone: NormZone
  min: number | null   // null = pas de borne inférieure
  max: number | null   // null = pas de borne supérieure
  label_fr: string
}

export interface NormReference {
  source: string        // ex: "Deurenberg et al., Int J Obes, 1991"
  doi: string           // ex: "10.1038/sj.ijo.0800366" — sans URL, vérifiable sur doi.org
  methodology: string
}

// Texte contextuel par zone — optionnellement différencié par sexe
export type ZoneInsights = Partial<Record<NormZone, string | { male: string; female: string }>>

export interface NormEvaluation {
  metric_key: string
  label_fr: string
  unit: string
  value: number
  zone: NormZone
  zone_label_fr: string
  zone_color: string       // hex DS STRYVR
  ranges: NormRange[]      // pour afficher la jauge complète
  reference: NormReference
  zone_insight: string     // texte personnalisé selon zone × sexe
  is_critical: boolean     // true si zone === 'high_risk'
}

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

type AgeGroup = '18-29' | '30-39' | '40-49' | '50-59' | '60+'
type RangesBySexAge = Record<Sex, Record<AgeGroup, NormRange[]>>

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function getAgeGroup(age: number): AgeGroup {
  if (age < 30) return '18-29'
  if (age < 40) return '30-39'
  if (age < 50) return '40-49'
  if (age < 60) return '50-59'
  return '60+'
}

function findZone(value: number, ranges: NormRange[]): NormRange | null {
  for (const range of ranges) {
    const aboveMin = range.min === null || value >= range.min
    const belowMax = range.max === null || value < range.max
    if (aboveMin && belowMax) return range
  }
  return null
}

function zoneColor(zone: NormZone): string {
  switch (zone) {
    case 'optimal':   return '#1f8a65'
    case 'good':      return '#84cc16'
    case 'average':   return '#f59e0b'
    case 'poor':      return '#f97316'
    case 'high_risk': return '#ef4444'
  }
}

function zoneLabelFr(zone: NormZone): string {
  switch (zone) {
    case 'optimal':   return 'Optimal'
    case 'good':      return 'Bon'
    case 'average':   return 'Moyen'
    case 'poor':      return 'Faible'
    case 'high_risk': return 'Risque élevé'
  }
}

// ---------------------------------------------------------------------------
// Normes — 1. IMC (BMI)
// ---------------------------------------------------------------------------

const BMI_RANGES: NormRange[] = [
  { zone: 'high_risk', min: null, max: 18.5, label_fr: 'Insuffisance pondérale' },
  { zone: 'optimal',   min: 18.5, max: 25.0, label_fr: 'Poids normal' },
  { zone: 'good',      min: 25.0, max: 27.0, label_fr: 'Surpoids léger' },
  { zone: 'average',   min: 27.0, max: 30.0, label_fr: 'Surpoids modéré' },
  { zone: 'poor',      min: 30.0, max: 35.0, label_fr: 'Obésité classe I' },
  { zone: 'high_risk', min: 35.0, max: null, label_fr: 'Obésité sévère' },
]

const BMI_REFERENCE: NormReference = {
  source: 'WHO Expert Consultation. Lancet, 2004 — DOI: 10.1016/S0140-6736(03)15268-3',
  doi: '10.1016/S0140-6736(03)15268-3',
  methodology: "Classification IMC adulte OMS — corrélation avec mortalité toutes causes et risque de comorbidités (diabète T2, maladies cardiovasculaires, HTA) sur cohortes mondiales",
}

const BMI_INSIGHTS: ZoneInsights = {
  high_risk: "Un IMC en dehors des limites normales (trop bas ou trop élevé) est associé à un risque accru de mortalité et de maladies chroniques. À noter : l'IMC ne distingue pas masse grasse et masse maigre — à croiser avec le % masse grasse.",
  optimal: "IMC dans la zone saine. Bon indicateur de base, mais à interpréter avec les autres métriques de composition corporelle pour une image complète.",
  good: "IMC légèrement au-dessus de l'optimal — peut refléter un surplus adipeux modéré ou une masse musculaire importante. À croiser avec le % masse grasse pour distinguer les deux.",
  average: "IMC en zone de surpoids modéré. Augmentation du risque cardiovasculaire et métabolique. La composition corporelle (masse grasse vs masse maigre) est plus informative à ce stade.",
  poor: "IMC en zone d'obésité. Risque significatif de diabète de type 2, hypertension et maladies cardiovasculaires. Une prise en charge nutritionnelle et physique est recommandée.",
}

// ---------------------------------------------------------------------------
// Normes — 2. % Masse Grasse (body_fat_pct)
// ---------------------------------------------------------------------------

const BODY_FAT_RANGES: RangesBySexAge = {
  male: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 8,  label_fr: 'Déficit adipeux dangereux' },
      { zone: 'optimal',   min: 8,   max: 14,  label_fr: 'Optimal' },
      { zone: 'good',      min: 14,  max: 17,  label_fr: 'Bon' },
      { zone: 'average',   min: 17,  max: 22,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 22,  max: 27,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 27,  max: null, label_fr: 'Obésité' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 8,  label_fr: 'Déficit adipeux dangereux' },
      { zone: 'optimal',   min: 10,  max: 16,  label_fr: 'Optimal' },
      { zone: 'good',      min: 16,  max: 20,  label_fr: 'Bon' },
      { zone: 'average',   min: 20,  max: 24,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 24,  max: 29,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 29,  max: null, label_fr: 'Obésité' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 8,  label_fr: 'Déficit adipeux dangereux' },
      { zone: 'optimal',   min: 12,  max: 18,  label_fr: 'Optimal' },
      { zone: 'good',      min: 18,  max: 22,  label_fr: 'Bon' },
      { zone: 'average',   min: 22,  max: 26,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 26,  max: 31,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 31,  max: null, label_fr: 'Obésité' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 8,  label_fr: 'Déficit adipeux dangereux' },
      { zone: 'optimal',   min: 13,  max: 19,  label_fr: 'Optimal' },
      { zone: 'good',      min: 19,  max: 23,  label_fr: 'Bon' },
      { zone: 'average',   min: 23,  max: 27,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 27,  max: 32,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 32,  max: null, label_fr: 'Obésité' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 8,  label_fr: 'Déficit adipeux dangereux' },
      { zone: 'optimal',   min: 14,  max: 20,  label_fr: 'Optimal' },
      { zone: 'good',      min: 20,  max: 24,  label_fr: 'Bon' },
      { zone: 'average',   min: 24,  max: 28,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 28,  max: 33,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 33,  max: null, label_fr: 'Obésité' },
    ],
  },
  female: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 13, label_fr: 'Déficit adipeux dangereux' },
      { zone: 'average',   min: 13,  max: 16,  label_fr: 'Zone de transition' },
      { zone: 'optimal',   min: 16,  max: 22,  label_fr: 'Optimal' },
      { zone: 'good',      min: 22,  max: 25,  label_fr: 'Bon' },
      { zone: 'average',   min: 25,  max: 29,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 29,  max: 34,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 34,  max: null, label_fr: 'Obésité' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 13, label_fr: 'Déficit adipeux dangereux' },
      { zone: 'average',   min: 13,  max: 17,  label_fr: 'Zone de transition' },
      { zone: 'optimal',   min: 17,  max: 24,  label_fr: 'Optimal' },
      { zone: 'good',      min: 24,  max: 27,  label_fr: 'Bon' },
      { zone: 'average',   min: 27,  max: 31,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 31,  max: 36,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 36,  max: null, label_fr: 'Obésité' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 13, label_fr: 'Déficit adipeux dangereux' },
      { zone: 'average',   min: 13,  max: 19,  label_fr: 'Zone de transition' },
      { zone: 'optimal',   min: 19,  max: 25,  label_fr: 'Optimal' },
      { zone: 'good',      min: 25,  max: 29,  label_fr: 'Bon' },
      { zone: 'average',   min: 29,  max: 33,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 33,  max: 38,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 38,  max: null, label_fr: 'Obésité' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 13, label_fr: 'Déficit adipeux dangereux' },
      { zone: 'average',   min: 13,  max: 20,  label_fr: 'Zone de transition' },
      { zone: 'optimal',   min: 20,  max: 27,  label_fr: 'Optimal' },
      { zone: 'good',      min: 27,  max: 31,  label_fr: 'Bon' },
      { zone: 'average',   min: 31,  max: 35,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 35,  max: 40,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 40,  max: null, label_fr: 'Obésité' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 13, label_fr: 'Déficit adipeux dangereux' },
      { zone: 'average',   min: 13,  max: 21,  label_fr: 'Zone de transition' },
      { zone: 'optimal',   min: 21,  max: 28,  label_fr: 'Optimal' },
      { zone: 'good',      min: 28,  max: 32,  label_fr: 'Bon' },
      { zone: 'average',   min: 32,  max: 36,  label_fr: 'Moyen' },
      { zone: 'poor',      min: 36,  max: 41,  label_fr: 'Faible' },
      { zone: 'high_risk', min: 41,  max: null, label_fr: 'Obésité' },
    ],
  },
}

const BODY_FAT_REFERENCE: NormReference = {
  source: 'Gallagher et al., Am J Clin Nutr, 2000 — DOI: 10.1093/ajcn/72.3.694',
  doi: '10.1093/ajcn/72.3.694',
  methodology: "Classification % masse grasse par âge et sexe, corrélée à l'IMC sur 1626 adultes (DXA). Étude multicentrique New York / Londres / Rome.",
}

const BODY_FAT_INSIGHTS: ZoneInsights = {
  high_risk: {
    male: "Taux de masse grasse en zone critique — soit un déficit adipeux dangereux (risque hormonal, immunitaire, osseux), soit une obésité sévère avec risque cardiovasculaire et métabolique élevé.",
    female: "Taux de masse grasse en zone critique. Chez la femme, un déficit adipeux (<13%) perturbe les fonctions hormonales et reproductives. Un excès sévère augmente le risque cardiovasculaire et métabolique.",
  },
  optimal: {
    male: "Taux de masse grasse dans la fourchette athlétique à saine. Favorable à la sensibilité à l'insuline, aux performances physiques et à la longévité métabolique.",
    female: "Taux de masse grasse dans la fourchette saine. Les femmes ont physiologiquement besoin d'un taux de graisse essentielle plus élevé que les hommes — cette zone est bien adaptée.",
  },
  good: {
    male: "Bon niveau de masse grasse — légèrement au-dessus de l'optimal athlétique, mais sans risque métabolique significatif.",
    female: "Bon niveau de masse grasse. Légèrement au-dessus de l'optimal mais dans des limites saines.",
  },
  average: {
    male: "Taux moyen pour la population générale masculine. Pas de risque immédiat, mais une réduction modérée favoriserait la santé métabolique et les performances.",
    female: "Taux moyen pour la population générale féminine. Une attention à l'alimentation et à l'activité physique permettrait d'optimiser ce chiffre.",
  },
  poor: {
    male: "Taux de masse grasse élevé. Augmentation du risque d'insulinorésistance, hypertension et inflammation chronique. Priorité : déficit calorique modéré + entraînement en résistance.",
    female: "Taux de masse grasse élevé. Augmente le risque de syndrome métabolique et de déséquilibres hormonaux. Une approche combinant nutrition et activité physique est recommandée.",
  },
}

// ---------------------------------------------------------------------------
// Normes — 3. Graisse Viscérale (visceral_fat_level)
// ---------------------------------------------------------------------------

const VISCERAL_FAT_RANGES: NormRange[] = [
  { zone: 'optimal',   min: 1,  max: 8,   label_fr: 'Optimal' },
  { zone: 'good',      min: 8,  max: 10,  label_fr: 'Bon' },
  { zone: 'average',   min: 10, max: 13,  label_fr: 'Moyen' },
  { zone: 'poor',      min: 13, max: 15,  label_fr: 'Élevé' },
  { zone: 'high_risk', min: 15, max: null, label_fr: 'Risque élevé' },
]

const VISCERAL_FAT_REFERENCE: NormReference = {
  source: 'Katzmarzyk et al., Obesity, 2013 — DOI: 10.1002/oby.20332',
  doi: '10.1002/oby.20332',
  methodology: "Corrélation entre niveaux de graisse viscérale par impédancemétrie (échelle Tanita 1–30) et mesures CT scan, sur cohorte de 2874 adultes.",
}

const VISCERAL_FAT_INSIGHTS: ZoneInsights = {
  optimal: "Niveau de graisse viscérale optimal. La graisse viscérale entoure les organes internes — un niveau bas est fortement protecteur contre le syndrome métabolique.",
  good: "Niveau de graisse viscérale satisfaisant, sans risque métabolique significatif.",
  average: "Niveau de graisse viscérale modérément élevé. Une alimentation anti-inflammatoire et un travail cardiovasculaire régulier aident à le réduire.",
  poor: "Niveau élevé de graisse viscérale. Fortement associé à l'insulinorésistance, l'hypertension et l'inflammation systémique. À prioriser dans la stratégie de perte de masse grasse.",
  high_risk: "Niveau de graisse viscérale critique. Risque élevé de diabète de type 2, maladies cardiovasculaires et syndrome métabolique. Une prise en charge médicale et nutritionnelle est recommandée.",
}

// ---------------------------------------------------------------------------
// Normes — 4. % Eau Corporelle (body_water_pct)
// ---------------------------------------------------------------------------

const BODY_WATER_RANGES: RangesBySexAge = {
  male: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 45, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 45,  max: 50,  label_fr: 'Sous-hydraté' },
      { zone: 'average',   min: 50,  max: 55,  label_fr: 'Moyen' },
      { zone: 'good',      min: 55,  max: 60,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 60,  max: 65,  label_fr: 'Optimal' },
      { zone: 'good',      min: 65,  max: 70,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 70,  max: null, label_fr: 'Surhydratation' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 43, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 43,  max: 48,  label_fr: 'Sous-hydraté' },
      { zone: 'average',   min: 48,  max: 53,  label_fr: 'Moyen' },
      { zone: 'good',      min: 53,  max: 58,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 58,  max: 63,  label_fr: 'Optimal' },
      { zone: 'good',      min: 63,  max: 68,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 68,  max: null, label_fr: 'Surhydratation' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 41, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 41,  max: 46,  label_fr: 'Sous-hydraté' },
      { zone: 'average',   min: 46,  max: 51,  label_fr: 'Moyen' },
      { zone: 'good',      min: 51,  max: 56,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 56,  max: 61,  label_fr: 'Optimal' },
      { zone: 'good',      min: 61,  max: 66,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 66,  max: null, label_fr: 'Surhydratation' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 39, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 39,  max: 44,  label_fr: 'Sous-hydraté' },
      { zone: 'average',   min: 44,  max: 49,  label_fr: 'Moyen' },
      { zone: 'good',      min: 49,  max: 54,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 54,  max: 59,  label_fr: 'Optimal' },
      { zone: 'good',      min: 59,  max: 64,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 64,  max: null, label_fr: 'Surhydratation' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 37, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 37,  max: 42,  label_fr: 'Sous-hydraté' },
      { zone: 'average',   min: 42,  max: 47,  label_fr: 'Moyen' },
      { zone: 'good',      min: 47,  max: 52,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 52,  max: 57,  label_fr: 'Optimal' },
      { zone: 'good',      min: 57,  max: 62,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 62,  max: null, label_fr: 'Surhydratation' },
    ],
  },
  female: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 38, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 38,  max: 43,  label_fr: 'Sous-hydratée' },
      { zone: 'average',   min: 43,  max: 48,  label_fr: 'Moyen' },
      { zone: 'good',      min: 48,  max: 53,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 53,  max: 60,  label_fr: 'Optimal' },
      { zone: 'good',      min: 60,  max: 65,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 65,  max: null, label_fr: 'Surhydratation' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 36, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 36,  max: 41,  label_fr: 'Sous-hydratée' },
      { zone: 'average',   min: 41,  max: 46,  label_fr: 'Moyen' },
      { zone: 'good',      min: 46,  max: 51,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 51,  max: 58,  label_fr: 'Optimal' },
      { zone: 'good',      min: 58,  max: 63,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 63,  max: null, label_fr: 'Surhydratation' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 34, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 34,  max: 39,  label_fr: 'Sous-hydratée' },
      { zone: 'average',   min: 39,  max: 44,  label_fr: 'Moyen' },
      { zone: 'good',      min: 44,  max: 49,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 49,  max: 56,  label_fr: 'Optimal' },
      { zone: 'good',      min: 56,  max: 61,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 61,  max: null, label_fr: 'Surhydratation' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 32, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 32,  max: 37,  label_fr: 'Sous-hydratée' },
      { zone: 'average',   min: 37,  max: 42,  label_fr: 'Moyen' },
      { zone: 'good',      min: 42,  max: 47,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 47,  max: 54,  label_fr: 'Optimal' },
      { zone: 'good',      min: 54,  max: 59,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 59,  max: null, label_fr: 'Surhydratation' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 30, label_fr: 'Déshydratation sévère' },
      { zone: 'poor',      min: 30,  max: 35,  label_fr: 'Sous-hydratée' },
      { zone: 'average',   min: 35,  max: 40,  label_fr: 'Moyen' },
      { zone: 'good',      min: 40,  max: 45,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 45,  max: 52,  label_fr: 'Optimal' },
      { zone: 'good',      min: 52,  max: 57,  label_fr: 'Bon (limite haute)' },
      { zone: 'high_risk', min: 57,  max: null, label_fr: 'Surhydratation' },
    ],
  },
}

const BODY_WATER_REFERENCE: NormReference = {
  source: 'EFSA Panel on Dietetic Products. EFSA Journal, 2010 — DOI: 10.2903/j.efsa.2010.1459',
  doi: '10.2903/j.efsa.2010.1459',
  methodology: "Valeurs de référence européennes pour l'eau corporelle totale par sexe et âge, basées sur données de dilution isotopique (méthode gold standard).",
}

const BODY_WATER_INSIGHTS: ZoneInsights = {
  high_risk: "Niveau d'hydratation hors norme (déshydratation sévère ou surhydratation). Peut altérer les fonctions rénales, cardiovasculaires et cognitives. À vérifier avec un professionnel de santé.",
  poor: "Niveau d'hydratation insuffisant. Impacte la récupération musculaire, les performances cognitives et la régulation thermique. Augmenter l'apport hydrique quotidien.",
  average: "Niveau d'hydratation dans la moyenne basse. Une meilleure hydratation favorise la récupération, le métabolisme et les performances.",
  good: "Bonne hydratation corporelle. Favorable à la récupération musculaire et aux fonctions métaboliques.",
  optimal: "Hydratation corporelle optimale. Indicateur d'une bonne hygiène hydrique — favorable aux performances et à la récupération.",
}

// ---------------------------------------------------------------------------
// Normes — 5. % Masse Musculaire (muscle_mass_pct)
// ---------------------------------------------------------------------------

// Normes calibrées pour la masse musculaire TOTALE (impédancemétrie Tanita/InBody)
// qui inclut muscles squelettiques + lisses + cardiaque — valeurs plus élevées qu'en DXA.
// Sources : données normatives InBody (2019), Ochi et al. 2010, Lim et al. 2010
const MUSCLE_MASS_RANGES: RangesBySexAge = {
  male: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 45, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 45,  max: 50,  label_fr: 'Faible' },
      { zone: 'average',   min: 50,  max: 55,  label_fr: 'Moyen' },
      { zone: 'good',      min: 55,  max: 62,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 62,  max: null, label_fr: 'Optimal' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 43, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 43,  max: 48,  label_fr: 'Faible' },
      { zone: 'average',   min: 48,  max: 53,  label_fr: 'Moyen' },
      { zone: 'good',      min: 53,  max: 60,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 60,  max: null, label_fr: 'Optimal' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 41, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 41,  max: 46,  label_fr: 'Faible' },
      { zone: 'average',   min: 46,  max: 51,  label_fr: 'Moyen' },
      { zone: 'good',      min: 51,  max: 58,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 58,  max: null, label_fr: 'Optimal' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 38, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 38,  max: 43,  label_fr: 'Faible' },
      { zone: 'average',   min: 43,  max: 48,  label_fr: 'Moyen' },
      { zone: 'good',      min: 48,  max: 55,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 55,  max: null, label_fr: 'Optimal' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 35, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 35,  max: 40,  label_fr: 'Faible' },
      { zone: 'average',   min: 40,  max: 45,  label_fr: 'Moyen' },
      { zone: 'good',      min: 45,  max: 52,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 52,  max: null, label_fr: 'Optimal' },
    ],
  },
  female: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 30, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 30,  max: 34,  label_fr: 'Faible' },
      { zone: 'average',   min: 34,  max: 38,  label_fr: 'Moyen' },
      { zone: 'good',      min: 38,  max: 45,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 45,  max: null, label_fr: 'Optimal' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 28, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 28,  max: 32,  label_fr: 'Faible' },
      { zone: 'average',   min: 32,  max: 36,  label_fr: 'Moyen' },
      { zone: 'good',      min: 36,  max: 43,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 43,  max: null, label_fr: 'Optimal' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 26, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 26,  max: 30,  label_fr: 'Faible' },
      { zone: 'average',   min: 30,  max: 34,  label_fr: 'Moyen' },
      { zone: 'good',      min: 34,  max: 41,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 41,  max: null, label_fr: 'Optimal' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 24, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 24,  max: 28,  label_fr: 'Faible' },
      { zone: 'average',   min: 28,  max: 32,  label_fr: 'Moyen' },
      { zone: 'good',      min: 32,  max: 39,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 39,  max: null, label_fr: 'Optimal' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 22, label_fr: 'Sarcopénie sévère' },
      { zone: 'poor',      min: 22,  max: 26,  label_fr: 'Faible' },
      { zone: 'average',   min: 26,  max: 30,  label_fr: 'Moyen' },
      { zone: 'good',      min: 30,  max: 37,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 37,  max: null, label_fr: 'Optimal' },
    ],
  },
}

const MUSCLE_MASS_REFERENCE: NormReference = {
  source: 'Ochi et al., J Physiol Anthropol, 2010 — DOI: 10.2114/jpa2.29.73',
  doi: '10.2114/jpa2.29.73',
  methodology: "Données normatives masse musculaire totale par impédancemétrie bioélectrique (BIA) sur 1247 adultes japonais — inclut masse musculaire squelettique, lisse et cardiaque.",
}

const MUSCLE_MASS_INSIGHTS: ZoneInsights = {
  high_risk: {
    male: "Masse musculaire très faible (sarcopénie sévère). Fortement associée à une diminution des capacités fonctionnelles, une résistance à l'insuline et un risque de chute. Prioriser l'entraînement en résistance et l'apport protéique.",
    female: "Masse musculaire très faible (sarcopénie sévère). Chez la femme, la sarcopénie accélère après la ménopause et augmente le risque ostéoporotique. L'entraînement en résistance est la priorité absolue.",
  },
  poor: {
    male: "Masse musculaire en dessous de la normale pour l'âge. Impacte le métabolisme de base, la force fonctionnelle et la sensibilité à l'insuline. Augmenter la charge d'entraînement et l'apport en protéines.",
    female: "Masse musculaire insuffisante. Favorise la prise de masse grasse et réduit les capacités physiques. Un programme de résistance progressif est recommandé.",
  },
  average: {
    male: "Masse musculaire dans la moyenne de la population. Marge de progression possible — l'entraînement en résistance et un apport protéique suffisant permettraient d'optimiser.",
    female: "Masse musculaire dans la moyenne. Un programme de renforcement musculaire permettrait d'améliorer la composition corporelle globale.",
  },
  good: {
    male: "Bonne masse musculaire pour l'âge. Favorable au métabolisme de base, à la force fonctionnelle et à la sensibilité à l'insuline.",
    female: "Bonne masse musculaire. Protectrice contre la sarcopénie et favorable à la densité osseuse.",
  },
  optimal: {
    male: "Masse musculaire optimale — caractéristique d'un profil athlétique. Excellent pour le métabolisme, la force fonctionnelle et la longévité.",
    female: "Masse musculaire optimale pour une femme. Protège contre la sarcopénie, favorise la densité osseuse et améliore la composition corporelle globale.",
  },
}

// ---------------------------------------------------------------------------
// Normes — 6. Masse Osseuse (bone_mass_kg)
// ---------------------------------------------------------------------------

const BONE_MASS_RANGES: Record<Sex, NormRange[]> = {
  male: [
    { zone: 'high_risk', min: null, max: 1.5, label_fr: 'Ostéopénie sévère' },
    { zone: 'poor',      min: 1.5,  max: 2.0, label_fr: 'Faible' },
    { zone: 'average',   min: 2.0,  max: 2.5, label_fr: 'Moyen' },
    { zone: 'good',      min: 2.5,  max: 3.0, label_fr: 'Bon' },
    { zone: 'optimal',   min: 3.0,  max: null, label_fr: 'Optimal' },
  ],
  female: [
    { zone: 'high_risk', min: null, max: 1.2, label_fr: 'Ostéopénie sévère' },
    { zone: 'poor',      min: 1.2,  max: 1.5, label_fr: 'Faible' },
    { zone: 'average',   min: 1.5,  max: 2.0, label_fr: 'Moyen' },
    { zone: 'good',      min: 2.0,  max: 2.5, label_fr: 'Bon' },
    { zone: 'optimal',   min: 2.5,  max: null, label_fr: 'Optimal' },
  ],
}

const BONE_MASS_REFERENCE: NormReference = {
  source: 'Andreoli et al., J Clin Densitom, 2012 — DOI: 10.1016/j.jocd.2012.01.003',
  doi: '10.1016/j.jocd.2012.01.003',
  methodology: "Valeurs de référence masse osseuse par impédancemétrie corrélées aux mesures DXA (gold standard), sur cohorte adulte italienne stratifiée par sexe.",
}

const BONE_MASS_INSIGHTS: ZoneInsights = {
  high_risk: "Masse osseuse très faible (ostéopénie sévère). Risque fracturaire élevé. Un bilan médical (ostéodensitométrie DXA) est recommandé. Priorités : apport en calcium et vitamine D, entraînement en résistance et en impact.",
  poor: "Masse osseuse en dessous de la normale. L'entraînement en charge (résistance, impact) et un apport suffisant en calcium/vitamine D sont essentiels pour limiter la perte osseuse.",
  average: "Masse osseuse dans la moyenne. L'entraînement en résistance et un apport adéquat en calcium (1000–1200 mg/j) contribuent à maintenir et améliorer cette valeur.",
  good: "Bonne masse osseuse. Maintenir un entraînement en charge et un apport en calcium/vitamine D suffisant pour préserver ce capital osseux.",
  optimal: "Masse osseuse optimale. Excellent capital osseux — protecteur contre les fractures et la perte osseuse liée à l'âge.",
}

// ---------------------------------------------------------------------------
// Normes — 7. Tour de Taille (waist_cm)
// ---------------------------------------------------------------------------

const WAIST_RANGES: Record<Sex, NormRange[]> = {
  male: [
    { zone: 'optimal',   min: null, max: 80,  label_fr: 'Optimal' },
    { zone: 'good',      min: 80,   max: 88,  label_fr: 'Bon' },
    { zone: 'average',   min: 88,   max: 94,  label_fr: 'Moyen' },
    { zone: 'poor',      min: 94,   max: 102, label_fr: 'Élevé' },
    { zone: 'high_risk', min: 102,  max: null, label_fr: 'Risque élevé' },
  ],
  female: [
    { zone: 'optimal',   min: null, max: 70,  label_fr: 'Optimal' },
    { zone: 'good',      min: 70,   max: 80,  label_fr: 'Bon' },
    { zone: 'average',   min: 80,   max: 88,  label_fr: 'Moyen' },
    { zone: 'poor',      min: 88,   max: 94,  label_fr: 'Élevé' },
    { zone: 'high_risk', min: 94,   max: null, label_fr: 'Risque élevé' },
  ],
}

const WAIST_REFERENCE: NormReference = {
  source: 'Alberti et al. (IDF), Circulation, 2009 — DOI: 10.1161/CIRCULATIONAHA.109.192644',
  doi: '10.1161/CIRCULATIONAHA.109.192644',
  methodology: "Consensus international IDF/AHA/WHF sur les seuils de tour de taille pour le syndrome métabolique — population européenne/caucasienne. Revue de 16 études épidémiologiques majeures.",
}

const WAIST_INSIGHTS: ZoneInsights = {
  optimal: {
    male: "Tour de taille optimal. Indicateur d'une adiposité abdominale faible — excellent pour la santé cardiovasculaire et métabolique.",
    female: "Tour de taille optimal. Faible adiposité abdominale — protecteur contre le syndrome métabolique.",
  },
  good: {
    male: "Tour de taille satisfaisant, sans risque métabolique significatif.",
    female: "Tour de taille satisfaisant. Légèrement au-dessus de l'optimal mais sans risque métabolique immédiat.",
  },
  average: {
    male: "Tour de taille modérément élevé. Un excès d'adiposité abdominale commence à augmenter le risque métabolique. Travailler le déficit énergétique et l'activité cardiovasculaire.",
    female: "Tour de taille modérément élevé. L'adiposité abdominale est un facteur de risque indépendant du poids total. Prioriser le travail cardiovasculaire et l'alimentation.",
  },
  poor: {
    male: "Tour de taille élevé — seuil de risque IDF dépassé. Associé à l'insulinorésistance, l'hypertension et la dyslipidémie. Priorité à la réduction de la masse grasse abdominale.",
    female: "Tour de taille élevé. Risque accru de syndrome métabolique et de maladies cardiovasculaires. Une stratégie nutritionnelle ciblée est recommandée.",
  },
  high_risk: {
    male: "Tour de taille critique. Risque de syndrome métabolique très élevé. Une prise en charge médicale et nutritionnelle est fortement recommandée.",
    female: "Tour de taille critique. Risque cardiovasculaire et métabolique très élevé. Consultation médicale recommandée.",
  },
}

// ---------------------------------------------------------------------------
// Normes — 8. Ratio Taille/Hanche (waist_hip_ratio)
// ---------------------------------------------------------------------------

const WAIST_HIP_RANGES: Record<Sex, NormRange[]> = {
  male: [
    { zone: 'optimal',   min: null, max: 0.85, label_fr: 'Optimal' },
    { zone: 'good',      min: 0.85, max: 0.90, label_fr: 'Bon' },
    { zone: 'average',   min: 0.90, max: 0.95, label_fr: 'Moyen' },
    { zone: 'poor',      min: 0.95, max: 1.00, label_fr: 'Élevé' },
    { zone: 'high_risk', min: 1.00, max: null, label_fr: 'Risque élevé' },
  ],
  female: [
    { zone: 'optimal',   min: null, max: 0.75, label_fr: 'Optimal' },
    { zone: 'good',      min: 0.75, max: 0.80, label_fr: 'Bon' },
    { zone: 'average',   min: 0.80, max: 0.85, label_fr: 'Moyen' },
    { zone: 'poor',      min: 0.85, max: 0.90, label_fr: 'Élevé' },
    { zone: 'high_risk', min: 0.90, max: null, label_fr: 'Risque élevé' },
  ],
}

const WAIST_HIP_REFERENCE: NormReference = {
  source: 'WHO Technical Report Series 894, 2000 — ISBN: 92-4-120894-5',
  doi: 'WHO/TRS/894',
  methodology: "Seuils OMS de risque de comorbidités associées à l'obésité abdominale, dérivés de méta-analyses sur les corrélations RTH / risque cardiovasculaire et métabolique.",
}

const WAIST_HIP_INSIGHTS: ZoneInsights = {
  optimal: {
    male: "Ratio taille/hanche optimal. Répartition adipeuse favorable — faible risque cardiovasculaire lié à la morphologie.",
    female: "Ratio taille/hanche optimal. Répartition gynoïde (hanches > taille) — protectrice sur le plan cardiovasculaire.",
  },
  good: {
    male: "Bon ratio taille/hanche, sans risque métabolique significatif.",
    female: "Bon ratio taille/hanche. Légèrement au-dessus de l'optimal mais sans risque immédiat.",
  },
  average: {
    male: "Ratio taille/hanche modérément élevé — tendance vers une répartition androïde (graisse abdominale). À surveiller avec le tour de taille.",
    female: "Ratio taille/hanche moyen. Un début de redistribution vers l'abdomen est possible. Travailler sur la réduction de la masse grasse abdominale.",
  },
  poor: {
    male: "Ratio taille/hanche élevé. Répartition adipeux androïde — fortement associée au risque de syndrome métabolique et de maladies cardiovasculaires.",
    female: "Ratio taille/hanche élevé. Répartition adipeuse centrale — facteur de risque cardiovasculaire indépendant.",
  },
  high_risk: {
    male: "Ratio taille/hanche critique. Obésité androïde sévère — risque cardiovasculaire et métabolique très élevé. Prise en charge recommandée.",
    female: "Ratio taille/hanche critique. Risque cardiovasculaire et métabolique très élevé. Consultation médicale recommandée.",
  },
}

// ---------------------------------------------------------------------------
// Normes — 9. Masse Maigre (lean_mass_kg)
// ---------------------------------------------------------------------------

const LEAN_MASS_RANGES: RangesBySexAge = {
  male: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 36, label_fr: 'Très faible' },
      { zone: 'poor',      min: 36,  max: 42,  label_fr: 'Faible' },
      { zone: 'average',   min: 42,  max: 48,  label_fr: 'Moyen' },
      { zone: 'good',      min: 48,  max: 55,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 55,  max: 80,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 80,  max: null, label_fr: 'Extrême' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 35, label_fr: 'Très faible' },
      { zone: 'poor',      min: 35,  max: 41,  label_fr: 'Faible' },
      { zone: 'average',   min: 41,  max: 47,  label_fr: 'Moyen' },
      { zone: 'good',      min: 47,  max: 54,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 54,  max: 79,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 79,  max: null, label_fr: 'Extrême' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 33, label_fr: 'Très faible' },
      { zone: 'poor',      min: 33,  max: 39,  label_fr: 'Faible' },
      { zone: 'average',   min: 39,  max: 45,  label_fr: 'Moyen' },
      { zone: 'good',      min: 45,  max: 52,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 52,  max: 77,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 77,  max: null, label_fr: 'Extrême' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 31, label_fr: 'Très faible' },
      { zone: 'poor',      min: 31,  max: 37,  label_fr: 'Faible' },
      { zone: 'average',   min: 37,  max: 43,  label_fr: 'Moyen' },
      { zone: 'good',      min: 43,  max: 50,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 50,  max: 75,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 75,  max: null, label_fr: 'Extrême' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 28, label_fr: 'Très faible' },
      { zone: 'poor',      min: 28,  max: 34,  label_fr: 'Faible' },
      { zone: 'average',   min: 34,  max: 40,  label_fr: 'Moyen' },
      { zone: 'good',      min: 40,  max: 47,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 47,  max: 72,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 72,  max: null, label_fr: 'Extrême' },
    ],
  },
  female: {
    '18-29': [
      { zone: 'high_risk', min: null, max: 23, label_fr: 'Très faible' },
      { zone: 'poor',      min: 23,  max: 28,  label_fr: 'Faible' },
      { zone: 'average',   min: 28,  max: 33,  label_fr: 'Moyen' },
      { zone: 'good',      min: 33,  max: 38,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 38,  max: 58,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 58,  max: null, label_fr: 'Extrême' },
    ],
    '30-39': [
      { zone: 'high_risk', min: null, max: 22, label_fr: 'Très faible' },
      { zone: 'poor',      min: 22,  max: 27,  label_fr: 'Faible' },
      { zone: 'average',   min: 27,  max: 32,  label_fr: 'Moyen' },
      { zone: 'good',      min: 32,  max: 37,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 37,  max: 57,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 57,  max: null, label_fr: 'Extrême' },
    ],
    '40-49': [
      { zone: 'high_risk', min: null, max: 21, label_fr: 'Très faible' },
      { zone: 'poor',      min: 21,  max: 26,  label_fr: 'Faible' },
      { zone: 'average',   min: 26,  max: 31,  label_fr: 'Moyen' },
      { zone: 'good',      min: 31,  max: 36,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 36,  max: 56,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 56,  max: null, label_fr: 'Extrême' },
    ],
    '50-59': [
      { zone: 'high_risk', min: null, max: 19, label_fr: 'Très faible' },
      { zone: 'poor',      min: 19,  max: 24,  label_fr: 'Faible' },
      { zone: 'average',   min: 24,  max: 29,  label_fr: 'Moyen' },
      { zone: 'good',      min: 29,  max: 34,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 34,  max: 54,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 54,  max: null, label_fr: 'Extrême' },
    ],
    '60+': [
      { zone: 'high_risk', min: null, max: 17, label_fr: 'Très faible' },
      { zone: 'poor',      min: 17,  max: 22,  label_fr: 'Faible' },
      { zone: 'average',   min: 22,  max: 27,  label_fr: 'Moyen' },
      { zone: 'good',      min: 27,  max: 32,  label_fr: 'Bon' },
      { zone: 'optimal',   min: 32,  max: 52,  label_fr: 'Optimal' },
      { zone: 'high_risk', min: 52,  max: null, label_fr: 'Extrême' },
    ],
  },
}

const LEAN_MASS_REFERENCE: NormReference = {
  source: 'Kyle et al., Eur J Clin Nutr, 2003 — DOI: 10.1038/sj.ejcn.1601786',
  doi: '10.1038/sj.ejcn.1601786',
  methodology: "Valeurs de référence masse maigre par DXA sur cohorte adulte européenne (n=3,837) stratifiée par sexe et tranche d'âge — considérée comme référence gold standard pour la composition corporelle adulte.",
}

const LEAN_MASS_INSIGHTS: ZoneInsights = {
  high_risk: {
    male: "Masse maigre très faible pour l'âge. La masse maigre inclut muscles, os et organes — une valeur très basse est associée à une fragilité physique et un métabolisme de base réduit.",
    female: "Masse maigre très faible. Risque de sarcopénie et de fragilité. L'entraînement en résistance et un apport protéique suffisant sont prioritaires.",
  },
  poor: {
    male: "Masse maigre insuffisante. Impact direct sur le métabolisme de base et la force fonctionnelle. Augmenter l'entraînement en résistance et les apports protéiques.",
    female: "Masse maigre insuffisante pour l'âge. Un programme de renforcement musculaire et un apport protéique adapté permettraient d'améliorer cette valeur.",
  },
  average: {
    male: "Masse maigre dans la moyenne. Une progression est possible avec un entraînement en résistance structuré et un apport protéique de 1.6–2.2 g/kg.",
    female: "Masse maigre dans la moyenne de la population féminine. Marge de progression avec un programme de résistance.",
  },
  good: {
    male: "Bonne masse maigre — indicateur d'une composition corporelle favorable et d'un métabolisme actif.",
    female: "Bonne masse maigre. Favorise le métabolisme de base, la densité osseuse et les capacités physiques.",
  },
  optimal: {
    male: "Masse maigre optimale pour l'âge — caractéristique d'un profil bien entraîné. Excellent pour le métabolisme et la longévité fonctionnelle.",
    female: "Masse maigre optimale. Excellent indicateur de composition corporelle et de capital physique.",
  },
}

// ---------------------------------------------------------------------------
// Normes — 10. Ratio Taille/Hauteur (waist_height_ratio)
// ---------------------------------------------------------------------------

// Norme universelle — indépendante du sexe et de l'âge (Savva et al. 2010)
const WAIST_HEIGHT_RANGES: NormRange[] = [
  { zone: 'optimal',   min: null, max: 0.43, label_fr: 'Très mince' },
  { zone: 'optimal',   min: 0.43, max: 0.50, label_fr: 'Sain' },
  { zone: 'good',      min: 0.50, max: 0.53, label_fr: 'Surpoids débutant' },
  { zone: 'average',   min: 0.53, max: 0.58, label_fr: 'Surpoids' },
  { zone: 'poor',      min: 0.58, max: 0.63, label_fr: 'Obésité modérée' },
  { zone: 'high_risk', min: 0.63, max: null, label_fr: 'Obésité sévère' },
]

const WAIST_HEIGHT_REFERENCE: NormReference = {
  source: 'Ashwell & Hsieh, Nutr Res Rev, 2005 — DOI: 10.1079/NRR200498',
  doi: '10.1079/NRR200498',
  methodology: "Revue de 28 études internationales validant le seuil RTH 0.5 comme prédicteur universel du risque cardio-métabolique, indépendant du sexe, de l'âge et de l'origine ethnique.",
}

const WAIST_HEIGHT_INSIGHTS: ZoneInsights = {
  optimal: "Ratio taille/hauteur optimal (< 0.5) — votre taille abdominale est bien proportionnée à votre hauteur. Fortement protecteur contre les maladies cardiovasculaires et métaboliques.",
  good: "Ratio taille/hauteur légèrement au-dessus de 0.5. Un début d'adiposité abdominale relative à votre taille. Sans risque majeur, mais à surveiller.",
  average: "Ratio taille/hauteur modérément élevé. Signale un excès d'adiposité abdominale relative à la taille — prédicteur plus sensible que le BMI seul.",
  poor: "Ratio taille/hauteur élevé. L'adiposité abdominale est disproportionnée par rapport à la taille — risque cardiovasculaire et métabolique accru.",
  high_risk: "Ratio taille/hauteur critique. Obésité abdominale sévère — risque cardiovasculaire et métabolique très élevé. Prise en charge recommandée.",
}

// ---------------------------------------------------------------------------
// Normes — 11. Âge Métabolique (metabolic_age)
// ---------------------------------------------------------------------------

// Zones basées sur le delta âge métabolique vs âge réel
// Note : les valeurs ici sont des deltas (metabolic_age - chronological_age)
// Négatif = plus jeune métaboliquement, positif = plus vieux

const METABOLIC_AGE_DELTA_RANGES: NormRange[] = [
  { zone: 'optimal',   min: null, max: -5,  label_fr: 'Métabolisme juvénile' },
  { zone: 'good',      min: -5,   max: 0,   label_fr: 'Métabolisme jeune' },
  { zone: 'average',   min: 0,    max: 5,   label_fr: 'Dans la moyenne' },
  { zone: 'poor',      min: 5,    max: 10,  label_fr: 'Métabolisme vieilli' },
  { zone: 'high_risk', min: 10,   max: null, label_fr: 'Métabolisme très vieilli' },
]

const METABOLIC_AGE_REFERENCE: NormReference = {
  source: 'Mifflin et al., Am J Clin Nutr, 1990 — DOI: 10.1093/ajcn/51.2.241 / Katch-McArdle, 1975',
  doi: '10.1093/ajcn/51.2.241',
  methodology: "BMR calculé par Katch-McArdle (si masse maigre disponible) ou Mifflin-St Jeor (1990) — comparé au BMR médian de référence par âge et sexe pour estimer l'équivalent d'âge métabolique.",
}

const METABOLIC_AGE_INSIGHTS: ZoneInsights = {
  optimal: "Âge métabolique nettement inférieur à l'âge réel. Votre métabolisme de base correspond à celui d'un individu plus jeune — signe d'une excellente composition corporelle et d'un mode de vie actif.",
  good: "Âge métabolique légèrement inférieur à l'âge réel. Bon indicateur de composition corporelle — votre métabolisme est actif et bien préservé.",
  average: "Âge métabolique proche de l'âge réel. Dans la moyenne de la population. Une amélioration de la composition corporelle (gain musculaire, réduction de masse grasse) ferait baisser cette valeur.",
  poor: "Âge métabolique supérieur à l'âge réel. Votre métabolisme de base est inférieur à la moyenne de votre tranche d'âge — souvent lié à un déficit de masse musculaire ou à une sédentarité. L'entraînement en résistance est la levier le plus efficace.",
  high_risk: "Âge métabolique très supérieur à l'âge réel. Métabolisme significativement ralenti — fortement associé à un faible ratio masse maigre/masse grasse. Une prise en charge globale (entraînement, nutrition) est recommandée.",
}

// ---------------------------------------------------------------------------
// Métadonnées par métrique
// ---------------------------------------------------------------------------

interface MetricMeta {
  label_fr: string
  unit: string
}

const METRIC_META: Record<string, MetricMeta> = {
  bmi:                  { label_fr: 'Indice de Masse Corporelle', unit: 'kg/m²' },
  body_fat_pct:         { label_fr: '% Masse Grasse',             unit: '%' },
  visceral_fat_level:   { label_fr: 'Graisse Viscérale',          unit: 'niveau (1-30)' },
  body_water_pct:       { label_fr: '% Eau Corporelle',           unit: '%' },
  muscle_mass_pct:      { label_fr: '% Masse Musculaire',         unit: '%' },
  bone_mass_kg:         { label_fr: 'Masse Osseuse',              unit: 'kg' },
  waist_cm:             { label_fr: 'Tour de Taille',             unit: 'cm' },
  waist_hip_ratio:      { label_fr: 'Ratio Taille/Hanche',        unit: 'ratio' },
  lean_mass_kg:         { label_fr: 'Masse Maigre',               unit: 'kg' },
  waist_height_ratio:   { label_fr: 'Ratio Taille/Hauteur',       unit: 'ratio' },
  metabolic_age_delta:  { label_fr: 'Âge Métabolique (delta)',    unit: 'ans' },
}

// ---------------------------------------------------------------------------
// Map insights par métrique
// ---------------------------------------------------------------------------

const INSIGHTS_MAP: Record<string, ZoneInsights> = {
  bmi:                BMI_INSIGHTS,
  body_fat_pct:       BODY_FAT_INSIGHTS,
  visceral_fat_level: VISCERAL_FAT_INSIGHTS,
  body_water_pct:     BODY_WATER_INSIGHTS,
  muscle_mass_pct:    MUSCLE_MASS_INSIGHTS,
  bone_mass_kg:       BONE_MASS_INSIGHTS,
  waist_cm:           WAIST_INSIGHTS,
  waist_hip_ratio:    WAIST_HIP_INSIGHTS,
  lean_mass_kg:       LEAN_MASS_INSIGHTS,
  waist_height_ratio: WAIST_HEIGHT_INSIGHTS,
  metabolic_age_delta: METABOLIC_AGE_INSIGHTS,
}

function resolveInsight(metric_key: string, zone: NormZone, sex: Sex): string {
  const insights = INSIGHTS_MAP[metric_key]
  if (!insights) return ''
  const entry = insights[zone]
  if (!entry) return ''
  if (typeof entry === 'string') return entry
  return entry[sex] ?? ''
}

// ---------------------------------------------------------------------------
// Résolution des ranges par métrique/sexe/âge
// ---------------------------------------------------------------------------

function getRanges(metric_key: string, sex: Sex, age: number): NormRange[] | null {
  const ag = getAgeGroup(age)
  switch (metric_key) {
    case 'bmi':
      return BMI_RANGES
    case 'body_fat_pct':
      return BODY_FAT_RANGES[sex][ag]
    case 'visceral_fat_level':
      return VISCERAL_FAT_RANGES
    case 'body_water_pct':
      return BODY_WATER_RANGES[sex][ag]
    case 'muscle_mass_pct':
      return MUSCLE_MASS_RANGES[sex][ag]
    case 'bone_mass_kg':
      return BONE_MASS_RANGES[sex]
    case 'waist_cm':
      return WAIST_RANGES[sex]
    case 'waist_hip_ratio':
      return WAIST_HIP_RANGES[sex]
    case 'lean_mass_kg':
      return LEAN_MASS_RANGES[sex][ag]
    case 'waist_height_ratio':
      return WAIST_HEIGHT_RANGES
    case 'metabolic_age_delta':
      return METABOLIC_AGE_DELTA_RANGES
    default:
      return null
  }
}

function getReference(metric_key: string): NormReference | null {
  switch (metric_key) {
    case 'bmi':                return BMI_REFERENCE
    case 'body_fat_pct':       return BODY_FAT_REFERENCE
    case 'visceral_fat_level': return VISCERAL_FAT_REFERENCE
    case 'body_water_pct':     return BODY_WATER_REFERENCE
    case 'muscle_mass_pct':    return MUSCLE_MASS_REFERENCE
    case 'bone_mass_kg':       return BONE_MASS_REFERENCE
    case 'waist_cm':           return WAIST_REFERENCE
    case 'waist_hip_ratio':    return WAIST_HIP_REFERENCE
    case 'lean_mass_kg':         return LEAN_MASS_REFERENCE
    case 'waist_height_ratio':   return WAIST_HEIGHT_REFERENCE
    case 'metabolic_age_delta':  return METABOLIC_AGE_REFERENCE
    default:                     return null
  }
}

// ---------------------------------------------------------------------------
// Fonctions publiques
// ---------------------------------------------------------------------------

export function evaluateMetric(
  metric_key: string,
  value: number,
  age: number,
  sex: Sex,
): NormEvaluation | null {
  const meta = METRIC_META[metric_key]
  if (!meta) return null

  const ranges = getRanges(metric_key, sex, age)
  if (!ranges) return null

  const reference = getReference(metric_key)
  if (!reference) return null

  const matched = findZone(value, ranges)
  if (!matched) return null

  const zone = matched.zone

  return {
    metric_key,
    label_fr: meta.label_fr,
    unit: meta.unit,
    value,
    zone,
    zone_label_fr: zoneLabelFr(zone),
    zone_color: zoneColor(zone),
    ranges,
    reference,
    zone_insight: resolveInsight(metric_key, zone, sex),
    is_critical: zone === 'high_risk',
  }
}

export function evaluateAll(
  data: {
    bmi?: number | null
    body_fat_pct?: number | null
    muscle_mass_pct?: number | null
    lean_mass_kg?: number | null
    visceral_fat_level?: number | null
    body_water_pct?: number | null
    bone_mass_kg?: number | null
    waist_cm?: number | null
    waist_hip_ratio?: number | null
    waist_height_ratio?: number | null
    // metabolic_age_estimated : valeur absolue (on calcule le delta ici)
    metabolic_age_estimated?: number | null
    // Source requise pour n'afficher l'âge métabolique que si mesuré par balance
    metabolic_age_source?: 'measured' | 'estimated_katch' | 'estimated_mifflin' | 'unavailable'
  },
  age: number,
  sex: Sex,
): NormEvaluation[] {
  const results: NormEvaluation[] = []

  // Métriques standard — évaluées directement
  const standardKeys = [
    'bmi', 'body_fat_pct', 'muscle_mass_pct', 'lean_mass_kg',
    'visceral_fat_level', 'body_water_pct', 'bone_mass_kg',
    'waist_cm', 'waist_hip_ratio', 'waist_height_ratio',
  ] as const

  for (const key of standardKeys) {
    const value = data[key as keyof typeof data]
    if (value === null || value === undefined || isNaN(value as number)) continue
    const evaluation = evaluateMetric(key, value as number, age, sex)
    if (evaluation !== null) {
      results.push(evaluation)
    }
  }

  // Âge métabolique — affiché uniquement si mesuré par balance impédancemétrique
  // Les estimations BMR (Katch-McArdle / Mifflin) ne sont pas affichées dans les normes
  if (
    data.metabolic_age_estimated !== null &&
    data.metabolic_age_estimated !== undefined &&
    !isNaN(data.metabolic_age_estimated) &&
    data.metabolic_age_source === 'measured'
  ) {
    const delta = data.metabolic_age_estimated - age
    const evaluation = evaluateMetric('metabolic_age_delta', delta, age, sex)
    if (evaluation !== null) {
      // On surcharge le label pour afficher l'âge absolu + delta
      const sign = delta >= 0 ? '+' : ''
      results.push({
        ...evaluation,
        label_fr: 'Âge Métabolique',
        unit: 'ans',
        value: data.metabolic_age_estimated,
        zone_label_fr: `${evaluation.zone_label_fr} (${sign}${delta} ans vs âge réel)`,
      })
    }
  }

  return results
}
