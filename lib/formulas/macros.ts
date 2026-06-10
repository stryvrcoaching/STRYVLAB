/**
 * Macro Calculator — Forensic Metabolic Analysis v2
 *
 * Methodology stack (peer-reviewed sources) :
 * ─ BMR       : Katch-McArdle (LBM-based) — Katch & McArdle 1975, MSSE
 *               Mifflin-St Jeor fallback — Mifflin et al. 1990, AJCN
 *               Measured BMR from impedance scale (priority)
 * ─ LBM       : Boer formula — Boer 1984, Clin Physiol
 *               Direct muscle mass from DEXA / InBody (priority)
 * ─ NEAT      : Steps × 0.0005 × BW (Hall et al. 2012, NIDDK)
 *               Occupation multiplier (Ainsworth MET compendium 2011)
 *               Work-hours correction (forced sedentarism)
 * ─ EAT       : MET-weighted by training type (Ainsworth 2011)
 *               Tracker override if delta > 20% vs table
 *               Cardio EAT computed separately (Swain & Franklin 2002)
 * ─ TEF       : 10% of BMR — Westerterp 2004, Physiol Behav
 * ─ Alcohol   : 7 kcal/g ethanol, TDEE addition (Lieber 1991, Hepatology)
 * ─ Caffeine  : Metabolic stimulant +3–5% BMR correction (Dulloo et al. 1989, AJCN)
 * ─ Menstrual : +150–200 kcal luteal phase (Webb 1986, Eur J Appl Physiol)
 * ─ Visceral  : Risk stratification — IDF 2006, Despres 2001 NEJM
 * ─ Deficit   : BF%-stratified (Helms et al. 2014, IJSNEM)
 * ─ Protein   : LBM-based — Helms 2014, Morton 2018 (Br J Sports Med)
 * ─ Fats min  : Gender-based minimum (Volek 2002, JSCR; Hamalainen 1984)
 * ─ Recovery  : Stress × sleep adaptation (Dattilo 2011, Med Hyp)
 */

import type { NutritionDataQualitySummary } from "@/lib/nutrition/dataQuality";
import {
  buildNutritionDataQualityHeadline,
  getNutritionDataConfidenceLabel,
  getNutritionDataQualityIssues,
} from "@/lib/nutrition/dataQualityPresentation";
import type { NutritionDataMode } from "@/lib/nutrition/dataGovernance";

export type MacroGoal   = 'deficit' | 'maintenance' | 'surplus';
export type MacroGender = 'male' | 'female';
export type OccupationLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export const OCCUPATION_MULTIPLIER: Record<OccupationLevel, number> = {
  sedentary: 1.00,
  light:     1.05,
  moderate:  1.10,
  active:    1.18,
};

// Training type MET coefficients — Ainsworth 2011 Compendium
const TRAINING_TYPE_MET: Record<string, number> = {
  'Musculation / Powerlifting': 5.0,
  'Haltérophilie':              5.5,
  'CrossFit / HIIT':            8.0,
  'Bodybuilding / Physique':    5.0,
  'Calisthenics':               5.0,
  'Yoga / Pilates':             3.0,
  'Sports collectifs':          7.0,
  'Arts martiaux / Boxe':       7.5,
  'Cardio modéré':              5.0,
  'Cardio intense':             8.5,
  'Natation':                   6.0,
  'Cyclisme':                   7.5,
  'Course à pied':              8.0,
  'Autre':                      5.0,
};

// Cardio type MET — for separate cardio EAT computation
const CARDIO_TYPE_MET: Record<string, number> = {
  'Course à pied':      9.0,
  'Vélo':               7.5,
  'Natation':           7.0,
  'Rameur':             7.0,
  'Elliptique':         5.5,
  'Marche rapide':      4.0,
  'HIIT cardio':       10.0,
  'Zone 2':             5.0,
  'Autre':              6.0,
};

export interface MacroInput {
  // ── Obligatoires ──────────────────────────────────────────────────────────
  weight:   number;      // kg 40–250
  height:   number;      // cm 140–220
  age:      number;      // ans 15–85
  gender:   MacroGender;
  goal:     MacroGoal;

  // ── Biométrie enrichie ───────────────────────────────────────────────────
  bodyFat?:          number;   // % BF mesuré
  muscleMassKg?:     number;   // Masse musculaire kg (DEXA/InBody priority)
  bmrKcalMeasured?:  number;   // BMR mesuré balance (1000–4000)
  visceralFatLevel?: number;   // Niveau graisse viscérale (1–20, IDF seuil ≥ 10)

  // ── Activité & NEAT ──────────────────────────────────────────────────────
  steps?:                 number;  // Pas quotidiens
  occupationMultiplier?:  number;  // 1.0–1.18 depuis occupation text
  workHoursPerWeek?:      number;  // Heures travail sédentaire/semaine

  // ── Entraînement & EAT ───────────────────────────────────────────────────
  workouts?:                number;     // Séances muscu/semaine
  sessionDurationMin?:      number;     // Durée session (min)
  trainingCaloriesWeekly?:  number;     // Kcal tracker/semaine
  trainingTypes?:           string[];   // Types d'entraînement

  // ── Cardio EAT (séparé muscu) ────────────────────────────────────────────
  cardioFrequency?:    number;    // Séances cardio/semaine
  cardioDurationMin?:  number;    // Durée cardio moy (min)
  cardioTypes?:        string[];  // Types de cardio

  // ── Bien-être & récupération ──────────────────────────────────────────────
  stressLevel?:         number;  // 1–10
  sleepDurationH?:      number;  // Heures
  sleepQuality?:        number;  // 1–5 (1=très mauvais, 5=excellent)
  energyLevel?:         number;  // 1–10
  recoveryScore?:       number;  // 1–10
  postSessionRecovery?: number;  // 1–10

  // ── Lifestyle & santé ─────────────────────────────────────────────────────
  caffeineDaily?:     number;  // mg/jour
  alcoholWeekly?:     number;  // verres standard/semaine (1 verre ≈ 14g éthanol)
  menstrualPhase?:    'follicular' | 'luteal' | 'unknown';  // femmes seulement
  dataQuality?:       NutritionDataQualitySummary | null;
  dataMode?:          NutritionDataMode;
}

export interface MacroResult {
  calories:      number;
  tdee:          number;
  tdeeGross:     number;   // TDEE avant ajustement alcool/caféine
  leanMass:      number;
  estimatedBF:   number;
  macros:        { p: number; f: number; c: number };
  ratios:        { p: number; f: number; c: number };  // g/kg LBM
  ratiosByBW:    { p: number; f: number; c: number };  // g/kg bodyweight
  percents:      { p: number; f: number; c: number };
  breakdown: {
    bmr:      number;
    neat:     number;
    eat:      number;
    eatCardio: number;
    tef:      number;
    alcohol:  number;  // kcal alcool ajoutées au TDEE
  };
  adjustment:    number;

  // ── Flags contextuels ─────────────────────────────────────────────────────
  warnings:       string[];
  contextFlags:   ContextFlag[];

  // ── Provenance data ───────────────────────────────────────────────────────
  dataProvenance: {
    bmrSource:  'measured' | 'katch-mcardle' | 'mifflin';
    lbmSource:  'measured' | 'boer' | 'body-fat';
    eatSource:  'tracker' | 'duration-met' | 'table';
    neatSource: 'steps' | 'activity-level';
    cardioEatSource: 'duration-met' | 'none';
  };

  // ── Smart Protocol suggestions ────────────────────────────────────────────
  smartProtocol: SmartProtocolSuggestion[];

  // ── Recovery adaptation ───────────────────────────────────────────────────
  recoveryAdaptation?: {
    stressLevel:              number;
    sleepDurationH:           number;
    suggestedDeficitReduction: number;
    reason:                   string;
  };

  // ── Corrections appliquées (transparence UI) ──────────────────────────────
  corrections: CorrectionApplied[];
  dataQuality?: NutritionDataQualitySummary | null;
}

export interface ContextFlag {
  type:     'warning' | 'info' | 'danger' | 'success';
  key:      string;
  label:    string;
  detail:   string;
  source?:  string;  // référence scientifique
}

export interface SmartProtocolSuggestion {
  id:          string;
  priority:    'critical' | 'high' | 'medium' | 'low';
  category:    'calories' | 'protein' | 'fats' | 'carbs' | 'timing' | 'recovery' | 'strategy';
  title:       string;
  rationale:   string;  // explication scientifique
  action:      string;  // ce que le coach doit faire concrètement
  source?:     string;
}

export interface CorrectionApplied {
  field:  string;
  label:  string;
  value:  number;
  unit:   string;
  delta:  number;  // impact sur TDEE en kcal
}

export interface MacroValidationError {
  field:   string;
  message: string;
}

export function validateMacroInputs(input: Partial<MacroInput>): MacroValidationError[] {
  const errors: MacroValidationError[] = [];
  if (!input.weight || input.weight < 40 || input.weight > 250)
    errors.push({ field: 'weight', message: 'Poids hors limites (40–250 kg)' });
  if (!input.height || input.height < 140 || input.height > 220)
    errors.push({ field: 'height', message: 'Taille hors limites (140–220 cm)' });
  if (!input.age || input.age < 15 || input.age > 85)
    errors.push({ field: 'age', message: 'Âge hors limites (15–85 ans)' });
  return errors;
}

// ─── Formules internes ────────────────────────────────────────────────────────

/** Boer 1984 — LBM estimation sans BF% */
function boerLBM(weight: number, height: number, gender: MacroGender): number {
  const lbm = gender === 'male'
    ? 0.407 * weight + 0.267 * height - 19.2
    : 0.252 * weight + 0.473 * height - 48.3;
  return Math.max(weight * 0.5, Math.min(weight * 0.95, lbm));
}

/** Katch-McArdle 1975 + décrement âge */
function katchMcArdleBMR(leanMass: number, age: number): number {
  let bmr = 370 + 21.6 * leanMass;
  if (age > 30) bmr *= (1 - Math.floor((age - 30) / 10) * 0.02);
  return bmr;
}

/** Mifflin-St Jeor 1990 — fallback sans LBM */
function mifflinBMR(weight: number, height: number, age: number, gender: MacroGender): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/** EAT musculation par MET */
function computeEATMuscu(weight: number, durationMin: number, weeklyWorkouts: number, types?: string[]): number {
  const met = types && types.length > 0
    ? types.reduce((s, t) => s + (TRAINING_TYPE_MET[t] ?? 5.0), 0) / types.length
    : 5.0;
  return (met * weight * durationMin / 60 * weeklyWorkouts) / 7;
}

/** EAT cardio séparé — Swain & Franklin 2002 */
function computeEATCardio(weight: number, durationMin: number, weeklyCardio: number, types?: string[]): number {
  const met = types && types.length > 0
    ? types.reduce((s, t) => s + (CARDIO_TYPE_MET[t] ?? 6.0), 0) / types.length
    : 6.0;
  return (met * weight * durationMin / 60 * weeklyCardio) / 7;
}

const TRAINING_TABLE: Record<number, number> = {
  0: 0, 1: 200, 2: 260, 3: 330, 4: 410, 5: 490, 6: 570, 7: 650,
};

// ─── Générateur Smart Protocol ────────────────────────────────────────────────

function buildSmartProtocol(input: MacroInput, result: Omit<MacroResult, 'smartProtocol' | 'contextFlags' | 'warnings' | 'corrections'>): SmartProtocolSuggestion[] {
  const suggestions: SmartProtocolSuggestion[] = [];
  const { goal, gender, weight } = input;
  const { estimatedBF, leanMass, macros, tdee } = result;

  // ── Stratégie calorique ────────────────────────────────────────────────────

  if (goal === 'deficit') {
    // Visceral fat élevé → déficit plus agressif recommandé
    if (input.visceralFatLevel != null && input.visceralFatLevel >= 10) {
      suggestions.push({
        id: 'visceral_aggressive_deficit',
        priority: 'critical',
        category: 'strategy',
        title: 'Graisse viscérale élevée — déficit prioritaire',
        rationale: `Niveau viscéral ${input.visceralFatLevel} ≥ 10 (seuil IDF). La graisse viscérale est un facteur de risque cardiovasculaire et métabolique indépendant. La réduction prioritaire est justifiée même si cela ralentit la prise de masse musculaire.`,
        action: `Maintenir un déficit de 20–25% jusqu\'à viscéral < 10. Prioriser cardio zone 2 (30–45 min × 3–4/sem).`,
        source: 'Despres & Lemieux, NEJM 2006',
      });
    }

    // BF% très bas → déficit dangereux
    if (estimatedBF < 8 && gender === 'male') {
      suggestions.push({
        id: 'bf_too_low_male',
        priority: 'critical',
        category: 'strategy',
        title: 'BF% critique pour un homme — réévaluer le déficit',
        rationale: `BF% < 8% chez l\'homme = zone de BF essentiel. Tout déficit calorique à ce stade risque une perte musculaire significative et un dérèglement hormonal (testostérone, cortisol).`,
        action: `Passer en maintenance ou mini-surplus (+150 kcal). Réévaluer l\'objectif.`,
        source: 'Friedl et al., JSCR 2002',
      });
    }
    if (estimatedBF < 16 && gender === 'female') {
      suggestions.push({
        id: 'bf_too_low_female',
        priority: 'critical',
        category: 'strategy',
        title: 'BF% critique pour une femme — risque hormonal',
        rationale: `BF% < 16% chez la femme peut induire une aménorrhée fonctionnelle et perturbations hormonales (RED-S syndrome).`,
        action: `Réduire le déficit à 10% max. Surveiller cycle menstruel. Envisager phase de maintenance.`,
        source: 'Mountjoy et al., Br J Sports Med 2014 (RED-S)',
      });
    }
  }

  if (goal === 'surplus') {
    const maxBF = gender === 'male' ? 18 : 28;
    if (estimatedBF > maxBF) {
      suggestions.push({
        id: 'surplus_high_bf',
        priority: 'high',
        category: 'strategy',
        title: 'BF% trop élevé pour un surplus efficace',
        rationale: `Au-dessus de ${maxBF}% BF, la sensibilité à l\'insuline diminue et le ratio prise musculaire/graisseuse se dégrade. Un surplus en situation de BF élevé favorise davantage le stockage lipidique.`,
        action: `Phase de récomposition ou mini-cut (4–8 semaines) avant le surplus.`,
        source: 'Barakat et al., Strength Cond J 2020',
      });
    }
  }

  // ── Protéines ──────────────────────────────────────────────────────────────

  const minProteinRatio = goal === 'deficit' ? 2.5 : 2.0;
  if (macros.p / leanMass < minProteinRatio) {
    suggestions.push({
      id: 'protein_low',
      priority: 'high',
      category: 'protein',
      title: 'Apport protéique insuffisant',
      rationale: `En ${goal === 'deficit' ? 'déficit' : 'maintenance/surplus'}, un ratio < ${minProteinRatio} g/kg LBM est associé à une perte musculaire accrue. L\'objectif optimal est ${goal === 'deficit' ? '2.5–3.1' : '2.0–2.5'} g/kg LBM.`,
      action: `Augmenter à ${Math.round(leanMass * (goal === 'deficit' ? 2.7 : 2.2))} g/j minimum.`,
      source: 'Helms et al., IJSNEM 2014 ; Morton et al., Br J Sports Med 2018',
    });
  }

  // Distribution protéines
  const mealsPerDay = 4; // estimation conservative
  if (macros.p / mealsPerDay < 30) {
    suggestions.push({
      id: 'protein_distribution',
      priority: 'medium',
      category: 'timing',
      title: 'Distribution protéique à optimiser',
      rationale: `La MPS (Muscle Protein Synthesis) est maximisée par des bolus de 0.4 g/kg LBM par repas (≥ 30–40g par prise selon poids). Une distribution uniforme sur 4–5 repas est supérieure à 2–3 grosses prises.`,
      action: `Répartir ${macros.p}g sur 4–5 repas : ${Math.round(macros.p / 4)}g/repas minimum.`,
      source: 'Moore et al., AJCN 2009 ; Areta et al., J Physiol 2013',
    });
  }

  // ── Lipides ───────────────────────────────────────────────────────────────

  const minFat = weight * (gender === 'female' ? 0.8 : 0.6);
  if (macros.f < minFat) {
    suggestions.push({
      id: 'fats_critical',
      priority: 'critical',
      category: 'fats',
      title: 'Lipides en zone critique',
      rationale: `Lipides < ${gender === 'female' ? '0.8' : '0.6'} g/kg PC perturbent la production hormonale (testostérone, oestrogènes) et l\'absorption des vitamines liposolubles (A, D, E, K).`,
      action: `Augmenter à ${Math.round(minFat)}g/j minimum. Sources : huile d\'olive, avocats, noix, poissons gras.`,
      source: 'Hamalainen et al., Horm Metab Res 1984 ; Volek et al., JSCR 2002',
    });
  }

  // ── Glucides ──────────────────────────────────────────────────────────────

  if ((input.workouts ?? 0) >= 4 && macros.c < weight * 2) {
    suggestions.push({
      id: 'carbs_performance',
      priority: 'medium',
      category: 'carbs',
      title: 'Glucides bas pour la fréquence d\'entraînement',
      rationale: `Avec ${input.workouts}+ séances/semaine, un apport < 2 g/kg PC compromet la resynthèse du glycogène musculaire entre les séances. Performance et récupération seront impactées.`,
      action: `Viser ≥ ${Math.round(weight * 2.5)}g/j les jours d\'entraînement (carb cycling). Réduire les jours de repos.`,
      source: 'Burke et al., J Sports Sci 2011 ; Jentjens & Jeukendrup, Sports Med 2003',
    });
  }

  // ── Alcool ────────────────────────────────────────────────────────────────

  if (input.alcoholWeekly != null && input.alcoholWeekly >= 7) {
    suggestions.push({
      id: 'alcohol_impact',
      priority: 'high',
      category: 'strategy',
      title: 'Consommation d\'alcool — impact métabolique significatif',
      rationale: `${input.alcoholWeekly} verres/semaine ≈ ${Math.round(input.alcoholWeekly * 14 * 7)} kcal/semaine. L\'alcool inhibe la MPS (−24% après ingestion), réduit la testostérone et perturbe le sommeil profond.`,
      action: `Réduire à < 4 verres/semaine idéalement. Consommer post-entraînement minimum 3h après pour minimiser l\'impact MPS.`,
      source: 'Parr et al., PLoS ONE 2014 ; Barnes et al., Med Sci Sports Exerc 2012',
    });
  }

  // ── Récupération ──────────────────────────────────────────────────────────

  const sleepH = input.sleepDurationH ?? 8;
  const stress = input.stressLevel ?? 0;
  if (sleepH < 6 && sleepH > 0) {
    suggestions.push({
      id: 'sleep_critical',
      priority: 'critical',
      category: 'recovery',
      title: 'Sommeil insuffisant — catabolisme accru',
      rationale: `< 6h de sommeil réduit la GH nocturne de 70%, élève le cortisol de 37% et diminue la testostérone. En déficit calorique, cela oriente la perte de poids vers la masse musculaire plutôt que la graisse.`,
      action: `Priorité absolue : atteindre 7–9h. Aucune optimisation nutritionnelle ne compense un déficit de sommeil chronique.`,
      source: 'Dattilo et al., Med Hypotheses 2011 ; Spiegel et al., Sleep 1999',
    });
  } else if (sleepH < 7 && sleepH > 0) {
    suggestions.push({
      id: 'sleep_suboptimal',
      priority: 'medium',
      category: 'recovery',
      title: 'Sommeil sous-optimal — ajustement recommandé',
      rationale: `6–7h de sommeil représente un déficit de récupération modéré. Réduire le déficit calorique de 5% peut compenser partiellement l\'impact catabolique.`,
      action: `Viser 7h30 minimum. En attendant, réduire le déficit de 5%.`,
      source: 'Dattilo et al., Med Hypotheses 2011',
    });
  }

  if (stress >= 8) {
    suggestions.push({
      id: 'stress_critical',
      priority: 'high',
      category: 'recovery',
      title: 'Stress chronique — cortisol élevé',
      rationale: `Stress ≥ 8/10 chronique = hypercortisolémie. Le cortisol élevé augmente la lipolyse viscérale mais aussi la dégradation musculaire (protéolyse). Le déficit calorique aggrave cet état.`,
      action: `Réduire le déficit à 10% max. Introduire des techniques de récupération (cohérence cardiaque, déload). Prioriser les glucides peri-workout pour tamponner le cortisol.`,
      source: 'Lennartsson et al., Psychoneuroendocrinology 2012',
    });
  }

  // ── Caféine ───────────────────────────────────────────────────────────────

  if (input.caffeineDaily != null && input.caffeineDaily > 400) {
    suggestions.push({
      id: 'caffeine_high',
      priority: 'low',
      category: 'recovery',
      title: 'Caféine élevée — impact sommeil et calculs',
      rationale: `${input.caffeineDaily}mg/j > 400mg recommandé. La caféine augmente le BMR de 3–5% (tolérance après 7j) et perturbe la qualité du sommeil si consommée après 14h. Le BMR mesuré peut être surestimé.`,
      action: `Limiter à 2–3mg/kg PC/j. Stopper la consommation 6–8h avant le coucher.`,
      source: 'Dulloo et al., AJCN 1989 ; Drake et al., J Clin Sleep Med 2013',
    });
  }

  // ── Cycle menstruel ───────────────────────────────────────────────────────

  if (gender === 'female' && input.menstrualPhase === 'luteal') {
    suggestions.push({
      id: 'luteal_calories',
      priority: 'medium',
      category: 'calories',
      title: 'Phase lutéale — besoins caloriques accrus',
      rationale: `En phase lutéale (J14–J28), le métabolisme de base augmente de 150–200 kcal/j sous l\'effet de la progestérone. La faim et les fringales sont normales biologiquement.`,
      action: `Augmenter les calories de 150–200 kcal/j en phase lutéale. Prioriser les glucides complexes. Ne pas interpréter la rétention d\'eau comme une prise de gras.`,
      source: 'Webb 1986, Eur J Appl Physiol ; Solomon et al., Am J Clin Nutr 1982',
    });
  }

  // Trier par priorité
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  if (input.dataQuality) {
    const { score, confidence } = input.dataQuality;
    const issues = getNutritionDataQualityIssues(
      input.dataQuality,
      input.dataMode ?? "bilan",
    );
    const headline = buildNutritionDataQualityHeadline(
      input.dataQuality,
      input.dataMode ?? "bilan",
    );
    if (score < 55) {
      suggestions.unshift({
        id: 'data_quality_low',
        priority: 'high',
        category: 'strategy',
        title: 'Base de données fragile',
        rationale: `Le moteur travaille avec une confiance ${getNutritionDataConfidenceLabel(confidence)} (${score}/100). ${headline ?? "La base de calcul doit être consolidée avant d'aller plus loin."}`,
        action: issues.length
          ? issues
              .slice(0, 2)
              .map((issue) => issue.action)
              .join(" ")
          : "Valider les données de base avant de modifier fortement le protocole.",
        source: 'STRYVR data governance',
      });

      for (const suggestion of suggestions) {
        if (suggestion.id === 'data_quality_low') continue;
        if (suggestion.priority === 'critical') {
          suggestion.priority = 'high';
        } else if (suggestion.priority === 'high') {
          suggestion.priority = 'medium';
        }
      }
    } else if (score < 75) {
      suggestions.unshift({
        id: 'data_quality_medium',
        priority: 'medium',
        category: 'strategy',
        title: 'Interprétation prudente recommandée',
        rationale: `La confiance des données est moyenne (${score}/100). ${headline ?? "Le calcul reste exploitable, avec quelques validations utiles."}`,
        action: issues.length
          ? issues
              .slice(0, 2)
              .map((issue) => issue.action)
              .join(" ")
          : "Vérifier en priorité les données héritées ou manquantes avant tout ajustement fin.",
        source: 'STRYVR data governance',
      });
    }
  }

  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return suggestions;
}

// ─── Générateur Context Flags ─────────────────────────────────────────────────

function buildContextFlags(input: MacroInput, result: Omit<MacroResult, 'smartProtocol' | 'contextFlags' | 'warnings' | 'corrections'>): ContextFlag[] {
  const flags: ContextFlag[] = [];

  // BMR source
  if (result.dataProvenance.bmrSource === 'measured') {
    flags.push({ type: 'success', key: 'bmr_measured', label: 'BMR mesuré', detail: 'BMR issu de la balance à impédance — précision maximale.' });
  } else if (result.dataProvenance.bmrSource === 'katch-mcardle') {
    flags.push({ type: 'info', key: 'bmr_estimated', label: 'BMR estimé (Katch-McArdle)', detail: 'Basé sur la masse maigre. Précision ±5–10%.' });
  } else {
    flags.push({ type: 'info', key: 'bmr_mifflin', label: 'BMR estimé (Mifflin)', detail: 'Formule poids/taille/âge. Précision ±10–15%. Compléter le bilan pour améliorer.' });
  }

  // LBM source
  if (result.dataProvenance.lbmSource === 'measured') {
    flags.push({ type: 'success', key: 'lbm_measured', label: 'Masse maigre mesurée', detail: 'Issu de DEXA/InBody — source la plus précise.' });
  } else if (result.dataProvenance.lbmSource === 'body-fat') {
    flags.push({ type: 'info', key: 'lbm_bf', label: 'LBM via BF%', detail: 'Calculé depuis le % masse grasse mesuré.' });
  } else {
    flags.push({ type: 'info', key: 'lbm_boer', label: 'LBM estimé (Boer)', detail: 'Estimation anthropométrique. Renseigner BF% ou masse musculaire pour affiner.' });
  }

  // EAT source
  if (result.dataProvenance.eatSource === 'tracker') {
    flags.push({ type: 'success', key: 'eat_tracker', label: 'EAT via tracker', detail: 'Calories d\'entraînement issues du tracker connecté — priorité sur la formule.' });
  } else if (result.dataProvenance.eatSource === 'duration-met') {
    flags.push({ type: 'info', key: 'eat_met', label: 'EAT via MET', detail: 'Calculé par durée × MET selon les types d\'entraînement.' });
  } else {
    flags.push({ type: 'info', key: 'eat_table', label: 'EAT via table', detail: 'Table standard par fréquence. Renseigner durée et tracker pour affiner.' });
  }

  // Visceral fat flag
  if (input.visceralFatLevel != null && input.visceralFatLevel >= 10) {
    flags.push({ type: 'danger', key: 'visceral_high', label: `Viscéral élevé (niv. ${input.visceralFatLevel})`, detail: 'Seuil IDF ≥ 10 = risque métabolique. Déficit prioritaire.', source: 'IDF 2006' });
  }

  // Alcool
  if (input.alcoholWeekly != null && input.alcoholWeekly > 0) {
    const kcal = Math.round(input.alcoholWeekly * 14 * 7 / 7); // kcal/jour
    flags.push({ type: 'warning', key: 'alcohol', label: `Alcool +${kcal} kcal/j`, detail: `${input.alcoholWeekly} verres/semaine = ~${kcal} kcal/j non structurées.` });
  }

  // Caféine correction
  if (input.caffeineDaily != null && input.caffeineDaily > 200) {
    const correction = Math.round(result.breakdown.bmr * 0.04);
    flags.push({ type: 'info', key: 'caffeine', label: `Caféine +${correction} kcal BMR`, detail: `${input.caffeineDaily}mg/j — correction thermogénique +4% appliquée au BMR.`, source: 'Dulloo et al. 1989' });
  }

  // Cycle menstruel
  if (input.gender === 'female' && input.menstrualPhase === 'luteal') {
    flags.push({ type: 'info', key: 'luteal', label: '+175 kcal phase lutéale', detail: 'Besoins accrus en phase lutéale (J14–J28). Progestérone ↑ métabolisme basal.', source: 'Webb 1986' });
  }

  if (input.dataQuality) {
    const { score, confidence } = input.dataQuality;
    const headline = buildNutritionDataQualityHeadline(
      input.dataQuality,
      input.dataMode ?? "bilan",
    );
    if (score < 60) {
      flags.push({
        type: 'warning',
        key: 'data_quality_low',
        label: `Confiance données ${score}/100`,
        detail: headline ?? `Base ${getNutritionDataConfidenceLabel(confidence)}. Interpréter les recommandations avec prudence.`,
        source: 'STRYVR data governance',
      });
    } else if (score < 80) {
      flags.push({
        type: 'info',
        key: 'data_quality_medium',
        label: `Confiance données ${score}/100`,
        detail: 'Quelques signaux sont hérités ou incomplets. Bon pour cadrer, moins pour affiner.',
        source: 'STRYVR data governance',
      });
    }
  }

  return flags;
}

// ─── Calcul principal ─────────────────────────────────────────────────────────

export function calculateMacros(input: MacroInput): MacroResult {
  const { weight, height, age, gender, goal } = input;
  const steps       = input.steps ?? 0;
  const weeklyMuscu = input.workouts ?? 0;

  // ── Phase 1 : LBM ──────────────────────────────────────────────────────────
  let estimatedBF: number;
  let leanMass:    number;
  let lbmSource:   MacroResult['dataProvenance']['lbmSource'];

  if (input.muscleMassKg != null && input.muscleMassKg >= weight * 0.28 && input.muscleMassKg <= weight * 0.68) {
    leanMass    = input.muscleMassKg;
    estimatedBF = Math.max(3, ((weight - leanMass) / weight) * 100);
    lbmSource   = 'measured';
  } else if (input.bodyFat != null && input.bodyFat > 0) {
    estimatedBF = input.bodyFat;
    leanMass    = weight * (1 - estimatedBF / 100);
    lbmSource   = 'body-fat';
  } else {
    leanMass    = boerLBM(weight, height, gender);
    estimatedBF = ((weight - leanMass) / weight) * 100;
    lbmSource   = 'boer';
  }

  // ── Phase 2 : BMR ──────────────────────────────────────────────────────────
  let bmr:       number;
  let bmrSource: MacroResult['dataProvenance']['bmrSource'];

  if (input.bmrKcalMeasured != null && input.bmrKcalMeasured >= 1000 && input.bmrKcalMeasured <= 4000) {
    bmr       = input.bmrKcalMeasured;
    bmrSource = 'measured';
  } else if (lbmSource !== 'boer' || (input.bodyFat != null)) {
    bmr       = katchMcArdleBMR(leanMass, age);
    bmrSource = 'katch-mcardle';
  } else {
    bmr       = mifflinBMR(weight, height, age, gender);
    bmrSource = 'mifflin';
  }

  // Correction caféine (+3% si 200–400mg, +5% si > 400mg) — Dulloo 1989
  const corrections: CorrectionApplied[] = [];
  if (input.caffeineDaily != null && input.caffeineDaily > 200) {
    const cafFactor = input.caffeineDaily > 400 ? 0.05 : 0.03;
    const delta     = Math.round(bmr * cafFactor);
    bmr            += delta;
    corrections.push({ field: 'caffeine', label: 'Correction caféine', value: input.caffeineDaily, unit: 'mg', delta });
  }

  // ── Phase 3 : NEAT ─────────────────────────────────────────────────────────
  let neatBase = steps > 0 ? steps * 0.0005 * weight : 0;
  const neatSource: MacroResult['dataProvenance']['neatSource'] = steps > 0 ? 'steps' : 'activity-level';

  // Multiplicateur occupation
  const neatMult = input.occupationMultiplier ?? 1.0;
  neatBase      *= neatMult;

  // Correction heures de travail sédentaire (> 45h/sem → NEAT réduit 5%)
  if (input.workHoursPerWeek != null && input.workHoursPerWeek > 45 && steps === 0) {
    neatBase *= 0.95;
  }

  const neat = neatBase;

  // ── Phase 4 : EAT muscu ────────────────────────────────────────────────────
  let eatMuscu:    number;
  let eatSource:   MacroResult['dataProvenance']['eatSource'];
  const tableEAT = TRAINING_TABLE[Math.min(Math.floor(weeklyMuscu), 7)] ?? 330;

  if (input.trainingCaloriesWeekly != null && input.trainingCaloriesWeekly > 0) {
    const trackerPerDay = input.trainingCaloriesWeekly / 7;
    const delta         = Math.abs(trackerPerDay - tableEAT) / Math.max(tableEAT, 1);
    eatMuscu  = delta > 0.20 ? trackerPerDay : tableEAT;
    eatSource = delta > 0.20 ? 'tracker' : 'table';
  } else if (input.sessionDurationMin != null && input.sessionDurationMin > 0 && weeklyMuscu > 0) {
    eatMuscu  = computeEATMuscu(weight, input.sessionDurationMin, weeklyMuscu, input.trainingTypes);
    eatSource = 'duration-met';
  } else {
    eatMuscu  = tableEAT;
    eatSource = 'table';
  }

  // ── Phase 4b : EAT cardio séparé ──────────────────────────────────────────
  let eatCardio    = 0;
  let cardioEatSrc: MacroResult['dataProvenance']['cardioEatSource'] = 'none';

  if (input.cardioFrequency != null && input.cardioFrequency > 0 && input.cardioDurationMin != null && input.cardioDurationMin > 0) {
    eatCardio    = computeEATCardio(weight, input.cardioDurationMin, input.cardioFrequency, input.cardioTypes);
    cardioEatSrc = 'duration-met';
  }

  const eat = eatMuscu + eatCardio;

  // ── Phase 5 : TEF & Alcool ────────────────────────────────────────────────
  const tef = bmr * 0.10;

  // Alcool — 14g éthanol × 7 kcal/g par verre standard — Lieber 1991
  let alcoholKcalPerDay = 0;
  if (input.alcoholWeekly != null && input.alcoholWeekly > 0) {
    alcoholKcalPerDay = Math.round(input.alcoholWeekly * 14 * 7 / 7);
    corrections.push({ field: 'alcohol', label: 'Alcool', value: input.alcoholWeekly, unit: 'verres/sem', delta: alcoholKcalPerDay });
  }

  // Phase lutéale +175 kcal — Webb 1986
  let menstrualDelta = 0;
  if (gender === 'female' && input.menstrualPhase === 'luteal') {
    menstrualDelta = 175;
    corrections.push({ field: 'menstrual', label: 'Phase lutéale', value: 175, unit: 'kcal', delta: 175 });
  }

  const tdeeGross = Math.round(bmr + neat + eat + tef);
  const tdee      = Math.round(tdeeGross + alcoholKcalPerDay + menstrualDelta);

  // ── Phase 6 : Ajustement calorique ────────────────────────────────────────
  let surplusOrDeficit = 0;

  if (goal === 'deficit') {
    // BF-stratifié — Helms 2014
    let deficitFactor =
      estimatedBF > 30 ? 0.30 :
      estimatedBF > 25 ? 0.25 :
      estimatedBF > 20 ? 0.20 :
      estimatedBF > 15 ? 0.15 : 0.12;

    // Volume élevé → réduire déficit
    if (weeklyMuscu >= 5) deficitFactor = Math.max(0.10, deficitFactor - 0.03);

    // Viscéral élevé → permettre déficit plus agressif (plafonné à 30%)
    if (input.visceralFatLevel != null && input.visceralFatLevel >= 13) {
      deficitFactor = Math.min(0.30, deficitFactor + 0.05);
    }

    surplusOrDeficit = -Math.round(tdee * deficitFactor);

  } else if (goal === 'surplus') {
    surplusOrDeficit =
      estimatedBF < 10 ? 250 :
      estimatedBF < 13 ? 200 :
      estimatedBF < 16 ? 165 :
      estimatedBF < 20 ? 130 : 100;
  }

  const targetCalories = tdee + surplusOrDeficit;

  // ── Phase 7 : Macros ──────────────────────────────────────────────────────
  // Protéines — Helms 2014, Morton 2018
  const proteinMult =
    goal === 'deficit'     ? (estimatedBF > 20 ? 2.5 : 2.8) :
    goal === 'surplus'     ? 2.2 : 2.0;
  const protein = Math.round(leanMass * proteinMult);

  // Lipides minimum — gender-based + goal modulation
  const fatMinMult = gender === 'female' ? 0.9 : 0.7;
  const fatPct     = goal === 'surplus'  ? 0.22 : 0.25;
  const fats       = Math.round(Math.max(weight * fatMinMult, (targetCalories * fatPct) / 9));

  const carbs = Math.max(0, Math.round((targetCalories - protein * 4 - fats * 9) / 4));

  // ── Phase 8 : Warnings simples ────────────────────────────────────────────
  const warnings: string[] = [];
  if (protein < leanMass * 1.8)
    warnings.push('⚠️ Protéines sous 1.8g/kg LBM : risque catabolisme.');
  if (fats < weight * (gender === 'female' ? 0.6 : 0.5))
    warnings.push('⚠️ Lipides critiques : dérèglement hormonal possible.');
  if (weeklyMuscu >= 4 && carbs < weight * 2)
    warnings.push('⚠️ Glucides bas : performance et récupération compromises.');
  if (goal === 'surplus' && estimatedBF > (gender === 'male' ? 18 : 28))
    warnings.push('⚠️ BF% élevé : cut recommandé avant surplus.');

  // ── Phase 9 : Recovery adaptation ────────────────────────────────────────
  let recoveryAdaptation: MacroResult['recoveryAdaptation'] = undefined;
  if (goal === 'deficit') {
    const stress    = input.stressLevel   ?? 0;
    const sleep     = input.sleepDurationH ?? 99;
    const highStress = stress >= 7;
    const poorSleep  = sleep <= 6 && sleep > 0;

    if (highStress || poorSleep) {
      let reduction   = 0;
      const reasons: string[] = [];
      if (highStress) { reduction += stress >= 9 ? 3 : 2; reasons.push(`stress élevé (${stress}/10)`); }
      if (poorSleep)  { reduction += sleep <= 5  ? 3 : 2; reasons.push(`sommeil insuffisant (${sleep}h)`); }
      reduction = Math.min(reduction, 5);
      recoveryAdaptation = {
        stressLevel:              stress,
        sleepDurationH:           sleep,
        suggestedDeficitReduction: reduction,
        reason:                   reasons.join(' + '),
      };
    }
  }

  // ── Ratios ────────────────────────────────────────────────────────────────
  const totalKcal = protein * 4 + fats * 9 + carbs * 4;

  const partialResult = {
    calories:    targetCalories,
    tdee,
    tdeeGross,
    leanMass:    Math.round(leanMass * 10) / 10,
    estimatedBF: Math.round(estimatedBF * 10) / 10,
    macros:      { p: protein, f: fats, c: carbs },
    ratios: {
      p: Math.round((protein / leanMass) * 10) / 10,
      f: Math.round((fats / weight)      * 10) / 10,
      c: Math.round((carbs / weight)     * 10) / 10,
    },
    ratiosByBW: {
      p: Math.round((protein / weight) * 10) / 10,
      f: Math.round((fats    / weight) * 10) / 10,
      c: Math.round((carbs   / weight) * 10) / 10,
    },
    percents: {
      p: Math.round((protein * 4 / totalKcal) * 100),
      f: Math.round((fats    * 9 / totalKcal) * 100),
      c: Math.round((carbs   * 4 / totalKcal) * 100),
    },
    breakdown: {
      bmr:       Math.round(bmr),
      neat:      Math.round(neat),
      eat:       Math.round(eatMuscu),
      eatCardio: Math.round(eatCardio),
      tef:       Math.round(tef),
      alcohol:   Math.round(alcoholKcalPerDay),
    },
    adjustment:         surplusOrDeficit,
    dataProvenance:     { bmrSource, lbmSource, eatSource, neatSource, cardioEatSource: cardioEatSrc },
    recoveryAdaptation,
    corrections,
    dataQuality: input.dataQuality ?? null,
  };

  const smartProtocol = buildSmartProtocol(input, partialResult);
  const contextFlags  = buildContextFlags(input, partialResult);

  return {
    ...partialResult,
    warnings,
    contextFlags,
    smartProtocol,
  };
}

/**
 * Returns the default calorieAdjustPct (% vs TDEE) for a given goal.
 * Mirrors BF-stratified deficit logic from calculateMacros.
 * Used to auto-move the calorie slider when coach clicks a goal button.
 */
export function computeSmartPreset(
  goal: MacroGoal,
  bodyFat: number | null,
  weeklyFrequency: number,
): number {
  if (goal === 'maintenance') return 0
  const bf = bodyFat ?? 20
  if (goal === 'deficit') {
    let pct =
      bf > 30 ? -30 :
      bf > 25 ? -25 :
      bf > 20 ? -20 :
      bf > 15 ? -15 : -12
    if (weeklyFrequency >= 5) pct = Math.min(-10, pct + 3)
    return pct
  }
  // surplus — expressed as % (approximates fixed-kcal presets at typical TDEE)
  return bf < 10 ? 10 : bf < 13 ? 8 : bf < 16 ? 7 : bf < 20 ? 5 : 4
}
