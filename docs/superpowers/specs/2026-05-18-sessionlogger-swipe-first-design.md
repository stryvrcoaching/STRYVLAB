# SessionLogger — Swipe-First Keyboard-Less Design

**Date :** 2026-05-18  
**Objectif :** Passer de 5-10s/set à <3s/set. Remplacer la grille avec inputs texte par des SwipeCards — swipe gauche = valider, tap = éditer.  
**DS :** v3.0 (`#0d0d0d` bg, `#161616` surface, `#ffe01e` accent)  
**Fichier principal :** `app/client/programme/session/[sessionId]/SessionLogger.tsx`

---

## Contexte

Le SessionLogger actuel affiche une grille `# | REP | KG | RIR | ▶ | ✓` avec 3 inputs `<input type="number">` par set. La recommendation engine pré-remplit déjà les valeurs. Le client doit taper manuellement même quand les valeurs sont correctes.

Pattern cible : MacroFactor Workouts + Strong app — swipe natif, zéro clavier sauf correction explicite.

---

## Section 1 — SwipeCard par set

### Structure carte (état non validé)

```
┌─────────────────────────────────────────────────────┐
│  SET 1                                              │
│                                                     │
│   ┌────────┐    ┌──────────┐    ┌─────────┐        │
│   │   8    │    │  80 kg   │    │  RIR 2  │        │
│   └────────┘    └──────────┘    └─────────┘        │
│   reps          poids            cible              │
│                                                     │
│                                       ← swipe       │
└─────────────────────────────────────────────────────┘
```

**Valeurs affichées :**
- Reps : `rec.reps ?? planned_reps` — grand (`text-[28px] font-black`)
- Poids : `rec.weight_kg ?? current_weight_kg` — grand (`text-[28px] font-black`)
- RIR cible : `ex.target_rir ?? ex.rir` — `text-[18px] font-bold text-white/60`
- Si recommendation → badge delta `↑ +2.5kg` en jaune sous le poids

**Layout card :**
```
bg-[#161616] rounded-2xl border border-white/[0.08] p-5
grid grid-cols-3 gap-4 items-center
```

**Header card :**
```
text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30
"SET {n}"  +  badge PR si prSets.has(key)
```

### Swipe mechanics

**Framer Motion `drag="x"`**
```ts
dragConstraints={{ left: -300, right: 0 }}
dragElastic={{ left: 0.1, right: 0 }}
```

**Feedback visuel en temps réel (useMotionValue + useTransform) :**
```ts
const x = useMotionValue(0)
const bgOpacity = useTransform(x, [-120, -60, 0], [0.15, 0.08, 0])
const borderColor = useTransform(x, [-120, -60, 0], ['#10b981', '#ffe01e', 'rgba(255,255,255,0.08)'])
const checkOpacity = useTransform(x, [-120, -60, 0], [1, 0.3, 0])
```

**Seuils :**
- `x < -80px` → feedback vert (#10b981) → "Glisse pour valider"
- `x < -140px` → validation automatique au release
- Release entre -80 et -140 → spring back à 0 (`stiffness: 400, damping: 30`)
- Release > -140 → spring à x=-400 (offscreen) → état validé

**Haptic :**
```ts
if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
  navigator.vibrate(40)
}
```

**Hint swipe (premier set uniquement) :**
- `←` animée en `opacity: [0.6, 0.2, 0.6]` loop infini
- Disparaît après le premier swipe validé (`localStorage: 'swipe_hint_seen'`)

### État validé

```
┌─────────────────────────────────────────────────────┐
│  ✓  SET 1   8 × 80 kg   RIR —     ⚡ PR    [éditer] │
└─────────────────────────────────────────────────────┘
```

**Styles :**
```
bg-[#ffe01e]/[0.06] border border-[#ffe01e]/20 rounded-xl px-4 py-3
flex items-center gap-3 (compact, 1 ligne)
```

**Contenu :**
- `✓` icon `CheckCircle2` jaune 16px
- `SET {n}` label muted
- `{reps} × {weight}kg` — texte blanc semibold
- `RIR {rir_actual}` si saisi, sinon `—`
- Badge PR `⚡ PR` si prSets.has(key)
- Bouton `[éditer]` → `SetEditSheet`
- Coaching cue italic si non-null

---

## Section 2 — SetEditSheet (correction post-validation)

Bottom sheet déclenchée par tap sur un set validé ou sur le bouton `[éditer]`.

**Header :**
```
"Modifier — SET {n} — {exercise.name}"
drag handle pill + X button
```

**Contenu (3 roues ou inputs numériques) :**

Approche retenue : **stepper buttons** (plus fiable sur mobile que les roues natives) :

```
┌─────────────────────────────────────┐
│  REPS                               │
│  [−]  [  8  ]  [+]                 │
│                                     │
│  POIDS (kg)                         │
│  [−]  [ 80.0 ]  [+]  step: 2.5     │
│                                     │
│  RIR (0–10)                         │
│  [−]  [  2  ]  [+]                  │
│                                     │
│  [Confirmer]  (yellow CTA)          │
└─────────────────────────────────────┘
```

**Step par défaut poids :** `ex.weight_increment_kg ?? 2.5`

**Motion sheet :**
```ts
initial: { y: '100%' }
animate: { y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }
exit:    { y: '100%', transition: { duration: 0.18 } }
```

**Z-index :** sheet `z-[70]`, backdrop `z-[65]`

**On confirm :**
1. `updateSet(exId, setNum, side, { actual_reps, actual_weight_kg, rir_actual })`
2. Re-déclenche PR detection sur les nouvelles valeurs
3. Ferme le sheet

---

## Section 3 — Supersets

Les supersets affichent les exercices par round. Même pattern SwipeCard par set, mais groupés sous un header round.

**Structure round :**
```
Round 1
  SwipeCard — Exercice A, Set 1
  SwipeCard — Exercice B, Set 1

Round 2
  SwipeCard — Exercice A, Set 2
  SwipeCard — Exercice B, Set 2
```

La SwipeCard en mode superset est identique à la version solo, sauf :
- Header affiche le nom de l'exercice (plus "SET N")
- Couleur border = `supersetColors[group_id]` (amber/violet/etc.) au lieu de white/[0.08]
- Validation indépendante par exercice (pas un swipe group entier)

---

## Section 4 — Exercices unilatéraux

Exercice unilatéral = 2 SwipeCards côte à côte (ou empilées selon viewport) :

```
┌──────────────────┐  ┌──────────────────┐
│  GAUCHE — SET 1  │  │  DROITE — SET 1  │
│  8 × 30kg        │  │  8 × 30kg        │
│  RIR 2           │  │  RIR 2           │
│  ← swipe         │  │  ← swipe         │
└──────────────────┘  └──────────────────┘
```

Sur petits écrans (<360px) : empilées verticalement.

Header badge : `G` (blue-400) / `D` (violet-400) — identique à l'actuel `sideLabel()`.

---

## Section 5 — Architecture composants

### Nouveau composant : `SetSwipeCard`

**Fichier :** `components/client/smart/SetSwipeCard.tsx`

```ts
interface SetSwipeCardProps {
  set: SetLog
  exercise: Exercise
  recommendation: SetRecommendation | undefined
  lastPerf: LastPerf | null
  isPR: boolean
  isFirstEver: boolean        // pour le hint swipe
  coachingCue: string | null
  onValidate: () => void      // appelé après snap complet
  onEditRequest: () => void   // tap sur carte validée
  onTempoGuide: () => void
  goal: string
}
```

**Responsabilité unique :** affichage + gesture d'une seule carte set. Aucune logique métier interne — tout passe par les callbacks.

### Nouveau composant : `SetEditSheet`

**Fichier :** `components/client/smart/SetEditSheet.tsx`

```ts
interface SetEditSheetProps {
  open: boolean
  set: SetLog
  exercise: Exercise
  onConfirm: (reps: string, weight: string, rir: string) => void
  onClose: () => void
}
```

### Modifications `SessionLogger.tsx`

- Supprimer la grille `<div className="grid...">` (lines ~1171-1260)
- Remplacer par `<SetSwipeCard>` pour chaque set
- Ajouter state `editingSet: { exId, setNum, side } | null`
- Ajouter `<SetEditSheet>` conditionnel

**Logique inchangée :** `toggleSet`, `updateSet`, `recommendNextSet`, `prSets`, `prFlash`, `getCoachingCue`, `buildInitialSets`, live save, rest timer, hydration — tout reste intact.

---

## Section 6 — Fichiers & Changements

| Fichier | Action | Description |
|---------|--------|-------------|
| `components/client/smart/SetSwipeCard.tsx` | Créer | Carte set swipeable |
| `components/client/smart/SetEditSheet.tsx` | Créer | Bottom sheet édition post-validation |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modifier | Remplacer grille par SetSwipeCard, ajouter SetEditSheet |

**Inchangés :**
- `lib/training/setRecommendation.ts`
- `lib/training/tempo.ts`
- `app/api/session-logs/`
- Tous les autres composants

---

## Contraintes DS v3.0

- Background : `#0d0d0d`
- Surface : `#161616`
- Accent : `#ffe01e` (validation feedback, PR badges)
- Succès : `#10b981` (feedback swipe en cours)
- `rounded-2xl` → cartes non validées
- `rounded-xl` → cartes validées (compact)
- `rounded-2xl` → SetEditSheet
- Aucune shadow colorée
- Steppers : `bg-white/[0.06] rounded-xl h-11 w-11`

---

## Métriques de succès

- Validation set sans correction : **1 geste, <2s**
- Validation set avec correction : **swipe + tap + 3 taps steppers + confirm, <8s**
- Objectif global : **<3s/set en moyenne** (vs 5-10s actuels)
