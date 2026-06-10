# Phase Optimization Engine — Design Spec

**Date:** 2026-05-29
**Branch:** feat/chat-first-sp1
**Status:** Approved for implementation

---

## Contexte

Refonte complète de la couche "phase de transformation" du coach dashboard. Remplace `computeOptimalPhase` + `TransformationPhaseWidget` par un moteur de pilotage physiologique 2 axes avec scoring vectoriel, reliability scoring, et quadrant 2D animé.

**Intacts (ne pas toucher) :**
- `lib/coach/transformationScore.ts` — `computeTransformationScore`, types, weights
- `components/coach/TransformationScoreWidget.tsx` — widget score composite
- Route `app/api/clients/[clientId]/transformation-score/route.ts`

**Remplacés :**
- `computeOptimalPhase` dans `transformationScore.ts` → supprimé
- `components/coach/TransformationPhaseWidget.tsx` → supprimé
- `phaseRecommendation` retiré du `TransformationScoreResult`

---

## Architecture — Fichiers

```
lib/coach/phaseEngine/
  types.ts      — tous les types du nouveau système
  signals.ts    — normalisation + reliability scoring → DerivedSignals
  engine.ts     — inference rules, scoring vectoriel → PhaseOptimizationResult
  copy.ts       — tous les textes FR (reasons, microCopy, tooltips) — jamais dans engine.ts

app/api/clients/[clientId]/phase-optimization/route.ts  — nouvelle route GET

components/coach/PhaseOptimizationWidget.tsx  — remplace TransformationPhaseWidget
```

**copy.ts** : `REASON_MAP`, `MICRO_COPY_MAP`, tooltips reliability, labels axes. Localisable, versionnable UX, testable indépendamment.

`app/coach/clients/[clientId]/profil/page.tsx` — remplacer `<TransformationPhaseWidget>` par `<PhaseOptimizationWidget>`.

---

## Section 1 — Types (`lib/coach/phaseEngine/types.ts`)

```ts
// ── Axes ──────────────────────────────────────────────────────────────────────

export type EnergeticDirection =
  | 'aggressive_deficit' | 'controlled_deficit'
  | 'maintenance'
  | 'controlled_surplus' | 'aggressive_surplus'

// État physiologique pur
export type AdaptiveState =
  | 'recovery_crash'     // urgence — déficit trop agressif / surentraînement
  | 'systemic_fatigue'   // fatigue généralisée multi-signaux
  | 'high_fatigue'       // fatigue élevée mais gérable
  | 'stable'             // baseline normale
  | 'recovered'          // récupération active bien avancée
  | 'supercompensated'   // pic adaptatif post-recharge

// Opportunité détectée (coexiste avec AdaptiveState)
export type OpportunityState =
  | 'anabolic_window'        // conditions optimales pour surplus
  | 'peak_readiness'         // performance au maximum
  | 'diet_break_candidate'   // signal fort pour pause déficit

export type ConstraintFlag =
  | 'low_energy_availability'
  | 'poor_adherence'
  | 'high_stress_load'
  | 'recovery_bottleneck'
  | 'possible_muscle_loss'
  | 'catabolic_risk'

export type RecommendationHorizon =
  | 'acute'       // 1–3 jours
  | 'short_term'  // 1–2 semaines
  | 'mesocycle'   // 4–8 semaines

export type DataQuality = 'minimal' | 'limited' | 'good' | 'high'

// ── Signal metadata ───────────────────────────────────────────────────────────

export interface SignalValue {
  value: number
  observed: boolean           // true = donnée directe, false = inféré
  confidence: number          // 0–1
  sourceReliability?: number  // 0–1 — poids par provenance (dexa > bioimpedance > manual > wearable)
}

// ── Raw input ─────────────────────────────────────────────────────────────────

export interface RawSignalInput {
  // Body composition — bilans assessment
  weightSeries:   { date: string; value: number; source?: 'manual' | 'wearable'; capturedAt?: string }[]
  bodyFatSeries:  { date: string; value: number; source?: 'dexa' | 'bioimpedance' | 'manual'; capturedAt?: string }[]
  leanMassSeries: { date: string; value: number; capturedAt?: string }[]
  waistSeries:    { date: string; value: number; capturedAt?: string }[]  // optionnel

  // Recovery — check-ins
  checkin: {
    energy?: number | null          // 1–5
    sleep_quality?: number | null   // 1–5
    sleep_duration?: number | null  // heures
    stress?: number | null          // 1–5 (5 = très stressé)
    muscle_soreness?: number | null // 1–5 (5 = très courbaturé)
    hunger?: number | null          // 1–5, optionnel
    steps?: number | null           // optionnel (futur check-in soir)
  }
  checkinResponseRate: number  // 0–100

  // Performance — session logs
  performance: {
    exercises: {
      completion_rate: number
      avg_rir: number | null
      overloads_last_4_weeks: number
      stagnation: boolean
      overreaching: boolean
    }[]
    global_overreaching: boolean
    sessionsCount: number
    weeklyFrequency: number
  }

  latestBodyFat: number | null
  gender: 'male' | 'female' | null
  windowDays: number  // flexible (7, 14, 30, custom mesocycle)
}

// ── Derived signals ───────────────────────────────────────────────────────────

export interface DerivedSignals {
  // Tendances continues
  weightTrend: SignalValue          // kg/semaine, négatif = perte
  waistTrend: SignalValue | null    // cm/semaine, null si données absentes
  performanceTrend: SignalValue     // -1 → +1
  recoveryTrend: SignalValue        // -1 → +1

  // Probabilités inférées
  probableMuscleGain: SignalValue
  probableFatGain: SignalValue
  catabolicRisk: SignalValue        // 0–1
  anabolicPotential: SignalValue    // 0–1

  // Indices synthétiques
  fatigueIndex: SignalValue         // 0–1
  recoveryCapacity: SignalValue     // 0–1
  physiologicalStressScore: number  // 0–1 score central — driver principal transitions

  // Reliability dissociée
  dataCoverage: number              // 0–1 quantité signaux disponibles
  dataReliability: number           // 0–1 qualité/fiabilité signaux présents
  dataQuality: DataQuality
}

// ── Coach preferences ─────────────────────────────────────────────────────────

export interface CoachPhasePreferences {
  prioritizePerformance: boolean
  aggressiveCutTolerance: number      // 0–1
  preferredBulkAggressiveness: number // 0–1
}

// ── Engine output ─────────────────────────────────────────────────────────────

export interface PhaseAlert {
  flag: ConstraintFlag
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface PhaseOptimizationResult {
  currentState: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    opportunityStates: OpportunityState[]
    directionScore: number          // -1 → +1
    adaptiveScore: number           // -1 → +1 (0 = optimal, extrêmes = risqués)
    directionConfidence: number     // 0–1
    adaptiveConfidence: number      // 0–1
  }

  recommendedAdjustment: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    directionScore: number
    adaptiveScore: number
    urgency: 'low' | 'medium' | 'high'
    horizon: RecommendationHorizon
    recommendationConfidence: number  // 0–1, peut différer de la confiance état
  }

  confidence: number             // 0–1 global, influencé par dataReliability + conflictSeverity
  constraintFlags: ConstraintFlag[]
  reasons: string[]              // 2–3 bullets FR
  microCopy: string              // 1 phrase courte pour verbalisation immédiate (FR)
  alerts: PhaseAlert[]

  decisionTrace: {
    positiveFactors: string[]
    negativeFactors: string[]
    ignoredSignals: string[]       // reliability < MIN_VIABLE_CONFIDENCE
    conflictingSignals: string[]
    conflictSeverity: number       // 0–1, réduit confidence globale
  }

  dataQuality: DataQuality
  insufficientData: boolean

  // Futur — prévu dans l'architecture, non implémenté v1
  manualOverride?: {
    active: boolean
    direction?: EnergeticDirection
    adaptiveState?: AdaptiveState
    reason?: string
  }

  engineMetadata: {
    engineVersion: string   // ex: 'v1'
    evaluatedAt: string     // ISO timestamp
  }
}
```

---

## Section 2 — signals.ts (`lib/coach/phaseEngine/signals.ts`)

**Principe** : fonction pure, déterministe, stateless. Zéro logique phase, zéro string UI.

### Pipeline interne

```
normalizeBodyCompositionSignals(input)  →  BodyCompNorm
normalizePerformanceSignals(input)      →  PerfNorm
normalizeRecoverySignals(input)         →  RecoveryNorm
normalizeBehaviorSignals(input)         →  BehaviorNorm
         ↓
computeReliability(norms, input)        →  ReliabilityMap
         ↓
computeDerivedSignals(norms, reliability) →  DerivedSignals
         ↓
export buildDerivedSignals(input)       →  DerivedSignals
```

### Normalisation

**`normalizeBodyCompositionSignals`**
- Trend slope linéaire sur `weightSeries` (min 2 points, EMA si ≥ 4 points)
- Idem `bodyFatSeries` / `leanMassSeries` / `waistSeries`
- Outlier filter : écarter valeurs > 2.5σ
- Signal decay : pondération temporelle — mesures vieilles décroissent (demi-vie ~30j)
- Output : slopes + confidence basée sur nb points, variance, fraîcheur, source

**`normalizePerformanceSignals`**
- completion_rate moyen, overload density (overloads / sessions)
- RIR trend (bas = proche échec = haute intensité)
- Stagnation ratio — trend -1→+1 par régression linéaire

**`normalizeRecoverySignals`**
- EMA sur energy / sleep / stress / soreness
- Stress et soreness inversés (5 = mauvais → 0)
- Score composite 0–1, trend sur window

**`normalizeBehaviorSignals`**
- checkinResponseRate normalisé, sessionsCompletedRate vs weeklyFrequency
- Steps si présents (futur)

### Reliability scoring

```ts
// Facteurs par signal :
// - fréquence mesures : < 2 pts → 0.2 | 2–4 → 0.5 | 5+ → 0.8–1.0
// - fraîcheur : dernière mesure > 14j → pénalité -0.3
// - variance excessive : CoV > 20% → pénalité -0.2
// - source quality : 'dexa' → +0.2 | 'wearable' → +0.0 | 'manual' → +0.0
// - signal decay : intégré dans le poids temporel
//
// MIN_VIABLE_CONFIDENCE = 0.2
// Tout signal sous ce seuil → ignoré, ajouté à decisionTrace.ignoredSignals
```

`dataCoverage` = ratio signaux présents / signaux attendus totaux
`dataReliability` = moyenne pondérée des reliability scores par signal
`dataQuality` : `minimal` si coverage < 0.3 | `limited` < 0.5 | `good` < 0.75 | `high` ≥ 0.75

### Formules DerivedSignals

```ts
fatigueIndex = clamp(
  (1 - recoveryScore) * 0.6 + (global_overreaching ? 1 : 0) * 0.4
)

recoveryCapacity = clamp(
  recoveryScore * 0.5 + adherenceScore * 0.3 + sleepScore * 0.2
)

catabolicRisk = clamp(
  weightLossTooFast * 0.3 + leanMassDropping * 0.4 + fatigueIndex * 0.3
)

anabolicPotential = clamp(
  recoveryCapacity * 0.4 + performanceTrend_norm * 0.3 + adherenceScore * 0.3
)

physiologicalStressScore = clamp(
  fatigueIndex * 0.35 + catabolicRisk * 0.35 + (1 - recoveryCapacity) * 0.30
)
```

Tous les SignalValue produits : `{ value, observed, confidence }` — `observed: false` pour les valeurs inférées.

---

## Section 3 — engine.ts (`lib/coach/phaseEngine/engine.ts`)

**Principe** : scoring vectoriel majoritaire. Hard rules = safety gates uniquement. Pas de cascade de conditions multiples.

### Versioning moteur

```ts
export const ENGINE_VERSION = 'v1'

export const ENGINE_THRESHOLDS_V1 = {
  MIN_VIABLE_CONFIDENCE: 0.2,
  AGGRESSIVE_DIRECTION_MIN_QUALITY: 'good' as DataQuality,
  RECOVERY_CRASH_STRESS_THRESHOLD: 0.85,
  CATABOLIC_FORCE_MAINTENANCE: 0.70,
  HYSTERESIS_BUFFER: 0.05,
  CONFLICT_SEVERITY_CONFIDENCE_CAP: 0.60,
} as const

// Alias actif — pointer ici pour changer de version
export const ENGINE_THRESHOLDS = ENGINE_THRESHOLDS_V1
```

Permet A/B testing, rollback, comparaison comportement entre versions.
```

### Pipeline interne

```
scoreEnergeticDirection(signals, prefs?)  →  { score: number, confidence: number }
scoreAdaptiveState(signals)               →  { score: number, confidence: number }
detectOpportunities(signals, dir, adapt)  →  OpportunityState[]
detectConstraints(signals)                →  ConstraintFlag[]
buildRecommendation(current, signals, prefs?) → recommendedAdjustment
buildDecisionTrace(signals, scores)       →  decisionTrace
buildReasons(flags, signals)              →  string[]
buildMicroCopy(current, recommended)      →  string
export computePhaseOptimization(signals, ctx?) → PhaseOptimizationResult
```

### scoreEnergeticDirection

Score continu -1→+1 :

```ts
score =
  anabolicPotential.value * 0.30 +
  performanceTrend.value  * 0.25 +
  (1 - catabolicRisk.value) * 0.20 +
  leanMassTrend_norm      * 0.15 +
  recoveryCapacity.value  * 0.10

// Ajustement body fat si reliability > 0.4 :
// BF% < seuil lean (H:10%, F:12%) → +0.3 push vers surplus
// BF% > seuil fat  (H:20%, F:28%) → -0.3 push vers déficit

// Mapping score → EnergeticDirection (avec hysteresis buffer) :
// < -0.60 → aggressive_deficit
// -0.60 → -0.20 → controlled_deficit
// -0.20 → +0.20 → maintenance
// +0.20 → +0.60 → controlled_surplus
// > +0.60 → aggressive_surplus

// Safety gate : aggressive_* bloqué si dataQuality < 'good'
// → downgrade automatique vers controlled_*
```

### scoreAdaptiveState

Score continu -1→+1 (0 = optimal, extrêmes risqués) :

```ts
score =
  -(fatigueIndex.value * 0.40) +
  -(physiologicalStressScore * 0.35) +
  (recoveryCapacity.value * 0.25 - 0.125)  // centré sur 0

// Mapping → AdaptiveState (avec hysteresis buffer) :
// < -0.75 → recovery_crash
// -0.75 → -0.45 → systemic_fatigue
// -0.45 → -0.15 → high_fatigue
// -0.15 → +0.15 → stable
// +0.15 → +0.45 → recovered
// > +0.45 → supercompensated

// Safety gate override :
// physiologicalStressScore > 0.85 → recovery_crash (ignore score continu)
```

### detectOpportunities

Règles déclaratives légères, retourne `OpportunityState[]` :

```ts
// anabolic_window :
//   direction in [controlled_surplus, aggressive_surplus]
//   && adaptiveState in [stable, recovered, supercompensated]
//   && catabolicRisk.value < 0.2

// peak_readiness :
//   adaptiveState === 'supercompensated'
//   && performanceTrend.value > 0.6
//   && fatigueIndex.value < 0.2

// diet_break_candidate :
//   direction in [controlled_deficit, aggressive_deficit]
//   && fatigueIndex.value > 0.65
//   && weightTrend stagnant (|slope| < 0.1 kg/sem) sur ≥ 3 semaines
```

### buildRecommendation

```ts
// Si currentState != optimal → recommander déplacement
// Si catabolicRisk > CATABOLIC_FORCE_MAINTENANCE → forcer maintenance minimum
//
// Horizon dérivé de urgency :
//   recovery_crash    → acute
//   high_fatigue / diet_break_candidate → short_term
//   direction change  → mesocycle
//
// recommendationConfidence = confidence * (1 - conflictSeverity * 0.4)
```

### buildDecisionTrace

```ts
// positiveFactors   : signals avec contribution score > 0.15
// negativeFactors   : signals avec contribution score < -0.15
// ignoredSignals    : reliability < MIN_VIABLE_CONFIDENCE
// conflictingSignals: paires où signal A pousse +, B pousse - sur même axe,
//                     tous deux reliability > 0.4
// conflictSeverity  : (nb paires conflictuelles / total signaux actifs) clamped 0–1
```

### Reasons & MicroCopy

Strings FR dans `copy.ts` — aucune logique IA, aucun texte dans engine.ts :

```ts
// lib/coach/phaseEngine/copy.ts
export const REASON_MAP: Record<ConstraintFlag | string, string> = {
  'recovery_bottleneck':      'Récupération insuffisante — réduire le déficit avant relance',
  'catabolic_risk':           'Risque catabolique détecté — préserver la masse maigre en priorité',
  'poor_adherence':           'Adhérence instable — consolider avant changement de phase',
  'high_stress_load':         'Charge de stress élevée — maintenir la direction actuelle',
  'possible_muscle_loss':     'Signal de perte musculaire — augmenter l\'apport protéique',
  'low_energy_availability':  'Disponibilité énergétique insuffisante — risque hormonal',
}

export const MICRO_COPY_MAP: Record<string, string> = {
  // clé = `${currentDirection}→${recommendedDirection}` ou état spécial
  'any→maintenance':           'Le système recommande un retour progressif vers la maintenance.',
  'controlled_deficit→controlled_surplus': 'Conditions optimales pour initier une prise de masse contrôlée.',
  'recovery_crash':            'Semaine de décharge recommandée avant de reprendre le déficit.',
  'stable':                    'Profil stable — continuer la direction actuelle.',
  // fallback
  'default':                   'Le moteur surveille l\'évolution — aucun ajustement urgent.',
}
```

`engine.ts` appelle `buildMicroCopy(current, recommended)` depuis `copy.ts` — zéro string hardcodée dans le moteur.

### Confidence globale

```ts
confidence =
  (directionConfidence * 0.5 + adaptiveConfidence * 0.5)
  * dataReliability
  * (1 - conflictSeverity * 0.4)
  // Capped à 0.60 si conflictSeverity > 0.5
```

---

## Section 4 — Route API (`app/api/clients/[clientId]/phase-optimization/route.ts`)

**GET** — auth coach, ownership check identique aux routes existantes.

Collecte les mêmes données que `transformation-score` route + `waistSeries` depuis bilans (`waist_cm` field_key).

Construit `RawSignalInput`, appelle `buildDerivedSignals` puis `computePhaseOptimization`, retourne `PhaseOptimizationResult` + metric cards (avgWeight, avgBF, sleepScore, avgPerformance).

`windowDays` via query param, default 30. Pas de restriction à 7|30.

---

## Section 5 — Widget UI (`components/coach/PhaseOptimizationWidget.tsx`)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  OPTIMISATION DE PHASE      [window selector] [● qualité]│
├─────────────────────────────────────────────────────────┤
│  Direction énergétique          État adaptatif          │
│  Déficit contrôlé ●●●○○         Stable ●●●●○            │
│  (confidence dots)               (confidence dots)       │
├─────────────────────────────────────────────────────────┤
│                 QUADRANT SVG 2D                          │
│  (halo elliptique centre, point actuel, point cible,    │
│   flèche animée, fond gradient radial)                  │
├─────────────────────────────────────────────────────────┤
│  "Le système recommande un retour vers la maintenance." │
│  [urgency badge]  [horizon badge]                       │
├─────────────────────────────────────────────────────────┤
│  [constraint pills]    [opportunity badges]             │
├─────────────────────────────────────────────────────────┤
│  • Récupération insuffisante — réduire le déficit       │
│  • Risque catabolique modéré détecté                    │
│  ▸ Voir le raisonnement (collapsible)                   │
├─────────────────────────────────────────────────────────┤
│  [Poids moy.]  [BF%]  [Sommeil]  [Performance]         │
└─────────────────────────────────────────────────────────┘
```

### Quadrant SVG

- `viewBox="0 0 280 200"`, responsive via container
- Axe X : `directionScore` -1→+1, labels `text-[9px] text-white/20`
- Axe Y : `adaptiveScore` -1→+1, centre = optimal (pas haut)
- Fond : gradient radial subtil depuis centre (légèrement plus clair, opacity 0.04)
- Halo elliptique optimal : `rx=40 ry=30`, `fill` vert DS `#1f8a65` opacity 0.06, `filter blur(8px)`
- Axes : `rgba(255,255,255,0.06)`

**Point actuel `●`** :
```tsx
<motion.circle
  animate={{ cx: toSvgX(directionScore), cy: toSvgY(adaptiveScore) }}
  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
  r={7}
  fill={STATE_COLORS[adaptiveState]}
/>
```

**Point cible `◎`** (spring lourd — inertie recommandation) :
```tsx
<motion.circle
  animate={{ cx: toSvgX(rec.directionScore), cy: toSvgY(rec.adaptiveScore) }}
  transition={{ type: 'spring', stiffness: 40, damping: 30, mass: 2 }}
  r={8}
  fill="none"
  stroke={urgencyColor}
  strokeWidth={1.5}
  strokeDasharray="4 3"
/>
```

**Flèche** : `motion.path` entre les deux points, visible si distance > 0.15, opacity = distance normalisée. Spring identique au point cible (inertie).

**Low-confidence compression** : si `dataQuality in ['minimal', 'limited']`, les deux points sont visuellement rapprochés vers le centre (lerp 40% vers 0,0). Le système paraît moins affirmatif.

### Adaptive state colors

```ts
const STATE_COLORS: Record<AdaptiveState, string> = {
  recovery_crash:   '#c0392b',
  systemic_fatigue: '#b0650a',
  high_fatigue:     '#8a7a2a',
  stable:           'rgba(255,255,255,0.50)',
  recovered:        '#2a6a4a',
  supercompensated: '#1f8a65',
}
```

### Reliability indicator (top-right)

```
● HIGH    → #1f8a65
● GOOD    → rgba(255,255,255,0.6)
● LIMITED → #b0650a
● MINIMAL → rgba(192,57,43,0.6) + tooltip "Données insuffisantes"
```

### Hysteresis

Label affiché mémorisé en `useRef`. Ne change que si nouveau score dépasse `threshold ± HYSTERESIS_BUFFER (0.05)`. Évite oscillation visuelle.

### Decision trace (collapsible)

`▸ Voir le raisonnement` — `positiveFactors` tinted vert/10, `negativeFactors` tinted rouge/10, `conflictingSignals` avec severity dot. Debug coach avancé. Zéro scores numériques bruts affichés.

### Metric cards

4 pills horizontales identiques au widget actuel : Poids moy. / BF% (ajout) / Sommeil / Performance.

### Animations

Framer Motion `spring` sur positions quadrant. `AnimatePresence` sur opportunity badges et constraint pills. Zéro CSS keyframes custom.

---

## Tests

```
tests/lib/phaseEngine/
  signals.test.ts  — normalisation, reliability, DerivedSignals (chaque sous-fonction)
  engine.test.ts   — scoreEnergeticDirection, scoreAdaptiveState, detectOpportunities,
                     detectConstraints, safety gates, full integration
```

Minimum 20 tests Vitest. Couvrir : données minimales, données complètes, conflits de signaux, safety gate triggers, low-confidence compression.

---

## Notes futures (pas v1)

- **Ghost trail** : historique 30j dans le quadrant — trajectoire physiologique animée. Nécessite table `phase_optimization_history` en DB.
- **Coach override** : `manualOverride` prévu dans types — UI toggle + trace. Phase 2.
- **Localisation** : `copy.ts` prêt pour i18n — ajouter `locale` param à `buildMicroCopy` / `buildReasons`.
- **Wearable sourceReliability** : DEXA=1.0, hydrostatique=0.95, plicométrie=0.75, bioimpédance=0.55, wearable=0.45, manual=0.40.

---

## Checklist livraison

- [ ] `lib/coach/phaseEngine/types.ts`
- [ ] `lib/coach/phaseEngine/copy.ts`
- [ ] `lib/coach/phaseEngine/signals.ts` + tests
- [ ] `lib/coach/phaseEngine/engine.ts` + tests
- [ ] Route `app/api/clients/[clientId]/phase-optimization/route.ts`
- [ ] `components/coach/PhaseOptimizationWidget.tsx`
- [ ] Retirer `computeOptimalPhase` de `transformationScore.ts`
- [ ] Retirer `phaseRecommendation` de `TransformationScoreResult`
- [ ] Supprimer `TransformationPhaseWidget.tsx`
- [ ] Mettre à jour `profil/page.tsx`
- [ ] `npx tsc --noEmit` — 0 erreurs
- [ ] CHANGELOG.md mis à jour
- [ ] `project-state.md` mis à jour
