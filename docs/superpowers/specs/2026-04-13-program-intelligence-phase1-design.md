# Program Intelligence — Phase 1 Design Spec

**Date:** 2026-04-13  
**Scope:** Phase 1 — Intelligence de base pour le builder de templates programme  
**Status:** Approved for implementation

---

## Contexte

Le `ProgramTemplateBuilder` existant est un formulaire statique : il permet de créer des sessions et d'y ajouter des exercices, mais n'offre aucune analyse, aucune alerte, et aucune aide à la décision. Le catalogue d'exercices (`exercise-catalog.json`) contient des métadonnées riches (muscles, patterns, equipment, isCompound, stimulus_coefficient) qui ne sont pas exploitées.

Ce design ajoute une couche d'intelligence temps réel **non-invasive** : elle se greffe sur le builder existant sans refactoring de la structure sessions/exercices.

---

## Périmètre Phase 1

1. Moteur d'intelligence dans `lib/programs/intelligence/`
2. Sticky panel latéral toujours visible (`ProgramIntelligencePanel`)
3. Alertes inline sous chaque exercice concerné
4. Alternatives d'exercices — coach (drawer) + client (bottom sheet)
5. Exercices custom coach persistés dans le catalogue

**Hors scope Phase 1 :** modèle 3D anatomique, supersets, vue macro cross-sessions, prédictions automatiques sets/reps/RIR, intégration profil client (blessures/préférences).

---

## Architecture

### Approche choisie : Moteur partagé dans `lib/`

Fonctions pures TypeScript dans `lib/programs/intelligence/`. Zéro dépendances React. Consommées via un hook dans le builder coach ET dans l'espace séance client, sans duplication.

```
lib/programs/intelligence/
  index.ts              ← export public API
  scoring.ts            ← moteur scoring complet (6 sous-moteurs)
  alternatives.ts       ← sélection et scoring des alternatives
  types.ts              ← tous les types internes

components/programs/
  ProgramTemplateBuilder.tsx          ← existant, intègre useProgramIntelligence
  ProgramIntelligencePanel.tsx        ← sticky panel droit (nouveau)
  ExerciseAlternativesDrawer.tsx      ← drawer alternatives coach (nouveau)
  IntelligenceAlertBadge.tsx          ← alerte inline sous card exercice (nouveau)

app/client/programme/
  ExerciseSwapSheet.tsx               ← bottom sheet alternatives client (nouveau)

app/api/exercises/custom/
  route.ts                            ← POST exercice custom coach
```

### Hook central

```typescript
// Dans ProgramTemplateBuilder
const intelligence = useProgramIntelligence(sessions, meta)
// Expose : { result, alertsFor(sessionIdx, exerciseIdx) }
// Debounce 400ms sur les recalculs
```

---

## Moteur de scoring (`lib/programs/intelligence/scoring.ts`)

### Types de sortie

```typescript
interface IntelligenceResult {
  globalScore: number                   // 0–100
  globalNarrative: string               // phrase explicative en français
  subscores: {
    balance: number                     // Équilibre musculaire
    recovery: number                    // Récupération inter-séances
    specificity: number                 // Cohérence avec l'objectif
    progression: number                 // Progression d'intensité
    completeness: number                // Couverture des patterns
    redundancy: number                  // Diversité des exercices
  }
  alerts: IntelligenceAlert[]
  distribution: MuscleDistribution      // % volume par groupe musculaire
  missingPatterns: MovementPattern[]    // patterns absents selon goal
  redundantPairs: RedundantPair[]       // paires d'exercices redondants
  sraMap: SRAPoint[]                    // fatigue cumulée par groupe/jour
}

interface IntelligenceAlert {
  severity: 'critical' | 'warning' | 'info'
  code: string                          // identifiant machine ex: 'PUSH_PULL_IMBALANCE'
  title: string                         // court, ex: "Déséquilibre push/pull"
  explanation: string                   // pédagogique, pour tout coach
  suggestion: string                    // action concrète recommandée
  sessionIndex?: number                 // null = alerte globale
  exerciseIndex?: number                // null = alerte de session
}
```

### Les 6 sous-moteurs

#### 1. Balance push/pull/legs/core
- Calcule le ratio volume (sets × stimulus_coeff) par catégorie de pattern
- Seuils selon `goal` :
  - `strength` : tolère ratio push/pull jusqu'à 1.6 (spécificité sport)
  - `athletic` : ratio strict 0.8–1.2 push/pull
  - autres : 0.7–1.4
- Alerte `critical` si ratio < 0.5 ou > 2.0
- Alerte `warning` si hors seuil goal
- Score = 100 − (écart_normalisé × 100)

#### 2. Modèle SRA (Stimulus → Récupération → Adaptation)
- Fenêtres de récupération par groupe musculaire (en heures) :
  - Quadriceps, ischio-jambiers, fessiers : 48–72h
  - Dos, pectoraux : 48h
  - Épaules, biceps, triceps : 24–48h
  - Mollets, abdos : 24h
- Modulation par `level` : beginner +25% fenêtre, elite −15%
- Modulation par `stimulus_coeff` : coefficient élevé = fenêtre plus longue
- Alerte `critical` si groupe retravaillé < 50% de sa fenêtre SRA
- Alerte `warning` si groupe retravaillé entre 50% et 80% de sa fenêtre
- Message inclut le delta horaire exact manquant

#### 3. Redondance mécanique
- Deux exercices sont redondants si :
  - Même pattern primaire ET même vecteur de force ET stimulus_coeff > 0.7 sur même groupe
- Score de redondance = nb paires redondantes / total exercices (inversé)
- Alerte `warning` par paire, avec suggestion d'exercice complémentaire (angle différent)
- Exemple : Squat + Leg Press dans la même session → alerte redondance

#### 4. Progression RIR/intensité
- Applicable seulement si `weeks > 1`
- Attendu : RIR décroît de ~0.5/semaine (linéaire) ou reps progressent
- Alerte `warning` si RIR constant sur 4+ semaines consécutives
- Alerte `critical` si RIR=0 dès la semaine 1 (pas de marge de progression)
- Alerte `info` si variation RIR incohérente (monte puis descend sans logique)

#### 5. Spécificité goal
Chaque exercice reçoit un score 0–1 selon le goal du template :

| Goal | Favorise | Pénalise |
|------|----------|----------|
| `hypertrophy` | Isolation, reps 8–15, RIR 1–3 | Force pure < 6 reps, repos > 3min |
| `strength` | Composés, reps 1–6, RIR 0–2 | Isolation, reps > 10 |
| `fat_loss` | Composés, repos courts < 60s, volume élevé | Repos > 2min, faible densité |
| `endurance` | Reps élevées > 15, repos < 45s | Charge lourde, faible volume |
| `recomp` | Mix composés + isolation, densité modérée | Extrêmes (trop lourd ou trop léger) |
| `maintenance` | Équilibre patterns, RIR confortable 2–4 | Intensité extrême |
| `athletic` | Composés multi-joints, patterns variés | Isolation excessive |

Score global spécificité = moyenne pondérée par stimulus_coeff.
Alerte `warning` si score < 0.6.

#### 6. Patterns manquants
Matrice goal → patterns attendus (selon fréquence hebdomadaire) :

| Goal | Patterns attendus |
|------|------------------|
| `hypertrophy` full body | horizontal_push, horizontal_pull, vertical_pull, squat_pattern, hip_hinge, elbow_flexion, elbow_extension, lateral_raise |
| `strength` | horizontal_push, vertical_push, squat_pattern, hip_hinge, horizontal_pull |
| `fat_loss` | squat_pattern, hip_hinge, horizontal_push, horizontal_pull, carry |
| `athletic` | tous les patterns primaires |

Alerte `warning` par pattern absent, avec exemple d'exercice type suggéré.
Score completeness = patterns_présents / patterns_attendus × 100.

### Explication pédagogique
Chaque alerte inclut :
- `title` : court, ex. "Déséquilibre push/pull"
- `explanation` : contexte physiologique accessible à tout coach
- `suggestion` : action concrète ("Ajoutez 1–2 exercices de tirage horizontal en séance 2")

Le `globalNarrative` est généré depuis les subscores : phrase synthétique sur le point fort + point d'attention principal.

---

## Sticky Intelligence Panel (`ProgramIntelligencePanel.tsx`)

### Layout
Panneau latéral droit, **toujours visible**, largeur fixe 280px.  
Sur écran < 1400px : réduit à un tab vertical "74 ⚡" sur le bord droit, clic expand en overlay.

### Contenu (haut → bas)

**1. Header + score global**
- Label "INTELLIGENCE" + score numérique 0–100
- Couleur dynamique : vert > 75, amber 50–75, rouge < 50
- Score animé (Framer Motion) au changement

**2. Progress bar segmentée**
- 6 segments colorés représentant les 6 subscores
- Tooltip sur chaque segment : nom + valeur + phrase d'explication

**3. Grille 2×3 subscores**
- Mini stat cards : valeur + label lisible
- Labels : "Équilibre", "Récupération", "Cohérence objectif", "Progression", "Couverture", "Diversité"

**4. Radar chart — Distribution musculaire**
- 12 axes : dos, pectoraux, épaules, biceps, triceps, quadriceps, ischio-jambiers, fessiers, mollets, abdos, lombaires, full body
- Zone actuelle en vert/amber/rouge selon équilibre
- Zone idéale selon `goal` en overlay pointillé blanc/30
- Stack : **Recharts** (`RadarChart`)

**5. Donut chart — Répartition patterns**
- 4 segments : Push / Pull / Legs / Core
- Recharts `PieChart` avec `innerRadius`

**6. Timeline RIR — Progression intensité**
- Axe X = semaines, Axe Y = RIR moyen
- Courbe attendue en pointillé, courbe actuelle colorisée
- Visible seulement si `weeks > 1`
- Recharts `LineChart`

**7. Mini bar chart horizontal — Volume par session**
- Compare la charge entre séances (sets × stimulus_coeff total)
- Recharts `BarChart` horizontal

**8. Feed alertes**
- Max 5 alertes visibles, triées par sévérité
- Chaque alerte : icône sévérité + titre + explication tronquée (expand au clic)
- Clic sur alerte → scroll + highlight de l'exercice concerné dans le builder

### Comportement
- Recalcul debounce 400ms à chaque modification
- Lecture seule — aucune édition depuis le panel

---

## Alertes inline (`IntelligenceAlertBadge.tsx`)

Affichées directement sous la card de chaque exercice concerné.

### Structure visuelle
```
┌─────────────────────────────────────┐
│ Leg Press  [⇄ Alternatives] [✕]     │
│ Sets: 3  Reps: 8-12  Repos: 90s     │
│ RIR: 2                              │
├─────────────────────────────────────┤
│ ⚠ Quadriceps déjà sollicités 38h   │
│   avant cette séance (SRA: 48h min) │
│   → Voir alternatives  |  Ignorer   │
└─────────────────────────────────────┘
```

### Comportement
- `critical` : bordure rouge card + texte rouge
- `warning` : bordure amber + texte amber
- `info` : texte `white/40`, pas de bordure colorée
- "Voir alternatives" → ouvre `ExerciseAlternativesDrawer` pré-filtré
- "Ignorer" → dismiss local (state), pas persisté en DB
- Si plusieurs alertes : empilées, max 2 visibles + "voir plus"

---

## Alternatives d'exercices

### Moteur commun (`lib/programs/intelligence/alternatives.ts`)

```typescript
function scoreAlternative(
  original: Exercise,
  candidate: CatalogEntry,
  context: {
    equipmentArchetype: string,
    goal: string,
    level: string,
    sessionExercises: Exercise[]
  }
): AlternativeScore
```

Critères de scoring (pondérés) :
- Même pattern primaire : +40pts
- Mêmes groupes musculaires cibles : +30pts
- Compatible équipement archetype : +20pts
- Non redondant avec autres exercices de la session : +10pts
- Pénalité si stimulus_coeff inférieur à l'original : −15pts

### Coach — `ExerciseAlternativesDrawer.tsx`
Drawer latéral droit (420px, slide depuis la droite).

**3 chemins pour remplacer un exercice :**
1. **Alternatve suggérée** : liste scorée par le moteur, avec score + explication + gif
2. **Bibliothèque** : ouvre l'`ExercisePicker` existant (catalogue complet)
3. **Exercice custom** : formulaire inline (nom, pattern, équipement, muscles, stimulus_coeff estimé) → sauvegardé en DB avec `source: 'coach_custom'` + `coach_id`

**Filtres rapides :**
- Même équipement / Équipement différent / Plus facile / Plus difficile

**Affichage par alternative :**
- Score (0–100) + label court ("Remplace mécaniquement", "Angle complémentaire", etc.)
- GIF animé + groupes musculaires ciblés
- Bouton "Remplacer" → substitution dans le template

### Client — `ExerciseSwapSheet.tsx`
Bottom sheet mobile-first, déclenchée par bouton "⇄" sur un exercice.

**Différences vs coach :**
- Contexte = équipement disponible aujourd'hui (checklist rapide en haut du sheet)
- Remplacement **temporaire** : stocké en state local de la séance, jamais persisté
- 3 alternatives max, score caché (labels : "Recommandé" / "Similaire" / "Alternative")
- GIF animé + bouton "Utiliser aujourd'hui"
- Après la séance : template original automatiquement restauré

---

## Exercices custom coach

### Schéma DB
Extension de la table exercices (migration Prisma) :
```prisma
model Exercise {
  // ... champs existants
  source    String  @default("catalog")  // 'catalog' | 'coach_custom'
  coachId   String? // null pour les exercices du catalogue standard
  coach     Coach?  @relation(fields: [coachId], references: [id])
}
```

### API
`POST /api/exercises/custom` — authentifié coach, crée l'exercice avec `source: 'coach_custom'` + `coachId`.

### UI
- Dans l'`ExercisePicker` : badge distinctif "Perso" (accent vert, petit) sur les exercices custom du coach connecté
- Dans l'`ExerciseAlternativesDrawer` : section "Créer un exercice" avec formulaire inline minimal

---

## Gestion des erreurs

- Si le catalogue JSON est mal formé ou un exercice manque de métadonnées → moteur ignore silencieusement l'exercice, pas de crash
- Si `weeks = 1` → sous-moteur progression désactivé, subscore `progression` = 100 par défaut
- Si template vide (0 exercices) → panel affiche état vide "Ajoutez des exercices pour voir l'analyse"
- Debounce 400ms protège contre les recalculs intempestifs pendant la saisie

---

## Stack technique

| Outil | Usage |
|-------|-------|
| Recharts | RadarChart, PieChart, LineChart, BarChart dans le panel |
| Framer Motion | Animation score, transitions panel collapse |
| Prisma | Extension schéma exercices custom |
| TypeScript strict | Moteur `lib/` 100% typé, 0 `any` |

---

## Ce qui ne change pas

- Structure sessions/exercices dans `ProgramTemplateBuilder`
- Drag-and-drop existant
- `ExercisePicker` (réutilisé tel quel, juste appelé depuis de nouveaux points d'entrée)
- API routes templates existantes

---

## Phases suivantes (hors scope)

- **Phase 2** : intégration profil client (blessures, préférences), supersets, prédictions automatiques sets/reps/RIR
- **Phase 3** : modèle 3D anatomique colorisé, vue macro cross-sessions
