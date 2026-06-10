# Spec : Exercise Catalog Biomech Enrichment + Custom Exercise System

**Date :** 2026-04-23  
**Status :** Approved  
**Scope :** Catalog data pipeline, coach custom exercise form, intelligence engine upgrade, builder UI simplification

---

## Context

STRYVR dispose de 457 exercices avec GIFs dans `public/bibliotheque_exercices/`, chacun accompagné d'un CSV biomécanique complet (17 colonnes : joint_stress, activation, instability, coordination, etc.). Ces données n'alimentent pas encore le moteur d'intelligence.

Le catalog JSON actuel (`data/exercise-catalog.json`) est la source utilisée par l'ExercisePicker et le moteur. Il ne contient que 12 champs basiques. Le moteur score avec des proxys grossiers (pattern de mouvement, muscles génériques) alors qu'il pourrait scorer avec des données précises.

Par ailleurs, l'UI du builder expose aujourd'hui des champs bioméchaniques au coach (movement_pattern, equipment, muscles primaires, is_compound) que le coach doit remplir manuellement — ce qui crée de la friction inutile et produit des données de mauvaise qualité.

**Objectif :** enrichir le catalog automatiquement via un script de build, simplifier l'UI coach au maximum, et permettre aux coachs d'ajouter leurs propres exercices avec le même niveau de complétude biomécanique.

---

## Architecture — 3 couches

```
Layer 1 — Catalog Data Pipeline
  scripts/merge-exercise-catalog.ts
  CSV (457 ex.) → data/exercise-catalog.json enrichi (25 champs)
  scripts/exercise-id-map.json (mapping manuel pour cas ambigus)

Layer 2 — Custom Exercise System
  Migration DB : coach_custom_exercises (schéma étendu)
  API /api/exercises/custom (GET/POST/PATCH/DELETE)
  Modal formulaire multi-step (6 étapes, tous champs obligatoires)
  Upload media : image/GIF/video → Supabase Storage

Layer 3 — Intelligence Engine Upgrade
  lib/programs/intelligence/catalog-utils.ts : consomme nouveaux champs
  lib/programs/intelligence/scoring.ts : 2 nouveaux subscores
  lib/programs/intelligence/alternatives.ts : constraint_profile + unilateral
```

---

## Layer 1 — Catalog Data Pipeline

### Script : `scripts/merge-exercise-catalog.ts`

**Entrées :**
- `public/bibliotheque_exercices/*/schema-*.csv` (10 fichiers, 457 lignes)
- `data/exercise-catalog.json` (source existante, 458 entrées)
- `scripts/exercise-id-map.json` (mapping manuel slug CSV → slug JSON pour cas ambigus)

**Matching strategy :**
1. Normaliser `exercise_id` CSV (ex: `BIC-001`) → extraire le nom CSV → slugifier → chercher dans catalog JSON par slug exact
2. Si pas de match exact → chercher par `gifUrl` (le slug GIF est souvent identique au slug catalog)
3. Fallback → entrée dans `exercise-id-map.json` pour résolution manuelle
4. Loguer les non-matchés sans bloquer le script

**Sortie :** `data/exercise-catalog.json` avec les champs enrichis fusionnés :

```typescript
interface CatalogEntry {
  // Existants (inchangés)
  id: string
  name: string
  slug: string
  gifUrl: string
  muscleGroup: string
  exerciseType: "exercise" | "pedagogique"
  pattern: string[]
  movementPattern: string | null
  equipment: string[]
  isCompound: boolean
  muscles: string[]           // slugs FR génériques (ex: "biceps", "dos")
  stimulus_coefficient: number

  // Nouveaux depuis CSV
  plane: "sagittal" | "frontal" | "transverse" | null
  mechanic: "isolation" | "compound" | "isometric" | "plyometric" | null
  unilateral: boolean
  primaryMuscle: string | null        // slug EN précis (ex: "biceps_brachii")
  primaryActivation: number | null    // 0.0–1.0
  secondaryMuscles: string[]          // slugs EN précis
  secondaryActivations: number[]      // parallèle à secondaryMuscles
  stabilizers: string[]
  jointStressSpine: number | null     // 1–8
  jointStressKnee: number | null      // 1–8
  jointStressShoulder: number | null  // 1–8
  globalInstability: number | null    // 1–9
  coordinationDemand: number | null   // 1–9
  constraintProfile: string | null    // "free_weight" | "cable_constant" | "machine_stability" | "bodyweight_pull" | "variable_resistance" | "strict_isolation"
}
```

**Exécution :** `npx tsx scripts/merge-exercise-catalog.ts`  
Le script est idempotent — peut être relancé sans risque. Les champs existants non présents dans le CSV sont conservés.

---

## Layer 2 — Custom Exercise System

### Migration DB : `coach_custom_exercises` étendue

La table existante est remplacée par un schéma complet aligné sur les CSV.

**Nouveaux champs ajoutés :**
```sql
ALTER TABLE coach_custom_exercises
  ADD COLUMN IF NOT EXISTS media_url text,           -- remplace image_url
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'gif', 'video')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS plane text CHECK (plane IN ('sagittal', 'frontal', 'transverse')),
  ADD COLUMN IF NOT EXISTS mechanic text CHECK (mechanic IN ('isolation', 'compound', 'isometric', 'plyometric')),
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer CHECK (joint_stress_spine BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer CHECK (joint_stress_knee BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer CHECK (joint_stress_shoulder BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS global_instability integer CHECK (global_instability BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS coordination_demand integer CHECK (coordination_demand BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS constraint_profile text;
```

**Champs existants conservés :** `id`, `coach_id`, `name`, `slug`, `movement_pattern`, `is_compound`, `equipment`, `muscle_group`, `stimulus_coefficient`

### API `/api/exercises/custom`

**GET :** liste les exercices custom du coach connecté, incluant tous les champs bioméchaniques. Paramètre optionnel `?source=custom` pour filtrer dans le picker.

**POST :** validation Zod complète — tous les champs bioméchaniques sont requis. Retourne 422 si un champ manque. Upload media séparé via `/api/exercises/custom/upload-media` (multipart, max 50MB, JPEG/PNG/GIF/MP4/WebM).

**PATCH `/api/exercises/custom/[exerciseId]`** : mise à jour partielle possible (coach peut corriger ses données).

**DELETE `/api/exercises/custom/[exerciseId]`** : soft delete (exercice retiré du picker mais les programmes existants ne sont pas affectés).

### Modal formulaire custom — `CustomExerciseModal`

Modal plein écran, 6 étapes avec barre de progression :

**Étape 1 — Média** (requis)
- Upload drag-and-drop image (JPG/PNG/WebP) ou GIF ou vidéo (MP4/WebM)
- Preview temps réel
- Taille max 50MB

**Étape 2 — Identité**
- Nom (requis, 2–120 chars)
- Description courte (optionnelle)
- Groupe musculaire principal (select, requis)

**Étape 3 — Classification**
- Movement pattern (select avec les mêmes options que le catalog, requis)
- Plan de mouvement : Sagittal / Frontal / Transversal (requis)
- Mécanique : Isolation / Composé / Isométrique / Pliométrique (requis)
- Unilatéral : toggle (requis)
- Équipement : multi-select chips (requis, au moins 1)

**Étape 4 — Muscles**
- Muscle primaire : select + slider activation 0.50–0.95 (requis)
- Muscles secondaires : multi-select + sliders individuels activation (optionnel, 0–3 muscles)
- Stabilisateurs : multi-select chips (optionnel)

**Étape 5 — Biomécanique**
- Joint stress rachis : slider 1–8 avec labels descriptifs (requis)
- Joint stress genou : slider 1–8 (requis)
- Joint stress épaule : slider 1–8 (requis)
- Instabilité globale : slider 1–9 (requis)
- Demande de coordination : slider 1–9 (requis)
- Profil de contrainte : select (requis) — Poids libre / Câble constant / Machine stabilisée / Poids du corps / Résistance variable / Isolation stricte

**Étape 6 — Confirmation**
- Résumé de toutes les données saisies
- Bouton "Créer l'exercice"
- L'exercice apparaît immédiatement dans le picker sous le filtre "Mes exercices"

### Picker — filtre "Mes exercices"

Dans `ExercisePicker`, ajout d'un filtre `source` avec 3 valeurs :
- **Tous** (défaut) — catalog STRYVR + exercices custom du coach mélangés
- **Catalogue STRYVR** — uniquement les 457 exercices officiels
- **Mes exercices** — uniquement les custom du coach

Les exercices custom affichent un badge "Perso" (vert) comme aujourd'hui. Les exercices STRYVR n'ont pas de badge.

---

## Layer 3 — Intelligence Engine Upgrade

### `catalog-utils.ts` — nouvelles fonctions

**`resolveExerciseCoeff(exercise)`** — modifié :
- Priorité 1 : `primaryActivation` du catalog enrichi (plus précis que stimulus_coefficient)
- Priorité 2 : `stimulus_coefficient` existant
- Priorité 3 : dérivation depuis is_compound (comportement actuel)

**`getBiomechData(exerciseId)`** — nouvelle fonction :
```typescript
function getBiomechData(exerciseId: string): BiomechData | null
// Retourne : jointStress{Spine,Knee,Shoulder}, globalInstability, coordinationDemand, constraintProfile, unilateral
// Retourne null si exercice sans données biomec (graceful degradation)
```

**`expandMusclesForScoring(exercise)`** — modifié :
- Utilise `secondaryMuscles` précis (EN slugs) si disponibles
- Fallback sur le comportement actuel (DOS_SUBGROUPS_BY_PATTERN) si non disponibles

### `scoring.ts` — 2 nouveaux subscores

**`scoreJointLoad(sessions, profile?)`**
- Agrège `jointStress{Spine,Knee,Shoulder}` × volume (sets) par session
- Si `profile.injuries` contient une zone → pénalité proportionnelle au stress sur cette zone
- Alerte `JOINT_OVERLOAD` (critical si stress moyen ≥ 6 sur zone blessée, warning si ≥ 4)
- Contribue au `globalScore` avec poids 10%

**`scoreCoordination(sessions, meta)`**
- Calcule la moyenne de `coordinationDemand` et `globalInstability` sur la session
- Si `meta.level === 'beginner'` et moyenne > 6 → alerte `COORDINATION_MISMATCH` (warning)
- Si `meta.level === 'beginner'` et moyenne > 7.5 → alerte `COORDINATION_MISMATCH` (critical)
- Contribue au `globalScore` avec poids 5%

**Poids globaux mis à jour :**
```
SRA         : 20%  (inchangé)
Balance     : 20%  (inchangé)
Specificity : 15%  (inchangé)
Progression : 10%  (inchangé)
Redundancy  : 10%  (inchangé)
Completeness: 10%  (inchangé)
Joint Load  : 10%  (nouveau)
Coordination:  5%  (nouveau)
                   = 100%
```

### `alternatives.ts` — upgrade `scoreAlternatives()`

Nouveaux critères de scoring :

| Critère | Points | Logique |
|---------|--------|---------|
| constraintProfile match | +15 | Même profil de contrainte → substitution mécanique directe |
| unilateral match | +10 | Même côté (uni/bi) → pas de changement de stimulus |
| jointStress delta | −10 à +10 | Si zone blessée : favoriser alternatives à stress plus faible |
| primaryActivation delta | −15 à 0 | Pénaliser si activation trop différente (>0.25) |

Ces critères s'ajoutent aux 5 critères existants (pattern, muscles, équipement, non-redondant, stimCoeff).

---

## UI Builder — Simplification

### Champs supprimés de `ExerciseCard`

Les champs suivants sont retirés de l'interface coach :
- Select "Movement pattern"
- Pills équipement (barbell, dumbbell, cable…)
- Toggle "Polyarticulaire" / is_compound
- Chips muscles primaires (sélection manuelle)
- Chips muscles secondaires

Ces données sont maintenant **injectées automatiquement** depuis le catalog enrichi lors de la sélection dans le picker.

### Champs supprimés de `EditorPane`

- Select "Equipment archetype" visible dans le sub-header → retiré de l'UI (conservé dans meta pour le scoring, calculé automatiquement depuis les équipements des exercices de la session)

### `ExercisePicker.onSelect()` — données transmises

```typescript
onSelect({
  name,
  gifUrl,
  movementPattern,      // depuis catalog
  equipment,            // depuis catalog
  isCompound,           // depuis catalog
  primaryMuscles,       // depuis catalog (muscles[] existant)
  secondaryMuscles,     // nouveau — depuis catalog
  // Champs biomec transmis mais jamais affichés dans l'UI builder :
  plane,
  mechanic,
  unilateral,
  primaryMuscle,
  primaryActivation,
  secondaryActivations,
  stabilizers,
  jointStressSpine,
  jointStressKnee,
  jointStressShoulder,
  globalInstability,
  coordinationDemand,
  constraintProfile,
})
```

Tous ces champs sont stockés en DB dans `coach_program_template_exercises` et `program_exercises`. De nouvelles colonnes sont ajoutées via migration pour stocker les données bioméchaniques par exercice dans les programmes.

---

## Migration DB — program exercises

Pour que les données bioméchaniques soient disponibles par exercice dans un programme (et pas seulement dans le catalog), les tables `coach_program_template_exercises` et `program_exercises` reçoivent les nouveaux champs :

```sql
-- À appliquer sur les deux tables
ADD COLUMN IF NOT EXISTS plane text,
ADD COLUMN IF NOT EXISTS mechanic text,
ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS primary_muscle text,
ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS joint_stress_spine integer,
ADD COLUMN IF NOT EXISTS joint_stress_knee integer,
ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer,
ADD COLUMN IF NOT EXISTS global_instability integer,
ADD COLUMN IF NOT EXISTS coordination_demand integer,
ADD COLUMN IF NOT EXISTS constraint_profile text
```

Les exercices existants dans les programmes auront ces champs à NULL — le moteur dégrade gracieusement (comportement actuel) pour les programmes créés avant la migration.

---

## Fichiers critiques

| Fichier | Action |
|---------|--------|
| `scripts/merge-exercise-catalog.ts` | Créer |
| `scripts/exercise-id-map.json` | Créer |
| `data/exercise-catalog.json` | Enrichir (output du script) |
| `supabase/migrations/YYYYMMDD_coach_custom_exercises_biomech.sql` | Créer |
| `supabase/migrations/YYYYMMDD_program_exercises_biomech.sql` | Créer |
| `app/api/exercises/custom/route.ts` | Modifier (validation + nouveaux champs) |
| `app/api/exercises/custom/upload-media/route.ts` | Créer |
| `components/programs/ExercisePicker.tsx` | Modifier (filtre source, onSelect étendu) |
| `components/programs/CustomExerciseModal.tsx` | Créer (formulaire 6 étapes) |
| `components/programs/studio/ExerciseCard.tsx` | Modifier (supprimer champs UI biomec) |
| `components/programs/studio/EditorPane.tsx` | Modifier (supprimer equipment_archetype UI) |
| `components/programs/ProgramTemplateBuilder.tsx` | Modifier (onSelect étendu, save payload étendu) |
| `lib/programs/intelligence/catalog-utils.ts` | Modifier (resolveExerciseCoeff, getBiomechData, expandMusclesForScoring) |
| `lib/programs/intelligence/scoring.ts` | Modifier (scoreJointLoad, scoreCoordination, poids globaux) |
| `lib/programs/intelligence/alternatives.ts` | Modifier (constraintProfile + unilateral + activation delta) |
| `lib/programs/intelligence/types.ts` | Modifier (BiomechData type, nouveaux alerts) |

---

## Vérification end-to-end

1. Lancer `npx tsx scripts/merge-exercise-catalog.ts` → vérifier que le JSON enrichi contient `jointStressSpine` sur au moins 400 exercices
2. Sélectionner un exercice dans le picker → vérifier que les champs biomec ne s'affichent pas dans l'UI mais sont bien dans le state du builder
3. Créer un exercice custom via le modal → vérifier qu'il apparaît dans le picker avec le filtre "Mes exercices"
4. Construire un programme avec des exercices à fort stress rachis → vérifier l'alerte `JOINT_OVERLOAD` dans le panel intelligence
5. Construire un programme débutant avec des exercices à haute coordination → vérifier `COORDINATION_MISMATCH`
6. Lancer `npx tsc --noEmit` → 0 erreurs
