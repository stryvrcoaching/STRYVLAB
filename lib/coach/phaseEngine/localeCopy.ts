import type {
  ConstraintFlag,
  EnergeticDirection,
  AdaptiveState,
  RecommendationHorizon,
} from './types'

export type PhaseEngineLocale = 'fr' | 'en'

export interface PhaseEngineCopyBundle {
  reasonMap: Record<ConstraintFlag, string>
  urgencyLabels: Record<'low' | 'medium' | 'high', string>
  overrideTraceLabel: string
  horizonLabels: Record<RecommendationHorizon, string>
  directionLabels: Record<EnergeticDirection, string>
  adaptiveStateLabels: Record<AdaptiveState, string>
  dataQualityLabels: Record<string, string>
  alertMessages: Record<ConstraintFlag, { message: string; severity: 'low' | 'medium' | 'high' }>
  fallbackReasons: {
    fatigueHigh: string
    recoveryOptimal: string
    deficitDirection: string
    surplusDirection: string
    stable: string
  }
  microCopy: {
    recoveryCrash: string
    systemicFatigue: string
    directionShift: (target: string) => string
    supercompensated: string
    recovered: string
    default: string
  }
  manualOverridePrefix: string
  quadrantLabels: {
    deficit: string
    maintenance: string
    surplus: string
    supercompensated: string
    fatigue: string
    trailLegend: string
    currentLegend: string
    recommendationLegend: string
    optimalZone: string
  }
  widgetUi: {
    title: string
    energeticDirection: string
    adaptiveState: string
    manualOverride: string
    manualOverrideActive: string
    forceRecommendation: string
    directionOptional: string
    adaptiveOptional: string
    reasonPlaceholder: string
    save: string
    reset: string
    saving: string
    saveError: string
    seeReasoning: string
    detailedAnalysis: string
    positiveFactors: string
    negativeFactors: string
    ignoredSignals: string
    conflicts: string
    phasePrefs: string
    phasePrefsHint: string
    prioritizePerformance: string
    aggressiveCutTolerance: string
    preferredBulkAggressiveness: string
    resetPrefsToGoal: string
    localeFr: string
    localeEn: string
  }
}

const FR: PhaseEngineCopyBundle = {
  reasonMap: {
    recovery_bottleneck: 'Récupération insuffisante — réduire le déficit avant relance',
    catabolic_risk: 'Risque catabolique détecté — préserver la masse maigre en priorité',
    poor_adherence: 'Adhérence instable — consolider avant changement de phase',
    high_stress_load: 'Charge de stress élevée — maintenir la direction actuelle',
    possible_muscle_loss: 'Signal de perte musculaire — augmenter l\'apport protéique',
    low_energy_availability: 'Disponibilité énergétique insuffisante — risque hormonal',
    cns_overload: 'Surcharge du SNC détectée — forcer la récupération',
  },
  urgencyLabels: {
    low: 'Aucune urgence',
    medium: 'Ajustement recommandé',
    high: 'Action requise',
  },
  overrideTraceLabel: 'Réglage coach actif — recommandation remplacée',
  horizonLabels: {
    acute: '1–3 jours',
    short_term: '1–2 semaines',
    mesocycle: '4–8 semaines',
  },
  directionLabels: {
    aggressive_deficit: 'Déficit agressif',
    controlled_deficit: 'Déficit contrôlé',
    maintenance: 'Maintenance',
    controlled_surplus: 'Surplus contrôlé',
    aggressive_surplus: 'Surplus agressif',
  },
  adaptiveStateLabels: {
    recovery_crash: 'Surmenage critique',
    systemic_fatigue: 'Fatigue systémique',
    high_fatigue: 'Fatigue élevée',
    stable: 'Stable',
    recovered: 'Récupéré',
    supercompensated: 'Supercompensé',
  },
  dataQualityLabels: {
    minimal: 'Données minimales',
    limited: 'Données limitées',
    good: 'Données suffisantes',
    high: 'Données complètes',
  },
  alertMessages: {
    catabolic_risk: { message: 'Risque catabolique — préserver la masse maigre', severity: 'high' },
    recovery_bottleneck: { message: 'Récupération insuffisante', severity: 'medium' },
    possible_muscle_loss: { message: 'Signal de perte musculaire possible', severity: 'medium' },
    poor_adherence: { message: 'Adhérence instable', severity: 'low' },
    high_stress_load: { message: 'Charge de stress élevée', severity: 'medium' },
    low_energy_availability: { message: 'Disponibilité énergétique insuffisante', severity: 'high' },
    cns_overload: { message: 'Surcharge du SNC', severity: 'high' },
  },
  fallbackReasons: {
    fatigueHigh: 'Fatigue accumulée détectée — surveiller les signaux de récupération',
    recoveryOptimal: 'État de récupération optimal — fenêtre favorable pour progression',
    deficitDirection: 'Direction déficitaire maintenue — adhérence et masse maigre à surveiller',
    surplusDirection: 'Direction de surplus maintenue — surveiller la qualité du gain',
    stable: 'Profil stable — continuer la direction actuelle',
  },
  microCopy: {
    recoveryCrash: 'Semaine de décharge recommandée avant de reprendre le déficit.',
    systemicFatigue: 'Fatigue systémique — réduire l\'intensité avant tout changement de phase.',
    directionShift: (target) => `Le système recommande un déplacement progressif vers ${target}.`,
    supercompensated: 'Conditions optimales — fenêtre idéale pour initier une progression.',
    recovered: 'Récupération optimale — continuer sur la lancée actuelle.',
    default: 'Le moteur surveille l\'évolution — aucun ajustement urgent.',
  },
  manualOverridePrefix: 'Réglage manuel coach',
  quadrantLabels: {
    deficit: 'Déficit',
    maintenance: 'Maintenance',
    surplus: 'Surplus',
    supercompensated: '↑ Supercompensé',
    fatigue: '↓ Fatigue',
    trailLegend: 'Trajectoire 30j',
    currentLegend: 'État actuel',
    recommendationLegend: 'Recommandation',
    optimalZone: 'Zone optimale',
  },
  widgetUi: {
    title: 'Optimisation de phase',
    energeticDirection: 'Direction énergétique',
    adaptiveState: 'État adaptatif',
    manualOverride: 'Réglage manuel coach',
    manualOverrideActive: 'Actif',
    forceRecommendation: 'Utiliser une recommandation manuelle',
    directionOptional: 'Direction à afficher',
    adaptiveOptional: 'État à afficher',
    reasonPlaceholder: 'Pourquoi ce réglage ?',
    save: 'Enregistrer',
    reset: 'Réinitialiser',
    saving: '…',
    saveError: 'Enregistrement impossible',
    seeReasoning: 'Voir le raisonnement',
    detailedAnalysis: 'Analyse détaillée',
    positiveFactors: 'Facteurs positifs :',
    negativeFactors: 'Facteurs négatifs :',
    ignoredSignals: 'Signaux ignorés (fiabilité insuffisante) :',
    conflicts: 'Conflits',
    phasePrefs: 'Préférences de recommandation',
    phasePrefsHint: 'Affinent la lecture sans remplacer la recommandation automatique.',
    prioritizePerformance: 'Favoriser la performance',
    aggressiveCutTolerance: 'Tolérance au déficit agressif',
    preferredBulkAggressiveness: 'Tolérance au surplus',
    resetPrefsToGoal: 'Revenir aux réglages par défaut',
    localeFr: 'FR',
    localeEn: 'EN',
  },
}

const EN: PhaseEngineCopyBundle = {
  reasonMap: {
    recovery_bottleneck: 'Insufficient recovery — ease deficit before pushing again',
    catabolic_risk: 'Catabolic risk detected — protect lean mass first',
    poor_adherence: 'Unstable adherence — stabilize before changing phase',
    high_stress_load: 'High stress load — hold current direction',
    possible_muscle_loss: 'Possible muscle loss signal — increase protein intake',
    low_energy_availability: 'Low energy availability — hormonal risk',
    cns_overload: 'CNS overload detected — prioritize recovery',
  },
  urgencyLabels: {
    low: 'No urgency',
    medium: 'Adjustment recommended',
    high: 'Action required',
  },
  overrideTraceLabel: 'Coach override active — recommendation replaced',
  horizonLabels: {
    acute: '1–3 days',
    short_term: '1–2 weeks',
    mesocycle: '4–8 weeks',
  },
  directionLabels: {
    aggressive_deficit: 'Aggressive deficit',
    controlled_deficit: 'Controlled deficit',
    maintenance: 'Maintenance',
    controlled_surplus: 'Controlled surplus',
    aggressive_surplus: 'Aggressive surplus',
  },
  adaptiveStateLabels: {
    recovery_crash: 'Critical overreach',
    systemic_fatigue: 'Systemic fatigue',
    high_fatigue: 'High fatigue',
    stable: 'Stable',
    recovered: 'Recovered',
    supercompensated: 'Supercompensated',
  },
  dataQualityLabels: {
    minimal: 'Minimal data',
    limited: 'Limited data',
    good: 'Sufficient data',
    high: 'Complete data',
  },
  alertMessages: {
    catabolic_risk: { message: 'Catabolic risk — preserve lean mass', severity: 'high' },
    recovery_bottleneck: { message: 'Insufficient recovery', severity: 'medium' },
    possible_muscle_loss: { message: 'Possible muscle loss signal', severity: 'medium' },
    poor_adherence: { message: 'Unstable adherence', severity: 'low' },
    high_stress_load: { message: 'High stress load', severity: 'medium' },
    low_energy_availability: { message: 'Low energy availability', severity: 'high' },
    cns_overload: { message: 'CNS overload detected', severity: 'high' },
  },
  fallbackReasons: {
    fatigueHigh: 'Accumulated fatigue — monitor recovery signals',
    recoveryOptimal: 'Strong recovery — favorable window for progression',
    deficitDirection: 'Deficit direction held — watch adherence and lean mass',
    surplusDirection: 'Surplus direction held — watch gain quality',
    stable: 'Stable profile — continue current direction',
  },
  microCopy: {
    recoveryCrash: 'Deload week recommended before resuming deficit work.',
    systemicFatigue: 'Systemic fatigue — reduce intensity before any phase change.',
    directionShift: (target) => `The engine recommends a gradual shift toward ${target}.`,
    supercompensated: 'Optimal conditions — ideal window to initiate progression.',
    recovered: 'Strong recovery — stay on the current momentum.',
    default: 'The engine is monitoring — no urgent adjustment.',
  },
  manualOverridePrefix: 'Coach manual adjustment',
  quadrantLabels: {
    deficit: 'Deficit',
    maintenance: 'Maintenance',
    surplus: 'Surplus',
    supercompensated: '↑ Supercompensated',
    fatigue: '↓ Fatigue',
    trailLegend: '30d trail',
    currentLegend: 'Current state',
    recommendationLegend: 'Recommendation',
    optimalZone: 'Optimal zone',
  },
  widgetUi: {
    title: 'Phase optimization',
    energeticDirection: 'Energetic direction',
    adaptiveState: 'Adaptive state',
    manualOverride: 'Coach manual override',
    manualOverrideActive: 'Active',
    forceRecommendation: 'Force displayed recommendation',
    directionOptional: 'Direction (optional)',
    adaptiveOptional: 'Adaptive state (optional)',
    reasonPlaceholder: 'Note for client or team (optional)',
    save: 'Save',
    reset: 'Reset',
    saving: '…',
    saveError: 'Could not save',
    seeReasoning: 'View reasoning',
    detailedAnalysis: 'Detailed analysis',
    positiveFactors: 'Positive factors:',
    negativeFactors: 'Negative factors:',
    ignoredSignals: 'Ignored signals (low reliability):',
    conflicts: 'Conflicts',
    phasePrefs: 'Engine preferences',
    phasePrefsHint: 'Fine-tune recommendations without a manual override.',
    prioritizePerformance: 'Prioritize performance',
    aggressiveCutTolerance: 'Aggressive cut tolerance',
    preferredBulkAggressiveness: 'Preferred bulk aggressiveness',
    resetPrefsToGoal: 'Reset to goal defaults',
    localeFr: 'FR',
    localeEn: 'EN',
  },
}

const BUNDLES: Record<PhaseEngineLocale, PhaseEngineCopyBundle> = { fr: FR, en: EN }

export function getPhaseEngineCopy(locale: PhaseEngineLocale = 'fr'): PhaseEngineCopyBundle {
  return BUNDLES[locale] ?? BUNDLES.fr
}

export function parsePhaseEngineLocale(raw: string | null | undefined): PhaseEngineLocale {
  return raw === 'en' ? 'en' : 'fr'
}
