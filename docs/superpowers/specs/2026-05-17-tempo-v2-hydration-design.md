# Tempo v2 + Hydratation — Design Spec

**Date:** 2026-05-17  
**Status:** Approved  
**Scope:** TempoGuideModal refonte visuelle + Sync IA + Reps bonus + Rappel hydratation

---

## Contexte

Retour terrain après test réel de la feature tempo. 7 problèmes identifiés. Ce spec couvre la résolution complète en 6 axes + support landscape.

Fichiers principaux concernés :
- `components/client/TempoGuideModal.tsx` — refonte visuelle complète
- `app/client/programme/session/[sessionId]/SessionLogger.tsx` — sync IA, reps bonus feed, hydratation
- `lib/training/tempo.ts` — aucun changement (invariants conservés)

---

## Axe 1 — Circuit fermé : triangle pyramidal

### Problème
Path SVG actuel = arche ouverte. Balle snape instantanément de droite vers gauche entre ECC→CON. Rupture de continuité visuelle, pas d'anticipation.

### Solution
Remplacer l'arche par un triangle fermé. Balle trace 3 côtés en continu, jamais de discontinuité.

### Géométrie
```
Sommets (dans viewBox 300×280) :
  A = (150, 40)   — sommet ISO (haut centre)
  B = (280, 240)  — base droite (fin ECC / début PAUSE)
  C = (20, 240)   — base gauche (fin PAUSE / début CON)

Segments et phases :
  CON   : C → A  (montée gauche, durée = tempo[0] secondes)
  ISO   : point A  (maintien au sommet, durée = tempo[1] secondes)
  ECC   : A → B  (descente droite, durée = tempo[2] secondes)
  PAUSE : B → C  (retour horizontal bas, durée = tempo[3] secondes)
```

Path SVG : `M 20 240 L 150 40 L 280 240 Z` (triangle fermé, stroke only).

Balle : cercle `r=10` animé via RAF loop sur le périmètre du triangle. Position calculée par interpolation linéaire sur chaque segment selon `timeInPhase / phaseDuration`.

### Invariants
- PAUSE = 0 → balle reste 0s à B, repart immédiatement vers C (pas de snap)
- ISO = 0 → balle passe instantanément au sommet A sans pause
- Les durées respectent exactement le tempo parsé par `parseTempo()`

---

## Axe 2 — Codes couleurs + labels de phase

### Mapping
| Phase | Couleur balle | Label | Couleur label |
|-------|--------------|-------|---------------|
| CON | `#22c55e` | CONTRACTER | `#22c55e` |
| ISO | `#ef4444` | TENIR | `#ef4444` |
| ECC | `#f97316` | FREINER | `#f97316` |
| PAUSE | `#ef4444` | PAUSE | `#ef4444` |

### Affichage label
- Position : centré sous le triangle
- Typographie : `font-barlow-condensed font-bold uppercase tracking-[0.18em] text-2xl`
- Transition couleur : interpolation CSS `transition-colors duration-150`

### Couleur balle
- Fill + stroke de la balle interpolent vers la couleur de phase active
- Transition : 150ms ease-in-out
- Trail comète existant : couleur suit la balle (opacity dégradée)

---

## Axe 3 — Anticipation isométrique (multi-canal)

### Déclenchement
Quand `timeInPhase / phaseDuration > 1 - (0.8 / phaseDuration)` ET phase suivante est ISO (durée > 0) :

1. **Easing balle** : passer de easing normal à `cubic-bezier(0.0, 0.0, 0.2, 1)` (décélération agressive)
2. **Label** : virer orange `#f97316` → clignoter 2× à 4Hz → rouge `#ef4444` au contact sommet
3. **Haptique** (si `hapticsEnabled`) : vibration `navigator.vibrate(10)` — courte, non intrusive

Même logique pour fin de PAUSE → CON si ISO au sommet existe.

### Implémentation RAF
```ts
// Dans la RAF loop, après calcul de timeInPhase / phaseDuration
const nextPhaseIsIso = (currentPhase === 'CON' && isoSeconds > 0) 
                    || (currentPhase === 'PAUSE' && isoSeconds > 0)
const anticipationThreshold = 1 - (0.8 / currentPhaseDuration)
const isAnticipating = ratio > anticipationThreshold && nextPhaseIsIso
```

---

## Axe 4 — Reps bonus (mode relais)

### Comportement
Quand `currentRep > props.reps` (reps planifiées atteintes) : tempo continue automatiquement sans interruption. Aucune action utilisateur requise.

### State interne TempoGuideModal
```ts
const [bonusReps, setBonusReps] = useState(0)
// Au passage de chaque rep :
if (newRep > props.reps) setBonusReps(prev => prev + 1)
// Pas de condition de stop basée sur props.reps
```

### Affichage barres reps
```
Reps planifiées : barres #ffe01e (jaune accent DS v3.0)
Reps bonus      : barres rgba(255,255,255,0.3) (gris secondaire)
```
Les barres bonus s'ajoutent dynamiquement à droite au fur et à mesure.

### Feed vers SessionLogger
`onClose` callback enrichi :
```ts
onClose: (result: { plannedReps: number; bonusReps: number; totalReps: number }) => void
```

Dans SessionLogger, si `result.bonusReps > 0` :
- Override `actual_reps` du set courant avec `result.totalReps`
- Marqué comme "saisi" (non re-overridable par recommandation IA)

---

## Axe 5 — Sync IA ↔ Tempo

### Problème
`resolveReps(ex)` lit `ex.reps` (prescription fixe). Si recommandation IA dit 12 reps mais `ex.reps = "10"`, tempo tourne sur 10.

### Solution
Au tap ▶ dans SessionLogger, résoudre les reps depuis la recommandation si disponible :

```ts
const recKey = recKey(ex.id, setNum, side)
const rec = recommendations[recKey]
const repCount = rec?.reps ?? resolveReps(ex)
// repCount passé à setTempoGuideTarget({ ..., reps: repCount })
```

`resolveReps` inchangée — reste fallback quand pas de recommandation.

S'applique aux deux points de déclenchement tempo dans SessionLogger (set solo ligne ~1115, set superset ligne ~1283).

---

## Axe 6 — Rappel hydratation

### Calcul au mount SessionLogger
```ts
function calcHydrationPlan(weightKg: number, durationMin: number) {
  const totalMl = weightKg * 35 + durationMin * 8  // EFSA + sudation effort modéré
  const intervalMin = 15
  const sips = Math.max(1, Math.floor(durationMin / intervalMin))
  const mlPerSip = Math.round(totalMl / sips)
  return { totalMl, intervalMin, mlPerSip }
}
// Fallback si weightKg absent : 70kg
// Fallback si durationMin absent : 60min (estimation séance standard)
```

`weightKg` : lu depuis prop `clientWeight` (à ajouter à SessionLogger props, passé depuis la page server-side via profil client).

### UX dans SessionLogger
- Icône `Droplets` (Lucide) apparaît dans le header, `animate-pulse`, `text-blue-400`
- Tap → bottom sheet minimaliste (z-[60]) :
  - Titre : `"Hydratation"`
  - Message : `"Bois environ ${mlPerSip}ml"`
  - Bouton primaire `"J'ai bu"` (bg `#ffe01e`, texte `#0d0d0d`) → dismiss + reset 15min
  - Bouton secondaire `"Ignorer"` (texte blanc/50) → dismiss + reset 5min
- Sheet s'ouvre automatiquement à chaque interval (si SessionLogger est au premier plan)

### Pas de persistance DB en MVP
Compteur `sipsConsumed` en state local uniquement. Phase 2 : table `hydration_logs`.

### Timer
```ts
const hydrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
// Au mount : setInterval(() => setShowHydration(true), intervalMin * 60 * 1000)
// Reset après tap : clearInterval + setInterval avec nouveau délai
```

---

## Axe 7 — Mode Paysage (Landscape)

### Problème
Modal plein écran. En landscape iPhone, hauteur viewport ~375px. Triangle (h≈240px) + barres + label = overflow.

### Layout conditionnel
```tsx
// Hook détection orientation
function useIsLandscape() {
  const [landscape, setLandscape] = useState(false)
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return landscape
}
```

**Portrait (défaut)** : colonne verticale, triangle centré haut, barres + label en bas.

**Landscape** : split horizontal `flex-row` :
```
┌─────────────────┬──────────────────┐
│  Triangle SVG   │  Label phase     │
│  w=45vw         │  "CONTRACTER"    │
│  h=80vh         │  ──────────      │
│                 │  Barres reps     │
│                 │  (flex-col)      │
│                 │  [Fermer]        │
└─────────────────┴──────────────────┘
```

SVG `viewBox` inchangé — redimensionnement via CSS container. Triangle se scale correctement.

Barres reps en landscape : `flex-col` (barres horizontales empilées) au lieu de `flex-row` (barres verticales côte-à-côte) pour tenir dans la colonne droite.

Bouton fermer en landscape : bas de colonne droite, `mt-auto`.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `components/client/TempoGuideModal.tsx` | Refonte complète (path SVG, couleurs, anticipation, reps bonus, landscape) |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Sync IA reps, feed bonusReps, hydratation state + UI |
| `app/client/programme/session/[sessionId]/page.tsx` | Passer `clientWeight` depuis profil client |

## Fichiers non impactés
- `lib/training/tempo.ts` — invariants conservés, aucune modification
- `lib/training/setRecommendation.ts` — aucune modification

---

## Tests à valider après implémentation

- [ ] Triangle : balle ne snape jamais, PAUSE = 0 → retour immédiat sans discontinuité
- [ ] Couleurs : chaque phase affiche bon label + bonne couleur balle
- [ ] Anticipation : signal 0.8s avant ISO visible + haptic déclenché
- [ ] Reps bonus : tempo ne s'arrête pas à N, barres bonus grises ajoutées
- [ ] Feed bonusReps : `actual_reps` set = totalReps si bonus > 0
- [ ] Sync IA : tempo utilise `rec.reps` quand recommandation disponible
- [ ] Hydratation : bottom sheet apparaît à 15min, reset correct selon action
- [ ] Landscape : layout split, pas d'overflow, triangle scale correct
- [ ] Portrait → Landscape en cours de séance : layout switch sans crash
