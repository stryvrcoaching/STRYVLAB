# Nutrition Studio — Workout Card Alignment Design

**Date:** 2026-07-02  
**Status:** Approved for implementation

---

## Understanding Summary

- Refonte de la page liste `Nutrition Studio`, pas de l'écran d'édition.
- Objectif : aligner les cartes de protocoles nutritionnels sur le niveau de design, de structure et de lisibilité des cartes `Workout Studio`.
- La carte nutrition doit reprendre la même hiérarchie visuelle que la carte workout : header premium, rail d'actions, 4 métriques, 2 graphiques, footer simple.
- Le contenu métier doit rester nativement nutritionnel, sans copier artificiellement les métriques training.
- Les actions directes attendues sur chaque carte sont : `activer/retirer`, `dupliquer`, `PDF`, `supprimer`.
- La logique `save as template` de `Workout Studio` ne doit pas être reprise côté nutrition.
- L'expérience doit rester smart, intuitive, fonctionnelle, sans surcharge ni bruit inutile.

## Assumptions

- Le bloc `STRUCTURE` affichera le nombre de jours du protocole.
- Le `score global nutrition` sera calculé à partir de la logique déjà existante côté coach nutrition hub, avec harmonisation éventuelle de formule si nécessaire.
- Les signaux réels de carte viendront d'un enrichissement du payload `nutrition-protocols` avec un bloc `analytics`, à l'image de `Workout Studio`.
- Le flux PDF nutrition réutilisera le même modèle UX que `Workout Studio` : preview modal, téléchargement, partage.
- La duplication d'un protocole nutritionnel nécessitera une nouvelle route dédiée côté API.

## Explicit Non-Goals

- Refonte de l'écran d'édition d'un protocole nutritionnel.
- Ajout d'une logique template nutritionnelle depuis la carte.
- Refonte complète du moteur nutrition.
- Multiplication des badges, micro-indicateurs ou couches de lecture non essentielles.

## Decision Log

### Decision 1 — Alignement visuel

- **Décidé :** reprendre strictement l'anatomie de la carte `Workout Studio`.
- **Alternatives :**
  - créer une carte nutrition totalement différente
  - reprendre seulement quelques éléments visuels
- **Pourquoi :** l'objectif produit est une perception de maturité identique entre Workout et Nutrition.

### Decision 2 — Approche de contenu

- **Décidé :** garder la structure `Workout`, mais avec un contenu nativement nutrition.
- **Alternatives :**
  - copier les métriques workout en les renommant
  - créer une carte beaucoup plus dense
- **Pourquoi :** la parité doit être structurelle et premium, pas artificielle ni bruyante.

### Decision 3 — Actions visibles

- **Décidé :** afficher directement `activer/retirer`, `dupliquer`, `PDF`, `supprimer`.
- **Alternatives :**
  - cacher certaines actions dans un menu
  - ajouter `template`
- **Pourquoi :** la demande explicite est un usage immédiat, aligné sur Workout, sans template.

### Decision 4 — Bloc métriques

- **Décidé :** conserver 4 métriques, comme Workout.
- **Alternatives :**
  - réduire à 3 cartes
  - ajouter plus de métriques
- **Pourquoi :** conserver exactement le même rythme visuel et la même lecture mentale.

### Decision 5 — Métriques retenues

- **Décidé :**
  - `STRUCTURE`
  - `ÉCART KCAL`
  - `SCORE GLOBAL`
  - `VARIATION KCAL/JOUR`
- **Alternatives :**
  - inclure la fiabilité comme métrique
  - mettre davantage de macros ou d'hydratation au premier niveau
- **Pourquoi :** ce sont les signaux les plus utiles, les plus intuitifs et les plus cohérents pour piloter rapidement un protocole.

### Decision 6 — Fiabilité des données

- **Décidé :** afficher la fiabilité dans le header comme badge discret.
- **Alternatives :**
  - la mettre dans le bloc métriques
  - la mettre en footer
  - ne pas l'afficher
- **Pourquoi :** la fiabilité doit être visible sans polluer les métriques centrales.

### Decision 7 — Graphiques

- **Décidé :**
  - graphique 1 : `ÉCART KCAL`
  - graphique 2 : `VARIATION KCAL/JOUR`
- **Alternatives :**
  - protéines
  - hydratation
  - qualité des logs
- **Pourquoi :** ces deux graphiques donnent la lecture la plus actionnable et la plus universelle pour le coach.

### Decision 8 — Contexte sous graphiques

- **Décidé :**
  - `ÉCART KCAL` → `X jours analysés`
  - `VARIATION KCAL/JOUR` → `Amplitude moyenne ±X kcal/j`
- **Alternatives :**
  - `Dernier log le ...`
- **Pourquoi :** ces libellés expliquent directement le signal affiché. La fraîcheur de donnée est déjà couverte par le badge de fiabilité.

---

## Final Design

## Scope

Page concernée :

- `/Users/user/Desktop/STRYVLAB/app/coach/clients/[clientId]/protocoles/nutrition/page.tsx`

Composant principal concerné :

- `/Users/user/Desktop/STRYVLAB/components/nutrition/NutritionProtocolDashboard.tsx`

Référence structurelle :

- `/Users/user/Desktop/STRYVLAB/components/programs/ClientProgramsList.tsx`

## Card Anatomy

Chaque carte nutrition suit exactement le même enchaînement de lecture que la carte workout :

1. header premium
2. identité du protocole
3. bloc 4 métriques
4. bloc 2 graphiques
5. footer avec CTA

## Header

Le header contient :

- badge principal `Actif app` ou `Brouillon`
- 1 à 2 badges contextuels maximum, uniquement s'ils apportent une vraie valeur de lecture
- badge de fiabilité `Fiables`, `Partielles`, ou `Faibles`
- rail d'actions à droite

Actions visibles :

- `activer/retirer`
- `dupliquer`
- `PDF`
- `supprimer`

## Identity Row

La zone identité contient :

- nom du protocole
- ligne méta sur le modèle workout

Exemples de ligne méta :

- `Créé le 4 mai 2026 · 7 jours · suivi actif`

Cette ligne doit rester concise. Les statuts principaux sont déjà portés par le header.

## Metrics Block

Le bloc métriques reprend le même gabarit 2x2 que Workout.

### Metric 1 — `STRUCTURE`

- **Valeur :** `X jours`
- **Rôle :** lecture immédiate de la taille du protocole

### Metric 2 — `ÉCART KCAL`

- **Valeur :** écart moyen consommé vs cible sur la fenêtre active
- **Formats attendus :**
  - `-185 kcal/j`
  - `+120 kcal/j`
- **Rôle :** signal directement coachable

### Metric 3 — `SCORE GLOBAL`

- **Valeur :** score nutrition global
- **Format attendu :** `82/100`
- **Rôle :** lecture synthétique premium

### Metric 4 — `VARIATION KCAL/JOUR`

- **Valeur :** amplitude moyenne journalière
- **Format attendu :** `±240 kcal/j`
- **Rôle :** mesurer la stabilité d'exécution

## Charts Block

Le bloc bas contient deux panneaux graphiques premium, alignés sur ceux de Workout en taille, hiérarchie et densité.

### Chart 1 — `ÉCART KCAL`

- montre l'évolution du delta kcal consommé vs cible
- comporte un indicateur de tendance à droite : `Hausse`, `Baisse`, `Stable`
- ligne de contexte : `X jours analysés`

### Chart 2 — `VARIATION KCAL/JOUR`

- montre la variabilité journalière sur la fenêtre active
- comporte un indicateur de tendance à droite
- ligne de contexte : `Amplitude moyenne ±X kcal/j`

## Reliability Badge

Le badge de fiabilité ne doit pas devenir un panneau à part entière.

Règles :

- `Fiables` : données solides et exploitables
- `Partielles` : lecture utile mais incomplète
- `Faibles` : prudence, signal peu robuste

Le badge doit rester très lisible mais discret.

## Footer

Le footer reste léger :

- contexte ou tags nutrition utiles à gauche si vraiment pertinents
- bouton `Ouvrir` à droite

Pas d'ajout de sous-actions ni de texte explicatif inutile.

---

## Data Model Recommendation

Le endpoint liste nutrition doit être enrichi avec un bloc `analytics` proche de la philosophie `Workout Studio`.

Proposition de payload par protocole :

```ts
analytics: {
  days_count: number
  avg_kcal_delta: number | null
  nutrition_score: number | null
  avg_daily_kcal_variation: number | null
  reliability_label: 'Fiables' | 'Partielles' | 'Faibles'
  analyzed_days_count: number
  kcal_delta_trend: number[]
  kcal_variation_trend: number[]
}
```

## Data Sources

Sources existantes à privilégier :

- `/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/nutrition-protocols/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/nutrition-hub/route.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/nutritionHub.ts`

Principe :

- réutiliser la logique métier existante
- éviter à la UI d'orchestrer plusieurs endpoints
- concentrer l'enrichissement analytique dans le payload de liste

---

## PDF Alignment

Le protocole nutritionnel doit bénéficier d'un flux PDF aligné sur `Workout Studio` :

- point d'entrée depuis la carte
- modal de prévisualisation
- action de téléchargement
- action de partage
- rendu premium cohérent avec la marque

La différence ne porte que sur le contenu du document, pas sur le comportement UX principal.

---

## API / Implementation Recommendations

## Existing

- partage / retrait déjà existants
- suppression déjà existante
- lecture des protocoles déjà existante

## Required additions

- ajout d'une duplication de protocole nutrition
- enrichissement analytique du GET liste nutrition
- ajout d'un flux PDF nutrition aligné sur le pattern workout

## Suggested implementation sequence

1. enrichir `/nutrition-protocols` avec `analytics`
2. refondre `NutritionProtocolDashboard` avec le gabarit Workout
3. ajouter la duplication nutrition
4. brancher le flux PDF nutrition

---

## Risks and Guardrails

- ne pas surcharger le header avec trop de badges
- ne pas transformer la carte en mini dashboard complexe
- ne pas calculer des signaux contradictoires entre `nutrition-hub` et `nutrition-protocols`
- ne pas introduire un rendu PDF nutrition divergent de la logique workout

---

## Ready for Implementation

Le design est validé et documenté.
La suite attendue est un plan d'implémentation puis l'exécution incrémentale.
