# MorphoPro v2 — Brief implémentation : couche biomécanique experte + suivi longitudinal

> **Destinataire** : Claude Code
> **Statut produit** : extension d'une feature existante (analyse morpho v1 déjà en prod)
> **Périmètre** : (1) upgrade du pipeline d'analyse vers un niveau expert biomécanique, (2) ajout d'un module de suivi inter-bilans, (3) data contract pour UI d'évolution.
> **Hors périmètre** : changement du modèle (on reste sur GPT-4o vision), refonte UI, écriture du frontend (le brief définit seulement le data contract).

---

## 1. Contexte & vision

### 1.1 État actuel résumé (ce qui existe déjà)

- Route `app/api/morpho/analyze/route.ts` : déclenchée depuis MorphoGallery (1–4 photos).
- Collecte contexte client : biométrie (`weight_kg`, `height_cm`, `body_fat_pct`), blessures (`metric_annotations`), profil (`goal`, `gender`, `date_of_birth`), signed URLs photos.
- Prompt construit dans `lib/morpho/buildAnalysisPrompt.ts` → GPT-4o (`detail: high`, `temperature: 0.2`, JSON mode).
- Output `MorphoAnalysisResult` : `score`, `posture_summary`, `flags`, `attention_points`, `recommendations`, `asymmetries`, `stimulus_hints`.
- Traduction asymétries → coefficients par pattern moteur dans `lib/morpho/adjustments.ts` (10 patterns, range 0.8–1.2).
- Persistance dans `morpho_analyses`.
- Consommation aval : `GET /api/clients/[clientId]/morpho/latest` → scoring programme (`applyMorphoAdjustment`, `lib/morpho/adjustments.ts:117`).

### 1.2 Limites identifiées de la v1

1. **Analyse posturale, pas biomécanique.** GPT-4o décrit ce qu'il voit (épaule plus haute, antéversion) mais ne raisonne pas en termes de **leviers, insertions, longueurs segmentaires, chaînes musculaires**.
2. **Règles segments mortes.** Les règles 3 & 4 de `adjustments.ts` (bras longs/courts) ne s'activent jamais : GPT ne retourne pas `arm_cm_l/r`, et la route ne passe pas ces valeurs.
3. **Recommandations génériques.** Les `recommendations` ne sont pas reliées au Gold Standard biomechanics DB v2.0 (12 muscle groups × 72 exercices × 22 champs incluant `morphotype_match` et `substitution_triggers`).
4. **Pas de suivi.** Chaque analyse est isolée. Aucune comparaison inter-bilans, aucune détection de progression / régression / stagnation.
5. **Pas de stratification avantage/désavantage par exercice.** Le coach reçoit des correctifs mais pas la cartographie : *pour ce client, quels mouvements sont anatomiquement avantageux, neutres, désavantageux, contre-indiqués*.

### 1.3 Vision cible (en une phrase)

MorphoPro doit produire, à partir des photos + contexte bilan, **un profil biomécanique complet du client** — leviers, morphotype segmentaire, syndromes posturaux, insertions estimées, asymétries — qui pilote (a) une liste d'exercices stratifiée par avantage biomécanique en s'appuyant sur le Gold Standard DB, et (b) un suivi longitudinal qui détecte ce qui s'améliore, ce qui régresse, et ce qui stagne entre deux bilans.

---

## 2. Architecture cible

```
┌──────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│ Photos +     │───▶│ GPT-4o (v2 prompt) │───▶│ MorphoAnalysisResult │
│ contexte     │    │ analyse bioméca    │    │   v2 (étendu)        │
└──────────────┘    └────────────────────┘    └──────────┬───────────┘
                                                         │
                          ┌──────────────────────────────┼──────────────────┐
                          ▼                              ▼                  ▼
                ┌───────────────────┐         ┌──────────────────┐  ┌──────────────┐
                │ Moteur bioméca    │         │ Stimulus         │  │ Suivi long.  │
                │ (cross Gold Std)  │         │ adjustments v2   │  │ (vs N-1)     │
                └────────┬──────────┘         └────────┬─────────┘  └──────┬───────┘
                         │                             │                   │
                         ▼                             ▼                   ▼
              exercise_recommendations         stimulus_adjustments    evolution_report
              (stratifié par avantage)         (coefficients patterns) (deltas, trends)
                         │                             │                   │
                         └──────────────┬──────────────┘                   │
                                        ▼                                  ▼
                         Programme Intelligence Engine            UI evolution (data)
```

---

## 3. Spécifications détaillées

### 3.1 Nouveau prompt système GPT-4o (v2)

**Fichier** : `lib/morpho/buildAnalysisPrompt.ts` — remplacer le bloc système.

**Rôle à injecter** :

```
Tu es un expert en biomécanique du mouvement et en analyse morphologique
appliquée à la préparation physique. Tu combines la rigueur d'un
préparateur physique de haut niveau et d'un kinésithérapeute du sport.
Tu raisonnes en leviers, insertions musculaires apparentes, longueurs
segmentaires relatives, chaînes musculaires, et syndromes posturaux
classiques (upper crossed, lower crossed, layered syndrome).

Tu n'es pas médecin : tu n'établis aucun diagnostic. Tu produis une
analyse morpho-biomécanique destinée à orienter le choix d'exercices
et de patterns moteurs, dans un cadre de coaching sportif.
```

**Axes d'analyse à imposer** (au-delà de l'analyse posturale v1, qui reste) :

1. **Estimation des proportions segmentaires** à partir de la taille connue (`height_cm` du contexte) comme référence d'échelle. Estimer en cm + ratio sur la taille :
    - `torso_cm` (manubrium → crête iliaque)
    - `arm_cm_l`, `arm_cm_r` (acromion → styloïde radiale)
    - `forearm_cm_l`, `forearm_cm_r` (olécrane → styloïde radiale)
    - `femur_cm_l`, `femur_cm_r` (grand trochanter → ligne articulaire genou)
    - `tibia_cm_l`, `tibia_cm_r` (ligne articulaire genou → malléole latérale)
    - Marqueur de confiance par segment : `low | medium | high` (selon visibilité, angle photo, vêtement).
2. **Classification du morphotype par segment** :
    - Pour chaque segment, comparaison au ratio canonique de référence pour la taille (cf. table 3.4) → label `short | average | long`.
    - Calcul du **trunk-to-femur ratio** (crucial pour squat) et du **arm-to-torso ratio** (crucial pour bench / pull).
3. **Estimation des insertions musculaires apparentes** (où le détail photo le permet, sinon `unknown`) :
    - Biceps : insertion haute / basse (longueur du ventre musculaire)
    - Triceps : longue portion développée / sous-développée
    - Mollets : insertion haute (mollets courts) / basse (mollets longs)
    - Pectoraux : insertion claviculaire vs sternale dominante
    - Trapèzes : développement supérieur vs moyen vs inférieur
    Chaque entrée : `value: 'high' | 'low' | 'balanced' | 'unknown'`, `confidence: 'low' | 'medium' | 'high'`.
4. **Chaînes musculaires & syndromes posturaux** :
    - Présence/absence de **Upper Crossed Syndrome** (épaules enroulées + tête projetée + faiblesse rhomboïdes/trapèze moyen + raideur pec/SCM).
    - Présence/absence de **Lower Crossed Syndrome** (antéversion + hyperlordose + raideur psoas/érecteurs + faiblesse abdo profonds/fessiers).
    - Évaluation **chaîne postérieure** : développement visible apparent.
    - Évaluation **chaîne croisée antérieure** vs **postérieure**.
5. **Asymétries fines** (étendre l'existant) :
    - Décalage cm épaules, hanches.
    - Différence longueur bras gauche/droite (`arm_diff_cm` → DOIT être renseigné maintenant).
    - Différence longueur jambes (visible via décalage crête iliaque + identique pieds).
    - Rotation pelvienne dans le plan transverse (visible de face).
6. **Synthèse "avantages / désavantages biomécaniques par pattern"** : pour chacun des 10 patterns moteurs (cf. liste 3.3), un verdict `advantage | neutral | disadvantage` + justification 1 ligne ancrée dans la morpho.

**Garde-fous & règles de production** (à injecter explicitement dans le prompt) :

- Ne JAMAIS poser de diagnostic médical (pas de "scoliose", utiliser "déviation latérale apparente du rachis"). Pas de "hernie", "tendinite", etc.
- Si une estimation n'est pas possible avec une confiance raisonnable → `unknown` + `confidence: 'low'`. Pas d'invention.
- Pour les segments : utiliser `height_cm` comme référence d'échelle ; si `height_cm` est `null`, marquer toutes les estimations `confidence: 'low'`.
- Output strictement JSON conforme au schéma v2 (cf. 3.2), pas de prose hors JSON.
- Tempérer : "asymétrie visible" et non "asymétrie de X cm" quand la confiance est faible.

### 3.2 Schéma `MorphoAnalysisResult` v2

**Fichier** : `lib/morpho/types.ts` (à créer si absent, sinon étendre).

```typescript
// === v1 conservé (rétrocompat) ===
export type MorphoFlag = {
  zone: 'shoulders' | 'pelvis' | 'spine' | 'knees' | 'ankles';
  severity: 'red' | 'orange' | 'green';
  label: string;
};

export type MorphoAttentionPoint = {
  priority: 1 | 2 | 3 | 4 | 5;
  zone: string;
  description: string;
};

export type MorphoRecommendation = {
  type: 'exercise' | 'correction' | 'contraindication';
  description: string;
};

// === v2 nouveaux types ===
export type Confidence = 'low' | 'medium' | 'high';

export type SegmentEstimate = {
  cm: number | null;
  ratio_to_height: number | null;     // segment_cm / height_cm
  classification: 'short' | 'average' | 'long' | 'unknown';
  confidence: Confidence;
};

export type BiomechSegments = {
  torso: SegmentEstimate;
  arm_l: SegmentEstimate;
  arm_r: SegmentEstimate;
  forearm_l: SegmentEstimate;
  forearm_r: SegmentEstimate;
  femur_l: SegmentEstimate;
  femur_r: SegmentEstimate;
  tibia_l: SegmentEstimate;
  tibia_r: SegmentEstimate;
  // ratios dérivés clés
  trunk_to_femur_ratio: number | null;     // (>1 favorable squat, <1 défavorable)
  arm_to_torso_ratio: number | null;       // (>1 défavorable bench, favorable deadlift)
};

export type MuscleInsertion = {
  muscle: 'biceps' | 'triceps' | 'calves' | 'pectorals' | 'traps';
  value: 'high' | 'low' | 'balanced' | 'unknown';
  confidence: Confidence;
  note?: string;
};

export type PosturalSyndrome = {
  name: 'upper_crossed' | 'lower_crossed' | 'layered' | 'none';
  present: boolean;
  severity: 'mild' | 'moderate' | 'marked' | null;
  markers: string[];   // signes visibles ayant motivé la conclusion
  confidence: Confidence;
};

export type MovementPattern =
  | 'horizontal_push' | 'horizontal_pull'
  | 'vertical_push'   | 'vertical_pull'
  | 'squat'           | 'hinge'
  | 'lunge'           | 'carry'
  | 'rotation'        | 'anti_rotation';

export type PatternVerdict = {
  pattern: MovementPattern;
  verdict: 'advantage' | 'neutral' | 'disadvantage';
  rationale: string;   // 1 ligne, ancrée morpho ("femurs longs + trunk court → squat barre haute défavorable")
  confidence: Confidence;
};

export type MorphoAnalysisResultV2 = {
  // v1 conservé
  score: number;
  posture_summary: string;
  flags: MorphoFlag[];
  attention_points: MorphoAttentionPoint[];
  recommendations: MorphoRecommendation[];
  asymmetries: {
    shoulder_imbalance_cm: number | null;
    arm_diff_cm: number | null;
    hip_imbalance_cm: number | null;
    leg_length_diff_cm: number | null;       // NOUVEAU
    pelvic_rotation_deg: number | null;      // NOUVEAU
    posture_notes: string;
  };
  stimulus_hints: {
    dominant_pattern: MovementPattern;
    weak_pattern: MovementPattern;
    notes: string;
  };
  // v2 nouveau
  biomech: {
    segments: BiomechSegments;
    insertions: MuscleInsertion[];
    postural_syndromes: PosturalSyndrome[];
    pattern_verdicts: PatternVerdict[];      // 10 entrées, une par pattern
    chain_assessment: {
      posterior_chain: 'underdeveloped' | 'balanced' | 'developed' | 'unknown';
      anterior_chain: 'underdeveloped' | 'balanced' | 'developed' | 'unknown';
      dominant_cross_chain: 'anterior' | 'posterior' | 'balanced' | 'unknown';
    };
  };
  meta: {
    prompt_version: 'v2';
    analyzed_at: string;
    photo_count: number;
    overall_confidence: Confidence;
  };
};
```

### 3.3 Moteur biomécanique → recommandations d'exercices

**Nouveau fichier** : `lib/morpho/biomechEngine.ts`

**Rôle** : à partir d'un `MorphoAnalysisResultV2`, produire une **liste d'exercices stratifiée** depuis le Gold Standard DB v2.0.

```typescript
export type ExerciseAdvantageLevel =
  | 'advantageous'      // mécaniquement favorable
  | 'neutral'           // sans avantage ni inconvénient
  | 'disadvantageous'   // possible mais sous-optimal
  | 'contraindicated';  // à éviter (flag rouge ou syndrome marqué)

export type ExerciseRecommendation = {
  exercise_id: string;             // FK Gold Standard DB
  muscle_group: string;
  advantage: ExerciseAdvantageLevel;
  reasoning: string;               // explication courte coach-facing
  suggested_substitution?: string; // si disadvantageous/contraindicated
  triggered_rules: string[];       // règles ayant matché
};

export function generateExerciseRecommendations(
  analysis: MorphoAnalysisResultV2,
  goldStandardDb: GoldStandardExercise[]
): ExerciseRecommendation[];
```

**Logique de matching** :

1. Pour chaque exercice de la DB, lire `substitution_triggers` (boolean JSON) et `morphotype_match`.
2. Évaluer les triggers contre le profil biomécanique du client. Exemples :
    - `requires_long_torso: true` AND `analysis.biomech.segments.torso.classification === 'short'` → `disadvantageous`.
    - `contraindicated_if_upper_crossed: true` AND syndrome upper_crossed présent avec `severity in ['moderate','marked']` → `contraindicated`.
    - `favored_if_long_arms: true` AND `arm_to_torso_ratio > 1.05` → `advantageous`.
3. Croiser avec `flags` rouges existants (`flags` zone correspondante + severity=red → contraindicated).
4. Renseigner `suggested_substitution` en lisant le champ `recommended_substitutes` de l'entrée Gold Standard.
5. Output triable par `muscle_group` puis par `advantage`.

**Important** : ce moteur **ne décide pas du volume / intensité** — c'est le rôle du Programme Intelligence Engine. Il fournit une cartographie de l'éligibilité par exercice.

### 3.4 Extension `stimulus_adjustments` v2

**Fichier** : `lib/morpho/adjustments.ts`

Activer les règles 3 & 4 (mortes en v1) en passant désormais les segments depuis le résultat GPT v2 :

```typescript
// route.ts — appel mis à jour
const adjustments = calculateStimulusAdjustments({
  arm_diff_cm: analysis.asymmetries.arm_diff_cm,
  shoulder_imbalance_cm: analysis.asymmetries.shoulder_imbalance_cm,
  arm_cm_l: analysis.biomech.segments.arm_l.cm,
  arm_cm_r: analysis.biomech.segments.arm_r.cm,
  height_cm: context.height_cm,
  // NOUVEAU
  trunk_to_femur_ratio: analysis.biomech.segments.trunk_to_femur_ratio,
  postural_syndromes: analysis.biomech.postural_syndromes,
  pattern_verdicts: analysis.biomech.pattern_verdicts,
});
```

**Nouvelles règles à ajouter** (range maintenu 0.8–1.2) :

| Règle | Condition | Effet |
|-------|-----------|-------|
| Trunk-to-femur défavorable squat | `trunk_to_femur_ratio < 0.9` | `squat` → ×0.92 |
| Trunk-to-femur favorable squat | `trunk_to_femur_ratio > 1.1` | `squat` → ×1.05 |
| Bras longs (deadlift) | `arm_to_torso_ratio > 1.05` | `hinge` → ×1.10 |
| Upper crossed modéré+ | syndrome upper_crossed `moderate`/`marked` | `vertical_push` → ×0.85, `horizontal_pull` → ×1.15 |
| Lower crossed modéré+ | syndrome lower_crossed `moderate`/`marked` | `anti_rotation` → ×1.15, `hinge` → ×0.90 (provisoire jusqu'à correction) |
| Chaîne postérieure sous-développée | `chain_assessment.posterior_chain === 'underdeveloped'` | `hinge` → ×1.10 |

**Clamp final** sur [0.8, 1.2] reste appliqué après cumul de toutes les règles.

### 3.5 Module suivi longitudinal (NOUVEAU)

**Nouveau fichier** : `lib/morpho/evolution.ts`
**Nouvelle route** : `app/api/clients/[clientId]/morpho/evolution/route.ts`

**Comportement** :

1. À chaque sauvegarde d'une nouvelle `morpho_analysis`, déclencher (post-insert, async) un calcul de comparaison avec l'analyse précédente du même client.
2. Persister le résultat dans une table `morpho_evolutions` (cf. 3.6).
3. Exposer via `GET /api/clients/[clientId]/morpho/evolution?from=...&to=...` un payload structuré pour la UI.

**Logique de comparaison** :

```typescript
export type EvolutionDelta = {
  metric: string;             // 'shoulder_imbalance_cm', 'upper_crossed_severity', etc.
  zone: string;
  previous: number | string | null;
  current: number | string | null;
  delta: number | null;       // si numérique
  trend: 'improved' | 'stable' | 'worsened' | 'new' | 'resolved' | 'inconclusive';
  significance: 'minor' | 'notable' | 'major';
  note: string;               // explication coach-facing
};

export type EvolutionReport = {
  client_id: string;
  previous_analysis_id: string;
  current_analysis_id: string;
  span_days: number;
  overall_trend: 'improving' | 'stable' | 'worsening' | 'mixed';
  score_delta: number;        // current.score - previous.score
  deltas: EvolutionDelta[];
  highlights: {
    biggest_improvement: EvolutionDelta | null;
    biggest_regression: EvolutionDelta | null;
    resolved_flags: string[];
    new_flags: string[];
  };
  pattern_verdict_changes: Array<{
    pattern: MovementPattern;
    from: PatternVerdict['verdict'];
    to: PatternVerdict['verdict'];
  }>;
};
```

**Métriques à diffuser dans `deltas`** (liste minimale, extensible) :

- `score` (numérique)
- `shoulder_imbalance_cm`, `hip_imbalance_cm`, `arm_diff_cm`, `leg_length_diff_cm`, `pelvic_rotation_deg`
- `upper_crossed_severity`, `lower_crossed_severity` (mapping severity → ordinal pour calcul de trend)
- Par pattern moteur : changement de `verdict`
- Par flag : présence / résolution / nouvelle apparition

**Heuristique `significance`** :
- Asymétries cm : delta < 0.5 cm → minor ; 0.5–1.5 → notable ; >1.5 → major.
- Syndromes : changement de niveau (mild→moderate) → notable ; saut de 2 niveaux ou résolution complète → major.
- Score : <3 pts → minor ; 3–8 → notable ; >8 → major.

**Garde-fou comparaison** : pondérer par `confidence` des deux analyses. Si l'une des deux a `overall_confidence: 'low'` sur la métrique concernée, marquer le delta `trend: 'inconclusive'`.

### 3.6 Schéma DB additions

```sql
-- Table existante morpho_analyses : ajouter colonnes
ALTER TABLE morpho_analyses
  ADD COLUMN biomech_profile JSONB,           -- analysis.biomech
  ADD COLUMN exercise_recommendations JSONB,  -- output biomechEngine
  ADD COLUMN prompt_version TEXT DEFAULT 'v1';

-- Nouvelle table
CREATE TABLE morpho_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  previous_analysis_id UUID NOT NULL REFERENCES morpho_analyses(id),
  current_analysis_id UUID NOT NULL REFERENCES morpho_analyses(id),
  report JSONB NOT NULL,                      -- EvolutionReport complet
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(previous_analysis_id, current_analysis_id)
);
CREATE INDEX idx_morpho_evolutions_client ON morpho_evolutions(client_id, created_at DESC);
```

### 3.7 Data contract pour UI d'évolution

`GET /api/clients/[clientId]/morpho/evolution-timeline` (NOUVEAU, distinct du report ponctuel) renvoie :

```typescript
{
  client_id: string,
  series: {
    score: Array<{ analyzed_at: string, value: number }>,
    shoulder_imbalance_cm: Array<{ analyzed_at: string, value: number | null, confidence: Confidence }>,
    hip_imbalance_cm: Array<{ analyzed_at: string, value: number | null, confidence: Confidence }>,
    upper_crossed_severity: Array<{ analyzed_at: string, value: 0|1|2|3 }>,  // 0=absent, 3=marked
    lower_crossed_severity: Array<{ analyzed_at: string, value: 0|1|2|3 }>,
    // ... extensible
  },
  events: Array<{                      // pour markers sur timeline
    analyzed_at: string,
    type: 'analysis' | 'flag_resolved' | 'flag_appeared' | 'pattern_changed',
    label: string,
  }>,
  last_evolution_report: EvolutionReport | null
}
```

Ce contrat est conçu pour alimenter directement des composants de graphique (courbes par métrique + markers d'événements). **Le frontend n'est pas dans ce brief** — seul le contrat l'est.

---

## 4. Plan d'implémentation séquentiel

### Phase 1 — Prompt + schéma v2 (cœur de l'upgrade)
1. Étendre `types.ts` avec les types v2 ci-dessus.
2. Réécrire `buildAnalysisPrompt.ts` pour produire le prompt système v2 (cf. 3.1).
3. Ajouter `prompt_version: 'v2'` dans la persistance.
4. Tests unitaires : injection prompt avec/sans `height_cm`, présence/absence de blessures.
5. Test E2E sur photos de référence (faire valider par Kev sur 3–5 clients).

### Phase 2 — Moteur biomécanique
6. Créer `biomechEngine.ts` (cf. 3.3).
7. Brancher sur Gold Standard DB v2.0 (lecture des `substitution_triggers` boolean JSON).
8. Étendre la route `analyze` pour générer + persister `exercise_recommendations`.
9. Exposer via nouvelle route `GET /api/clients/[clientId]/morpho/exercise-map`.

### Phase 3 — Stimulus adjustments v2
10. Étendre `adjustments.ts` avec les nouvelles règles (cf. 3.4).
11. Activer le passage des segments depuis l'analyse v2.
12. Vérifier que `applyMorphoAdjustment` (programme engine) consomme bien les nouveaux coefficients sans régression.

### Phase 4 — Suivi longitudinal
13. Migration DB : `morpho_evolutions` + colonnes additionnelles sur `morpho_analyses`.
14. Implémenter `evolution.ts` (calcul deltas + heuristique significance).
15. Hook post-insert sur `morpho_analyses` pour générer le report.
16. Routes `GET /morpho/evolution` (report ponctuel) et `GET /morpho/evolution-timeline` (data UI).

### Phase 5 — Cohérence & QA
17. Backfill : pour clients existants avec >1 analyse v1, marquer les analyses comme `v1` et NE PAS générer d'evolution report (incompatibilité schéma). Les evolution reports ne s'activent qu'à partir de la 2e analyse `v2`.
18. Documentation interne (`docs/morpho-pro-v2.md`) : schéma, exemples de payload, exemples de prompts.

---

## 5. Points d'attention & garde-fous

- **Cadre coaching, pas médical.** Aucun terme diagnostique (scoliose, hernie, tendinite…). Rester sur "déviation latérale apparente", "raideur fonctionnelle apparente", etc. Cette règle doit figurer explicitement dans le prompt système.
- **Confidence first.** Toute heuristique aval (moteur bioméca, evolution) doit dégrader gracieusement quand `confidence: 'low'`. Un delta calculé sur deux mesures peu confiantes doit retourner `trend: 'inconclusive'`, pas un faux verdict.
- **Photos imparfaites.** Vêtements amples, angles non-frontaux, éclairage : ces conditions doivent abaisser la confidence et NE doivent pas faire halluciner d'estimations cm. Le prompt impose explicitement `unknown` plutôt que deviner.
- **Cohérence Gold Standard.** Le moteur bioméca ne doit JAMAIS reformuler ou contourner les `substitution_triggers` de la DB v2.0 — il les lit et les applique. Toute nouvelle règle morpho doit d'abord être encodée comme trigger dans la DB, pas hardcodée dans `biomechEngine.ts`.
- **Limites de l'analyse photo 2D.** Pas de mesure de mobilité, pas de force, pas d'imagerie. Le brief produit une cartographie de probabilités, pas une vérité. À mentionner dans la UI (caveat coach-facing).
- **Validation scientifique.** Avant prod, faire revoir le prompt v2 et la table de règles (3.4) par Kev sur la base de la littérature (Schoenfeld, Contreras, Israetel pour patterns ; Janda pour syndromes croisés).
- **Rétrocompat.** Les analyses v1 existantes ne doivent pas casser. La route `/morpho/latest` doit retourner les analyses v1 telles quelles ; les consommateurs aval doivent tolérer l'absence du champ `biomech`.

---

## 6. Critères d'acceptation

- [ ] Une nouvelle analyse retourne un payload conforme à `MorphoAnalysisResultV2` validé par Zod (ou équivalent).
- [ ] Les 10 patterns moteurs ont chacun un `pattern_verdict` non vide.
- [ ] Pour chaque exercice du Gold Standard DB, une `ExerciseAdvantageLevel` est calculée.
- [ ] À partir de la 2e analyse v2 d'un même client, un `EvolutionReport` est généré automatiquement et accessible via API.
- [ ] Aucun terme médical diagnostique n'apparaît dans les outputs GPT-4o (test : checker prompt + 10 cas réels).
- [ ] Les `stimulus_adjustments` sortis sont dans [0.8, 1.2] pour tous les patterns, dans tous les cas testés.
- [ ] La route legacy `/morpho/latest` continue de servir les anciennes analyses sans erreur.
