# Plan d'implémentation – Nutrition STRYVR

Date: 2026-05-23
Statut: Référence active
Owner: à assigner

## Objectif

Transformer la revue système nutrition en plan d'exécution concret, séquencé et implémentable.

## Principes d'exécution

- traiter d'abord les incohérences métier visibles
- centraliser les calculs avant de retoucher l'UI
- éviter les règles locales dans les composants
- faire converger coach et client vers les mêmes helpers métier
- privilégier les helpers purs testables

## Architecture cible

### 1. Source de vérité énergétique

Créer un helper partagé qui calcule l'énergie depuis les macros:

- protéines: `4 kcal/g`
- glucides: `4 kcal/g`
- lipides: `9 kcal/g`

Extension possible ultérieure:
- alcool
- fibres

### 2. Balance nutritionnelle partagée

Créer un helper central qui retourne:

- `remaining`
- `overflow`
- `remainingCaloriesNet`
- `remainingCaloriesFromMacros`
- `statusByMacro`

### 3. Recommandation alimentaire pilotée par balance

Le moteur de recommandation doit:
- prioriser les déficits
- pénaliser les macros déjà dépassées
- respecter le budget calorique net

### 4. Visualisation explicite des dépassements

Toutes les jauges PWA nutrition doivent supporter:
- `under`
- `in_target`
- `near_limit`
- `over`

### 5. Refactor macro coach

Nouvelle cascade cible:
1. calcul calories cibles
2. verrouillage protéines
3. plancher lipidique
4. ajustement dynamique des lipides
5. glucides en résiduel

## Ordre d'implémentation recommandé

### Phase 1 – Fondations métier

1. créer `computeMacroEnergy`
2. créer `computeNutritionBalance`
3. créer une stratégie de suggestion macro-aware

### Phase 2 – Intégration client nutrition

4. rebrancher les agrégations repas/jour
5. refondre `RemainingBreakdown`
6. intégrer les états visuels overflow
7. étendre les alertes nutrition

### Phase 3 – Refactor moteur coach

8. refondre `calculateMacros`
9. introduire le moteur adaptatif des lipides
10. exposer la traçabilité du calcul

### Phase 4 – Garde-fous produit

11. bloquer le partage de protocoles incohérents
12. ajouter validation serveur

## Fichiers cibles par chantier

### Énergie et agrégations

- `lib/nutrition/food-items.ts`
- `app/api/client/nutrition/meals/route.ts`
- `app/api/client/nutrition/entries/[id]/route.ts`
- `app/client/nutrition/page.tsx`
- `app/api/client/nutrition/today-progress/route.ts`

### Balance et recommandations

- `components/client/smart/RemainingBreakdown.tsx`
- `lib/client/smart/nutritionAlerts.ts`
- nouveau:
  - `lib/nutrition/balance.ts`
  - `lib/nutrition/recommendations.ts`

### Visualisation PWA

- `components/client/smart/SmartNutritionHero.tsx`
- `components/client/smart/SmartNutritionWidget.tsx`
- éventuellement `components/client/NutritionWidget.tsx`

### Moteur coach

- `lib/formulas/macros.ts`
- `components/nutrition/studio/useNutritionStudio.ts`
- `components/nutrition/studio/CalculationEngine.tsx`

### Validation protocole

- `app/api/clients/[clientId]/nutrition-protocols/route.ts`
- `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts`

## Règles d'acceptation globales

Le chantier sera considéré cohérent si:

- les kcal affichées correspondent toujours à la règle officielle d'énergie
- les restes macros et calories ne se contredisent plus
- les dépassements sont visibles et réutilisés par le moteur
- les recommandations ne renforcent plus des excès déjà présents
- le moteur macro coach devient lisible, justifiable et testable

## Risques

- divergence entre anciennes colonnes `total_calories` et nouvelles conventions
- impact sur l'historique des repas existants
- effets de bord sur les widgets client déjà stylés
- nécessité d'une migration de données si la persistance kcal change

## Mitigation

- introduire d'abord des helpers sans casser les structures actuelles
- comparer `stored kcal` vs `derived kcal` avant bascule complète
- ajouter tests de non-régression sur les agrégations
- faire la bascule UI après stabilisation métier

## Suivi

Le suivi détaillé est tenu dans:

- `docs/NUTRITION_TICKET_BACKLOG_2026-05-23.md`
