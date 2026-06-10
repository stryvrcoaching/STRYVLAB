# Revue système – Module Nutrition STRYVR

Date: 2026-05-23
Statut: Référence active
Périmètre: Nutrition Studio coach, PWA client nutrition, recommandations alimentaires, cohérence énergétique

## Objectif

Documenter de manière persistante:
- les problèmes observés
- leur confirmation dans le code
- les décisions produit et techniques retenues
- les priorités d'implémentation

## Synthèse exécutive

La revue confirme quatre problèmes majeurs:
- les calories consommées ne sont pas strictement dérivées des macros
- le "reste à consommer" devient incohérent dès qu'il existe un dépassement sur une autre macro
- le système ne modélise pas explicitement les dépassements macro
- les recommandations alimentaires actuelles reposent sur des règles statiques et peuvent empirer la situation nutritionnelle

Conclusion:
- le module est exploitable fonctionnellement
- il n'est pas encore assez robuste pour une lecture avancée coach ou une logique nutritionnelle cohérente en cas d'overflow

## Périmètre code principal

### Moteur nutrition coach

- `components/nutrition/studio/NutritionStudio.tsx`
- `components/nutrition/studio/useNutritionStudio.ts`
- `components/nutrition/studio/CalculationEngine.tsx`
- `lib/formulas/macros.ts`
- `lib/formulas/hydration.ts`
- `lib/formulas/carbCycling.ts`
- `lib/nutrition/adaptiveTdee.ts`

### PWA client nutrition

- `app/client/nutrition/page.tsx`
- `app/client/nutrition/NutritionClientPage.tsx`
- `components/client/smart/SmartNutritionHero.tsx`
- `components/client/smart/SmartNutritionWidget.tsx`
- `components/client/smart/RemainingBreakdown.tsx`
- `lib/client/smart/nutritionAlerts.ts`

### APIs et agrégations nutrition

- `app/api/client/nutrition/meals/route.ts`
- `app/api/client/nutrition/entries/[id]/route.ts`
- `app/api/client/nutrition/today-progress/route.ts`
- `app/api/client/nutrition/today/route.ts`
- `lib/nutrition/food-items.ts`

## Constats validés

### 1. Incohérence kcal vs macros

Constat:
- les kcal affichées ne sont pas nécessairement égales à `proteines * 4 + glucides * 4 + lipides * 9`

Cause:
- l'énergie est stockée et agrégée séparément des macros
- les `food_items` apportent `kcal_per_100g` comme source indépendante

Impact:
- écart visible pour les coachs avancés
- perte de confiance
- recommandations plus difficiles à justifier

Décision:
- la source de vérité affichée doit être dérivée des macros
- si fibres, alcool ou autres composantes énergétiques doivent être conservées, elles doivent être explicites

### 2. Reste à consommer incohérent

Constat:
- le système calcule calories restantes et macros restantes indépendamment
- en cas de dépassement macro, ces deux lectures peuvent devenir incompatibles

Cause:
- calcul actuel de type `max(0, target - consumed)` macro par macro et sur les kcal

Impact:
- contradiction UI
- confusion utilisateur
- absence de cohérence métier

Décision:
- introduire un calcul de balance nutritionnelle unique
- distinguer `remaining` et `overflow`

### 3. Overflow non géré

Constat:
- le système tronque les restes à zéro
- il ne rend pas visible le dépassement réel

Impact:
- perte d'information
- impossibilité de corriger intelligemment les prochains choix alimentaires

Décision:
- calculer et afficher explicitement les dépassements
- utiliser ces dépassements dans les recommandations et la visualisation

### 4. Recommandations alimentaires statiques

Constat:
- les suggestions actuelles sont des règles UI codées en dur
- elles ne raisonnent pas en termes de correction macro nette

Impact:
- une suggestion peut augmenter les macros déjà en excès

Décision:
- créer un moteur de suggestions basé sur:
  - les déficits restants
  - les excès existants
  - le budget calorique net

### 5. Visualisation des dépassements insuffisante

Constat:
- plusieurs jauges PWA saturent à 100%
- l'état over-target n'est pas correctement distingué

Impact:
- un gros dépassement peut ressembler visuellement à un simple objectif atteint

Décision:
- introduire des états visuels standardisés:
  - sous objectif
  - dans cible
  - proche limite
  - dépassement

### 6. Moteur macro coach partiellement aligné, mais pas encore cible

Constat:
- le moteur actuel calcule bien calories, protéines, lipides et glucides
- mais les lipides restent principalement basés sur un plancher et un pourcentage fixe

Impact:
- pas assez d'adaptation selon masse grasse, activité et phase calorique

Décision:
- refondre la cascade de calcul:
  - calories
  - protéines
  - lipides minimum
  - ajustements dynamiques lipides
  - glucides résiduels

## Décisions prioritaires

### P0

- corriger le calcul calorique global
- corriger le calcul du reste à consommer
- ajouter la gestion des dépassements
- corriger le moteur de recommandations alimentaires

### P1

- ajouter les états visuels de dépassement
- clarifier la jauge principale
- étendre les alertes de cohérence nutritionnelle

### P2

- introduire l'ajustement dynamique des lipides
- adapter automatiquement la répartition glucides/lipides selon:
  - masse grasse
  - activité
  - phase calorique
  - progression utilisateur

### P3

- ajouter des garde-fous coach
- valider côté API les protocoles nutrition incohérents

## Références associées

- `docs/NUTRITION_IMPLEMENTATION_PLAN_2026-05-23.md`
- `docs/NUTRITION_TICKET_BACKLOG_2026-05-23.md`
