# Backlog tickets – Nutrition STRYVR

Date: 2026-05-23
Statut global: Ready for implementation

Légende statuts:
- `todo`
- `in_progress`
- `blocked`
- `done`

## STRYV-NUT-001 — Unifier le calcul énergétique nutrition

Statut: `todo`
Priorité: `P0`
Estimation: `3 pts`

### Objectif

Mettre en place une source de vérité unique pour les calories nutritionnelles à partir des macronutriments.

### Fichiers

- `lib/nutrition/food-items.ts`
- `app/api/client/nutrition/meals/route.ts`
- `app/api/client/nutrition/entries/[id]/route.ts`
- `app/client/nutrition/page.tsx`
- `app/api/client/nutrition/today-progress/route.ts`

### AC

- une fonction partagée `computeMacroEnergy()` existe
- les agrégations repas et journalières utilisent cette fonction
- un cas `149P / 179G / 103L` retourne `2239 kcal`

## STRYV-NUT-002 — Créer un moteur de balance nutritionnelle

Statut: `todo`
Priorité: `P0`
Estimation: `3 pts`

### Objectif

Calculer de manière cohérente les restes, dépassements et calories nettes restantes.

### Fichiers

- `lib/nutrition/balance.ts`

### AC

- le helper retourne `remaining`, `overflow`, `remainingCaloriesNet`, `statusByMacro`
- un dépassement macro produit `remaining = 0` et `overflow > 0`

## STRYV-NUT-003 — Refondre le bloc "Reste à consommer"

Statut: `todo`
Priorité: `P0`
Estimation: `3 pts`

### Objectif

Supprimer les contradictions UI entre kcal restantes et macros restantes.

### Fichiers

- `components/client/smart/RemainingBreakdown.tsx`

### AC

- le composant affiche séparément le restant et le dépassé
- les kcal nettes affichées sont cohérentes
- le format `0g restant / +Xg dépassés` est supporté

## STRYV-NUT-004 — Refaire le moteur de recommandations alimentaires

Statut: `todo`
Priorité: `P0`
Estimation: `5 pts`

### Objectif

Créer des recommandations alimentaires guidées par les déficits restants et les excès existants.

### Fichiers

- `components/client/smart/RemainingBreakdown.tsx`
- `lib/nutrition/recommendations.ts`

### AC

- les suggestions tiennent compte des macros restantes et dépassées
- une situation `carbs low / protein over / fat over` ne propose plus `riz + poulet` par défaut
- les suggestions sont triées par pertinence

## STRYV-NUT-005 — Ajouter les états visuels d'overflow sur les jauges nutrition

Statut: `todo`
Priorité: `P1`
Estimation: `3 pts`

### Objectif

Rendre les dépassements visibles immédiatement sur la PWA.

### Fichiers

- `components/client/smart/SmartNutritionHero.tsx`
- `components/client/smart/SmartNutritionWidget.tsx`
- `components/client/NutritionWidget.tsx`

### AC

- les états `under`, `in_target`, `near_limit`, `over` existent
- `103/65g lipides` est clairement perçu comme un dépassement

## STRYV-NUT-006 — Clarifier la jauge principale nutrition

Statut: `todo`
Priorité: `P1`
Estimation: `2 pts`

### Objectif

Éliminer l'ambiguïté sur ce que représente la jauge principale.

### Fichiers

- `components/client/smart/SmartNutritionHero.tsx`

### AC

- le label est explicite
- la jauge est comprise comme une jauge calorique

## STRYV-NUT-007 — Étendre les alertes de cohérence nutritionnelle

Statut: `todo`
Priorité: `P1`
Estimation: `3 pts`

### Objectif

Ajouter des alertes pour les incohérences de balance et les situations nutritionnelles à risque.

### Fichiers

- `lib/client/smart/nutritionAlerts.ts`

### AC

- ajout d'alertes pour:
  - mismatch kcal/macros
  - fort overflow lipides
  - protéines trop basses
  - reste impossible

## STRYV-NUT-008 — Refondre le moteur macro selon la cascade cible

Statut: `todo`
Priorité: `P2`
Estimation: `8 pts`

### Objectif

Refondre `calculateMacros()` pour appliquer la cascade calories -> protéines -> lipides -> glucides résiduels.

### Fichiers

- `lib/formulas/macros.ts`

### AC

- les protéines sont fixées avant la répartition glucides/lipides
- les glucides sont calculés en résiduel final
- le moteur reste traçable

## STRYV-NUT-009 — Ajouter un moteur adaptatif des lipides

Statut: `todo`
Priorité: `P2`
Estimation: `5 pts`

### Objectif

Faire varier le niveau lipidique cible selon masse grasse, activité et phase calorique.

### Fichiers

- `lib/formulas/macros.ts`

### AC

- plancher `0.8 g/kg`
- ajustements dynamiques selon contexte
- détail du calcul exposé dans le résultat

## STRYV-NUT-010 — Exposer la traçabilité du calcul nutrition coach

Statut: `todo`
Priorité: `P2`
Estimation: `3 pts`

### Objectif

Rendre le calcul macro lisible et auditable dans Nutrition Studio.

### Fichiers

- `lib/formulas/macros.ts`
- `components/nutrition/studio/CalculationEngine.tsx`

### AC

- l'origine des lipides et glucides est visible
- le résultat est explicable côté coach

## STRYV-NUT-011 — Ajouter des garde-fous coach avant partage du protocole

Statut: `todo`
Priorité: `P3`
Estimation: `3 pts`

### Objectif

Empêcher le partage silencieux d'un protocole incohérent.

### Fichiers

- `components/nutrition/studio/useNutritionStudio.ts`

### AC

- certaines incohérences deviennent bloquantes
- les cas atypiques mais tolérés demandent confirmation

## STRYV-NUT-012 — Ajouter une validation serveur des protocoles nutrition

Statut: `todo`
Priorité: `P3`
Estimation: `3 pts`

### Objectif

Valider les protocoles côté API avant persistance.

### Fichiers

- `app/api/clients/[clientId]/nutrition-protocols/route.ts`
- `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts`

### AC

- l'API rejette ou annote les protocoles hors bornes critiques
- les erreurs sont exploitables côté front

## Ordre de réalisation recommandé

### Sprint 1

- `STRYV-NUT-001`
- `STRYV-NUT-002`
- `STRYV-NUT-003`
- `STRYV-NUT-004`

### Sprint 2

- `STRYV-NUT-005`
- `STRYV-NUT-006`
- `STRYV-NUT-007`

### Sprint 3

- `STRYV-NUT-008`
- `STRYV-NUT-009`
- `STRYV-NUT-010`

### Sprint 4

- `STRYV-NUT-011`
- `STRYV-NUT-012`
