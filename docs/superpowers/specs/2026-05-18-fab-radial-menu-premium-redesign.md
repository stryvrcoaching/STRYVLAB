# FAB RadialActionMenu — Premium Redesign

**Date :** 2026-05-18  
**Scope :** `RadialActionMenu.tsx` refactor in-place + `MealLogSheet` bottom sheet + `NutritionLogContent` extraction  
**DS :** v3.0 (`#0d0d0d` bg, `#161616` surface, `#ffe01e` accent, radius hiérarchie stricte)

---

## Contexte

Le `RadialActionMenu` actuel affiche 4 boutons carrés (`w-16 h-16 rounded-2xl`) en arc avec des angles non uniformes (-135, -100, -80, -45°) et un radius 110px. Résultat perçu comme cheap, mal centré, pas premium. L'action "Repas" navigue vers `/client/nutrition/log` (sort de la page courante) alors que Eau et Activité restent en modal inline.

**Objectif :** Unifier en tout-modal, refaire la géométrie et le motion en premium.

---

## Section 1 — Géométrie & Motion

### Arc 120°, 4 boutons cercles

Centré sur le FAB. Arc de **-150° à -30°** (axe X positif, sens trigonométrique), spacing uniforme 40° entre chaque bouton.

```
Angles :
  meal     → -150°  (gauche)
  water    → -110°
  activity →  -70°
  checkin  →  -30°  (droite)
```

**Radius :** 96px (réduit depuis 110px — évite débordement viewport petits écrans).

**Boutons :**
```
w-14 h-14
rounded-full
bg-[#161616]
border border-white/[0.08]
flex items-center justify-center
active:scale-95 transition-transform
```

Icône : 24px Phosphor, weight `regular`, `text-white`.

### Motion Spring (Framer Motion)

```ts
// Apparition
initial: { opacity: 0, x: 0, y: 0, scale: 0.5 }
animate: {
  opacity: 1, x, y, scale: 1,
  transition: {
    delay: i * 0.035,
    type: 'spring',
    stiffness: 420,
    damping: 26,
    mass: 0.8,
  }
}

// Disparition
exit: {
  opacity: 0, x: 0, y: 0, scale: 0.5,
  transition: { duration: 0.15, ease: 'easeIn' }
}
```

### Backdrop

```
bg-black/50 backdrop-blur-[2px]
```

Léger blur — contexte de page visible derrière, pas opaque.

### Calcul positions (runtime)

```ts
const rad = (angleDeg * Math.PI) / 180
const x = Math.cos(rad) * RADIUS   // RADIUS = 96
const y = Math.sin(rad) * RADIUS
```

Positionné via `style={{ left: '50%', bottom: NAV_HEIGHT }}` avec `transform: translate(-50%, 0)` sur le conteneur des boutons — garantit centrage parfait sur tout viewport.

---

## Section 2 — MealLogSheet

Bottom sheet embarqué dans `RadialActionMenu.tsx`. Remplace `router.push('/client/nutrition/log')`.

### Architecture

```
fixed inset-0 z-[55]         ← backdrop sheet (AnimatePresence)
  motion.div                 ← sheet principale
    fixed bottom-0 left-0 right-0
    max-h-[88vh]
    bg-[#161616]
    rounded-t-2xl
    border-t border-white/[0.08]
    flex flex-col
    z-[60]

    ├─ Header (shrink-0)
    │    drag handle pill (w-10 h-1 rounded-full bg-white/[0.12] mx-auto mt-3)
    │    titre "Ajouter un repas" (text-[13px] font-bold text-white)
    │    bouton X (h-7 w-7 rounded-lg bg-white/[0.06])
    │
    └─ <NutritionLogContent /> (overflow-y-auto flex-1)
         onSuccess callback → ferme la sheet
```

### Motion sheet

```ts
initial: { y: '100%' }
animate: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }
exit:    { y: '100%', transition: { duration: 0.2, ease: 'easeIn' } }
```

### Fermeture

- Tap bouton X
- Tap backdrop sheet
- Submit réussi dans `NutritionLogContent` (via callback `onSuccess`)

### Z-index hiérarchie

| Couche | z-index |
|--------|---------|
| RadialMenu backdrop | 40 |
| MealLogSheet backdrop | 55 |
| MealLogSheet panel | 60 |
| QuickWaterModal | 80–90 (inchangé) |

---

## Section 3 — Fichiers & Changements

### Modifiés

**`components/client/smart/RadialActionMenu.tsx`**
- Boutons : `rounded-2xl w-16 h-16` → `rounded-full w-14 h-14`
- Angles : `-135/-100/-80/-45` → `-150/-110/-70/-30`
- Radius : `110` → `96`
- Motion spring : `stiffness 380/damping 28` → `420/26/mass 0.8`, exit `duration 0.15`
- Action `meal` : `router.push(...)` → `setMealSheetOpen(true)`
- Ajouter state `mealSheetOpen: boolean`
- Ajouter `<MealLogSheet>` en fin de composant
- Supprimer import `useRouter` si plus utilisé

**`app/client/nutrition/log/page.tsx`**
- Extraire logique + UI dans `NutritionLogContent.tsx` (même dossier)
- Page devient wrapper minimal : `<NutritionLogContent onSuccess={() => router.push('/client/nutrition/journal')} />`

### Créés

**`components/client/smart/MealLogSheet.tsx`**
```ts
interface MealLogSheetProps {
  open: boolean
  onClose: () => void
}
```
- Bottom sheet avec header fixe + `<NutritionLogContent onSuccess={onClose} />`
- AnimatePresence, motion spring

**`app/client/nutrition/log/NutritionLogContent.tsx`**
```ts
interface NutritionLogContentProps {
  onSuccess?: () => void  // appelé après submit réussi
}
```
- Contient toute la logique actuelle de `page.tsx` (state, 4 layers, draft, submit)
- `onSuccess` déclenché après POST `/api/client/nutrition/meals` réussi

### Inchangés

- `components/client/BottomNav.tsx`
- `components/client/QuickWaterModal.tsx`
- `components/client/smart/FreeActivitySheet.tsx`
- Toutes les API routes

### Comportement final

| Action | Avant | Après |
|--------|-------|-------|
| Repas | `router.push('/client/nutrition/log')` | `MealLogSheet` bottom sheet inline |
| Eau | `QuickWaterModal` inline | identique |
| Activité | `FreeActivitySheet` inline | identique |
| Check-in | `router.push('/client/checkin/onboarding')` | identique |

---

## Contraintes DS v3.0

- Background : `#0d0d0d`
- Surface : `#161616`
- Accent : `#ffe01e` (FAB uniquement)
- Radius : `rounded-full` boutons action, `rounded-t-2xl` sheet, `rounded-lg` icônes/badges
- Borders : `border border-white/[0.08]`
- Aucun `shadow-*` coloré, aucun gradient en fond de card
- Labels uppercase si présents : `font-barlow-condensed font-bold uppercase tracking-[0.18em]`

---

## Non-scope

- Ajout de nouvelles actions dans le menu
- Refonte du FAB lui-même (couleur, taille — reste `#ffe01e w-10 h-10`)
- Refonte de `QuickWaterModal` ou `FreeActivitySheet`
- Check-in flow
