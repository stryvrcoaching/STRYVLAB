# Phase Optimization v2 — Multi-Signal Phase Fit Engine

**Date:** 2026-05-31
**Status:** Proposed
**Scope:** Coach client profile → `PhaseOptimizationWidget` + `lib/coach/phaseEngine/*`

---

## Contexte

La v1 de `Phase Optimization` pilote déjà l'état du client à partir de signaux physiologiques et comportementaux, mais reste encore centrée sur un axe "récupération / performance / composition corporelle" avec un appui fort sur le `RHR` et les check-ins.

L'objectif de la v2 est de faire évoluer le moteur vers une lecture métier plus complète :

- la phase actuelle est-elle cohérente avec la réalité du client ?
- le client tolère-t-il cette phase ?
- le client adhère-t-il réellement au protocole ?
- le corps répond-il dans le sens attendu ?
- quelle direction court / moyen terme est la plus cohérente ?

Le moteur doit :

- rester utile avec peu de données
- devenir plus intelligent quand on en a plus
- afficher une recommandation et un niveau de confiance distincts
- ne jamais devenir aberrant si certaines dimensions sont absentes

---

## Principe Produit

Le moteur répond à deux questions différentes :

1. **Phase Fit Score**
   À quel point la phase actuelle est cohérente avec l'état réel du client ?

2. **Recommended Direction**
   Quelle direction faut-il maintenir, ralentir, corriger ou faire pivoter ensuite ?

Ces deux sorties doivent être accompagnées d'un :

- `Current State`
- `Target Direction`
- `Confidence Score`
- `Primary Drivers`
- `Watchouts / veto rules`

---

## Sorties Cibles

### Carte coach en un coup d'oeil

- `Phase Fit Score`: `0–100`
- `Current State`: ex. `Cut tolérable mais surveillé`
- `Recommended Direction`: ex. `Maintenir 7 jours puis réévaluer`
- `Confidence`: `0–100`
- `Why`: 1 phrase

### Interprétation coach

- `80–100`: phase très cohérente
- `60–79`: phase exploitable mais sous conditions
- `40–59`: phase incohérente ou peu soutenable
- `< 40`: phase non adaptée / correction rapide

---

## Dimensions Moteur

Le score final se construit sur 5 dimensions.

### 1. Recovery / Stress

But : savoir si le client encaisse l'état actuel.

Signaux :

- `rhrSeries`
- `sleep_duration`
- `sleep_quality`
- `energy`
- `stress`
- `muscle_soreness`
- `steps` si disponibles

Sorties dérivées :

- `recoveryCapacity`
- `fatigueIndex`
- `physiologicalStressScore`
- `rhrDelta`
- `stepLoadStability`

### 2. Training Tolerance

But : savoir si la charge de travail réelle est tolérée.

Signaux :

- `completion_rate`
- `avg_rir`
- futur `avg_rpe`
- `stagnation`
- `overreaching`
- `load_progressing`
- `sessionsCount`
- `weeklyFrequency`

Sorties dérivées :

- `performanceTrend`
- `trainingTolerance`
- `intensityMismatchRisk`
- `overreachRisk`

### 3. Nutrition Adherence

But : savoir si le client suit réellement le protocole prescrit.

Signaux :

- calories prévues vs réelles
- protéines prévues vs réelles
- hydratation prévue vs réelle
- nombre de jours loggés
- écart moyen calories
- écart moyen protéines

Sorties dérivées :

- `calorieCompliance`
- `proteinCompliance`
- `hydrationCompliance`
- `nutritionLoggingCoverage`
- `nutritionAdherence`
- `energyAvailabilityConsistency`

### 4. Body Response

But : savoir si le corps répond dans la direction attendue.

Signaux :

- `weightSeries`
- `waistSeries`
- `bodyFatSeries`
- `leanMassSeries`
- `latestBodyFat`

Sorties dérivées :

- `weightTrend`
- `waistTrend`
- `bodyFatTrend`
- `leanMassTrend`
- `bodyResponseMatch`
- `catabolicRisk`
- `fatGainRisk`
- `muscleGainSupport`

### 5. Phase Compatibility

But : relier objectif, protocole et réalité terrain.

Signaux :

- objectif client
- phase actuelle
- mode protocole nutritionnel
- jour protocole actif
- adhérence nutrition
- réponse corporelle
- tolérance récupération

Sorties dérivées :

- `phaseCompatibility`
- `phaseTolerance`
- `protocolCoherence`
- `pivotPressure`

---

## Architecture de Données

### Etat actuel

Le moteur dispose déjà de :

- `steps` dans `RawSignalInput.checkin`
- `rhrSeries`
- `avg_rir`
- `weightSeries`, `bodyFatSeries`, `leanMassSeries`, `waistSeries`
- `clientProfile`
- `progression`

### Ajouts requis

Ajouter une brique nutritionnelle explicite.

```ts
export interface RawSignalInput {
  // existant
  ...

  nutrition?: {
    target: {
      calories?: number | null
      protein_g?: number | null
      carbs_g?: number | null
      fat_g?: number | null
      hydration_ml?: number | null
    }
    actual: {
      avgCalories?: number | null
      avgProteinG?: number | null
      avgCarbsG?: number | null
      avgFatG?: number | null
      avgHydrationMl?: number | null
    }
    adherence: {
      loggedDays: number
      expectedDays: number
      calorieDeltaAvg?: number | null
      proteinDeltaAvg?: number | null
      hydrationDeltaAvg?: number | null
    }
    source: 'meal_logs' | 'protocol_only' | 'mixed' | 'none'
  }
}
```

### Nouveaux signaux dérivés

```ts
export interface DerivedSignals {
  // existant
  ...

  trainingTolerance: SignalValue
  nutritionAdherence: SignalValue
  calorieCompliance: SignalValue
  proteinCompliance: SignalValue
  hydrationCompliance: SignalValue
  bodyResponseMatch: SignalValue
  phaseCompatibility: SignalValue
  stepLoadStability?: SignalValue
  energyAvailabilityConsistency?: SignalValue
  fatGainRisk?: SignalValue
}
```

---

## Scoring

### 1. Phase Fit Score

Le score principal est calculé sur 5 dimensions.

#### Par défaut

```ts
type PhaseFitWeights = {
  recoveryStress: number
  trainingTolerance: number
  nutritionAdherence: number
  bodyResponse: number
  phaseCompatibility: number
}
```

### Weights par objectif

#### `cut`

- `bodyResponse`: `0.30`
- `nutritionAdherence`: `0.25`
- `recoveryStress`: `0.20`
- `trainingTolerance`: `0.15`
- `phaseCompatibility`: `0.10`

#### `lean_bulk`

- `trainingTolerance`: `0.25`
- `recoveryStress`: `0.25`
- `nutritionAdherence`: `0.20`
- `bodyResponse`: `0.20`
- `phaseCompatibility`: `0.10`

#### `maintenance / recomp`

- plus équilibré

### Formule

```ts
phaseFitScore =
  recoveryStress * w.recoveryStress +
  trainingTolerance * w.trainingTolerance +
  nutritionAdherence * w.nutritionAdherence +
  bodyResponse * w.bodyResponse +
  phaseCompatibility * w.phaseCompatibility
```

Puis application de :

- redistribution des poids si dimension absente
- pénalité de conflits
- pénalité de fraîcheur
- pénalité de faible adhérence de logging
- veto rules si signaux critiques

---

## Veto Rules

Les veto rules ne remplacent pas le score, elles limitent les directions possibles.

### Exemples

#### Veto déficit agressif

Si :

- `rhrDelta.isCnsOverloaded === true`
- `fatigueIndex > 0.70`
- `performanceTrend < -0.25`

Alors :

- impossible de recommander `aggressive_deficit`
- `constraintFlag += cns_overload`
- direction max = `maintenance`

#### Veto lean bulk

Si :

- `nutritionAdherence < 0.45`
- `waistTrend` monte trop vite
- `steps` très bas

Alors :

- impossible de recommander `controlled_surplus` ou `aggressive_surplus`

#### Risque catabolique

Si :

- perte de poids rapide
- tour de taille ne baisse pas assez ou baisse mais performance s'effondre
- `proteinCompliance` basse
- fatigue haute

Alors :

- `constraintFlag += catabolic_risk`
- recommandation = ralentir / maintenance / diet break

---

## Modes de Couverture

### Niveau 1 — Minimal

Signaux :

- sommeil
- énergie
- stress
- courbatures
- adhérence check-in
- quelques données performance ou poids

Sortie :

- utile mais prudente

### Niveau 2 — Solide

Signaux :

- + `RHR`
- + `steps`
- + poids / taille
- + `avg_rir`
- + vraie complétion séances

Sortie :

- recommandation exploitable en coaching courant

### Niveau 3 — Avancé

Signaux :

- + calories prévues vs réelles
- + protéines
- + hydratation
- + body fat / lean mass fiables

Sortie :

- recommandation forte
- meilleure détection des incohérences de phase

### Niveau 4 — Premium / futur

Signaux :

- + `HRV` optionnel
- + wearables
- + imports automatisés

Sortie :

- améliore la finesse et la confiance
- ne doit jamais devenir obligatoire

---

## Confiance

Le `Confidence Score` doit être affiché à part du score de phase.

Il dépend de :

- couverture multi-dimension
- fraîcheur des données
- maturité baseline `RHR`
- volume de logs nutrition
- cohérence inter-signaux
- qualité de source biométrique

### Règle métier

- données faibles : score possible, confiance basse
- données fortes et cohérentes : score + direction affirmés

Le système ne doit jamais afficher une recommandation forte avec une confiance faible sans le dire explicitement.

---

## UI

### Carte hero

Afficher :

- score
- état actuel
- cap recommandé
- horizon
- pourquoi
- confiance

### Libellés recommandés

- `Etat actuel`
- `Cap recommandé`
- `Confiance`
- `Pourquoi`
- `Signaux dominants`

Éviter :

- répétitions de "phase"
- labels ambigus
- jargon moteur non actionnable

---

## Règles Produit

1. Aucun signal n'est obligatoire.
2. Les signaux additionnels augmentent la précision, pas l'accès au moteur.
3. La recommandation doit rester prudente si les données sont partielles.
4. La direction long terme doit être cohérente avec :
   - le protocole actif
   - l'adhérence réelle
   - la réponse corporelle
   - la tolérance récupération / training
5. Le moteur doit distinguer :
   - `ce que le client fait`
   - `ce que le client tolère`
   - `ce qui fonctionne vraiment`

---

## Décision d'architecture

### Choix

Faire évoluer le moteur actuel vers un moteur `multi-signal à confiance progressive`, pas vers un moteur `RHR-centric` ni `HRV-centric`.

### Pourquoi

- robuste avec peu de données
- compatible avec coachs minimalistes et coachs data-driven
- extensible sans casser la v1
- cohérent avec l'état actuel du repo

### Anti-patterns à éviter

- rendre le `HRV` obligatoire
- baser la direction uniquement sur un seul biomarqueur
- confondre score de phase et confiance du moteur
- considérer l'absence de données comme un signal négatif absolu

---

## Roadmap

### v2.1

- intégrer `steps`
- mieux exploiter `avg_rir`
- créer `trainingTolerance`
- créer `phaseCompatibility`

### v2.2

- intégrer `nutritionAdherence`
- calories prévues vs réelles
- protéines prévues vs réelles
- hydratation prévue vs réelle

### v2.3

- affiner `Body Response Match`
- distinguer `fatGainRisk` / `catabolicRisk`
- exposer `Confidence Score` plus clairement côté UI

### v3

- `HRV` optionnel
- imports wearables
- personnalisation coach des weights et veto rules

