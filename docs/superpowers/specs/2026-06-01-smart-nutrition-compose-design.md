# Smart Nutrition Compose — Design Spec
**Date:** 2026-06-01
**Status:** Approved

---

## Vue d'ensemble

Page dédiée `/client/nutrition/compose` — un simulateur de repas en monde parallèle. L'utilisateur compose un repas, voit en temps réel l'impact sur son bilan journalier, puis choisit de sauvegarder en préparation ou de valider directement dans le vrai système. Aucun impact sur le log réel tant qu'il n'a pas validé.

---

## Ce qui existe déjà (ne pas reconstruire)

- **DB** : table `client_nutrition_preps` — schéma complet, RLS, statuts (`planned / logged / cancelled`)
- **API** : `GET/POST /api/client/nutrition/preps`, `PATCH/DELETE /api/client/nutrition/preps/[id]`, `POST /api/client/nutrition/preps/[id]/log` (valide → crée `nutrition_meals` + `nutrition_entries` réelles)
- **`compose-advisor.ts`** : `suggestQuantityForItem`, `evaluateFoodCompatibility`, `getRemainingNutritionTargets`
- **`NutritionLogContent`** : composer complet avec search/catégories, `composerMode`, `balanceContext`, `effectiveConsumed`
- **`SmartNutritionHero`** : jauge 240° + barres macro, accepte `consumed` + `target` en props
- **`SmartNutritionPrepList`** : section "Prépa meals" sur la page nutrition
- **`MealMethodSheet`** : sélecteur d'intention "J'ai mangé..." / "Je compose"

---

## Architecture

### Nouveaux fichiers

```
app/client/nutrition/compose/
  page.tsx              — server component, fetch consumed + target + timezone
  ComposeClientPage.tsx — client, orchestration état + layout split fixe
```

### Layout split fixe

```
┌─────────────────────────────────┐
│ TopBar: "Smart Nutrition" + ←   │  ~56px fixe
├─────────────────────────────────┤
│  SmartNutritionHero             │  ~260px fixe
│  (simulation mode, no date nav) │  live via effectiveConsumed
│  badge "SIMULATION"             │
├─────────────────────────────────┤
│  [Annuler] [Sauver] [Valider]   │  ~60px — visible si drafts.length > 0
├─────────────────────────────────┤
│  NutritionLogContent            │  flex-1 overflow-y-auto
│  composerMode="guide"           │
│  hideActions=true               │
│  onDraftsChange={setDraftTotals}│
└─────────────────────────────────┘
```

### Flux d'état

1. Page charge `consumed` + `target` réels depuis Supabase (mêmes queries que `/client/nutrition`)
2. `NutritionLogContent` gère ses `drafts` en interne, expose `onDraftsChange(totals)` au parent
3. Parent calcule `effectiveConsumed = consumed + draftTotals`
4. `effectiveConsumed` → passé au `SmartNutritionHero` → hero re-render live
5. Zone actions visible dès que `drafts.length > 0`

---

## Comportement des 3 actions finales

| Action | Comportement |
|--------|-------------|
| **Annuler** | Efface les drafts, reste sur la page compose |
| **Sauver en prépa** | `POST /api/client/nutrition/preps`, efface les drafts, reste sur la page compose (prêt pour un 2ème repas) |
| **Valider maintenant** | Log direct via `saveMeal()` (crée `nutrition_meals` + `nutrition_entries` directement, même chemin que le tracking standard), navigue vers `/client/nutrition` |

---

## Point d'entrée — MealMethodSheet

`compose_guide` et `compose_simulation` ne passent plus par `onSelect` vers le parent pour ouvrir `MealLogSheet`. À la place : `router.push('/client/nutrition/compose?date=...')`.

La distinction guide/simulation disparaît : la page compose est toujours en mode intelligent. `NutritionClientPage` change le handler pour les actions compose.

---

## Modifications composants existants

### `NutritionLogContent` — 2 nouveaux props

```typescript
hideActions?: boolean
// masque les boutons "Sauver en prépa" / "Valider" internes
// le parent (ComposeClientPage) gère les actions

onDraftsChange?: (totals: {
  calories: number
  protein: number
  carbs: number
  fat: number
  count: number
}) => void
// appelé à chaque changement de drafts
```

### `SmartNutritionHero` — mode simulation

```typescript
simulationMode?: boolean
// - masque les flèches de navigation de date
// - affiche badge "SIMULATION"
// - arc + barres utilisent la simulation color (#818cf8)
```

---

## Système de recommandation intelligent

### Règle fondamentale

Toujours utiliser `getRemainingNutritionTargets(effectiveConsumed, target)` — jamais `target - consumed` naïf. Cette fonction applique la compensation overflow (fat dépassé → glucides réduits en priorité). C'est la logique déjà implémentée dans `computeNutritionBalance`, elle doit être respectée dans tout le système de suggestion.

### mealFraction cap

```
remaining_for_suggestion = remaining * mealFraction

mealFraction = 0.40  // par défaut — ~3-4 repas/jour
mealFraction = 0.80  // completion mode — dernier repas
```

**Completion mode** déclenché si tous les macros restants sont < 30g ET calories restantes < 200 kcal.

### Algo completion mode

```
Pour chaque macro non-nul dans l'aliment :
  grams_to_fill[macro] = remaining[macro] / food_density[macro] * 100

suggested_g = min(grams_to_fill)  // évite overflow sur n'importe quel macro
```

**Exemple :** 10g P restant, 20g G restant, poulet (22g P/100g) :
- grams_to_fill_P = 10/22×100 = 45g → suggestion : **45g**

### Cas portion trop petite (< 25g suggérée)

Badge "petite quantité" + message doux : *"Ton repas couvre bien les besoins — ajout optionnel"*. Pas de blocage, quantité manuelle toujours possible.

### Suggestion chips inline

Sur la liste d'aliments, badge `~Xg` affiché inline calculé via `suggestFoodQuantity`. Tap sur l'aliment → pré-remplit la quantité avec la suggestion. Aliments `good_fit` via `evaluateFoodCompatibility` : badge vert subtil. Aliments `poor_fit` : pas de blocage, warning discret.

---

## DS v4 — Visual Language "Simulation Mode"

### Couleur signature : `#818cf8` (indigo doux)

Dit "monde parallèle, prévu, pas encore réel".

| Élément | Valeur |
|---------|--------|
| Arc jauge calories | `#818cf8` (au lieu de `#689ffa`) |
| Barres macro fill | `#818cf8` à 60% opacité |
| Bouton "Sauver en prépa" | `bg-[#818cf8]/15 border border-[#818cf8]/25 text-[#818cf8]` |
| Bouton "Valider maintenant" | `bg-[#ffe01e] text-[#0d0d0d]` — seul élément couleur réelle |
| Badge "SIMULATION" | `bg-[#818cf8]/10 border border-[#818cf8]/20 text-[#818cf8] text-[9px] uppercase tracking-[0.18em]` |
| Bouton "Annuler" | `bg-white/[0.04] text-white/40` |

### Texture fond hero

Dot grid très léger (`3%` opacité) sur le hero card — signal subliminal "brouillon / plan".

### Fond page

`#0d0d0d` identique au reste de l'app — pas de changement brutal. La différence vient des accents, pas du fond.

### Logique de contraste

Le bouton "Valider maintenant" reste en jaune `#ffe01e` — seul élément dans la couleur "réelle". Ce contraste signal fort : "cette action te fait quitter le monde simulation pour entrer dans le vrai système."

---

## Règles DS à respecter

- `rounded-2xl` : cards principales, hero
- `rounded-xl` : boutons, inputs, items liste
- `rounded-[2px]` : INTERDIT
- Pas de `shadow-*` colorée
- `font-barlow` body, `font-barlow-condensed` labels uppercase
- `border border-white/[0.08]` max pour borders neutres

---

## Hors scope

- Partage de prep entre clients
- Templates de repas sauvegardés
- Suggestions d'aliments proactives (IA qui suggère sans que l'user cherche)
- Navigation date sur la page compose
