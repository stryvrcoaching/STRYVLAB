# Tempo Guide Modal — Design Spec

**Date :** 2026-05-16  
**Feature :** Guide tempo live dans SessionLogger (style Technogym)  
**Statut :** Approuvé

---

## Objectif

Permettre au client d'activer un guide visuel plein écran qui l'accompagne phase par phase pendant l'exécution d'un set. La balle suit un path sinusoïdal (ECC descend → PB en bas → CON monte → PH en haut), vibration haptique aux transitions, barres de reps style Technogym.

---

## Composant : `TempoGuideModal`

**Fichier :** `components/client/TempoGuideModal.tsx`

### Props

```typescript
interface TempoGuideModalProps {
  tempo: string        // "3-1-2-0" ou "X-0-X-0" — déjà résolu (coach ou défaut)
  reps: number         // reps planifiées, parsées depuis ex.reps (rep_min ?? parseInt)
  exerciseName: string
  onClose: () => void  // appelé à la fin du dernier cycle ET sur fermeture manuelle
}
```

### Comportement général

- S'ouvre en plein écran via `fixed inset-0`
- Entrée : `scale 0.95→1.0 + opacity 0→1`, 200ms ease-out (Framer Motion)
- Sortie : identique, puis `onClose()`
- Se ferme automatiquement à la fin de la dernière rep
- Bouton `[×]` top-right pour fermeture manuelle

---

## Visuel

### Fond

`bg-[#080808]` — plus noir que `#0a0a0a`, contraste maximal pour le jaune `#FFB800`.

### Path SVG sinusoïdal

- Traversée pleine largeur de l'écran, hauteur ~55% du viewport
- Courbe bézier cubique : ECC part haut-gauche, descend (excentrique), PB en bas (pause basse), CON remonte (concentrique), PH en haut (pause haute)
- **Track background :** même path, `stroke-width=28`, `rgba(255,255,255,0.06)` — rail sombre
- **Track glow :** même path, `stroke-width=28`, `rgba(255,184,0,0.08)` — halo jaune subtil sur le rail

```
       ╭──────╮              ╭──────╮
      /  PH   \             /   PH  \
─────╯          ╲─────────╱
  ECC      PB    CON  PB   ECC
```

Positions exactes des 4 points sur le path (normalisées 0.0–1.0) :
- `0.0` : départ ECC (haut gauche)
- `0.25` : transition ECC→PB (bas)
- `0.50` : transition PB→CON (bas)
- `0.75` : transition CON→PH (haut)
- `1.0` : fin PH (haut droite) = début rep suivante

### Balle

- Cercle SVG `r=10px`, fill blanc pur
- `filter: drop-shadow(0 0 14px rgba(255,184,0,0.9))` — glow jaune autour de balle blanche
- Position : `path.getPointAtLength(t * path.getTotalLength())` dans RAF
- Orientation : `path.getPointAtLength((t + 0.001) * length)` → rotation native du SVG element

### Trail (effet comète)

- Buffer circulaire de 10 positions précédentes (mise à jour chaque frame RAF)
- Cercles décroissants : `r = 9→1`, `opacity = 0.35→0.03`
- Même couleur blanche, pas de glow sur le trail
- Rendu via `<circle>` SVG, mutations DOM directes (pas de state React)

### Losanges de transition

- 3 `◇` positionnés aux points `0.25`, `0.50`, `0.75` du path
- Couleur `#FFB800`, taille 12px
- Au passage de la balle : Framer Motion `scale 1.0→1.5→1.0` + `opacity 1.0→0.4→1.0`, spring stiffness 400
- `filter: drop-shadow(0 0 8px #FFB800)` permanent, intensité ×2 au passage

### Label phase active

- Centré sous le circuit, `margin-top: 24px`
- Format : `DESCENTE  3s` — uppercase, font mono, tracking `0.2em`, `text-[13px]`
- Phase active : `text-white`, phases inactives : `text-white/20`
- Changement via `AnimatePresence mode="wait"` + `opacity 0→1` 150ms

### Barres de reps (style Technogym)

- `N` barres en grille horizontale, largeur totale `90vw`, hauteur `36px`, gap `3px`
- Accomplie : `bg-[#FFB800]`
- Courante : `bg-[#FFB800]` + `box-shadow: 0 0 12px rgba(255,184,0,0.6)` pulsant (keyframe 1s)
- Restante : `bg-white/10`
- Transition accomplissement : Framer Motion `scaleY 0.6→1.0` spring stiffness 600

### Footer

- `REP  3 / 8` — `text-[32px] font-black font-mono text-white`, centré sous les barres
- `text-[#FFB800]` sur le numéro courant uniquement

---

## Timing Engine

### Parsing

```typescript
parseTempo("3-1-2-0") → { eccentric: 3, pauseBottom: 1, concentric: 2, pauseTop: 0 }

Durées en ms :
  phase numérique N → N * 1000 ms
  phase "X"          → 300 ms (explosif, balle flash)
  phase 0            → skip (0ms — balle téléporte instantanément au point suivant)
```

### Boucle RAF

```typescript
// Mutations DOM directes — zéro setState dans la boucle
// Seuls changements de phase et de rep triggent setState (pour re-render labels/barres)

const rafRef = useRef<number>()
const pathRef = useRef<SVGPathElement>()
const ballRef = useRef<SVGCircleElement>()
const trailRefs = useRef<SVGCircleElement[]>()

useEffect(() => {
  let startTime: number | null = null
  let currentRep = 0
  let currentPhase = 0

  function tick(now: number) {
    if (!startTime) startTime = now
    // ... timing logic, DOM mutations
    rafRef.current = requestAnimationFrame(tick)
  }

  rafRef.current = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafRef.current!)
}, [])
```

### Easing par phase

| Phase | Easing | Raison |
|-------|--------|--------|
| ECC | `easeInOut` | Descente naturelle, accélère puis freine |
| PB | `linear` | Pause statique |
| CON | `easeInOut` | Montée contrôlée |
| PH | `linear` | Pause haute |

Calcul position sur path : `lerp(phaseStartPct, phaseEndPct, easing(tInPhase))`

### Phases sautées (durée 0)

Si `pauseTop = 0` → phase PH non animée. La balle passe directement de `0.75` à `1.0` (= `0.0` rep suivante) sans délai. Pas de label PH affiché.

---

## Haptique

```typescript
// Vibrations aux transitions (navigator.vibrate — ignoré silencieusement si non supporté)
ECC → PB : navigator.vibrate(40)
PB  → CON : navigator.vibrate(70)   // plus fort : départ du mouvement
CON → PH : navigator.vibrate(40)
Fin rep   : navigator.vibrate([70, 30, 70])
Fin set   : navigator.vibrate([100, 40, 100, 40, 100])
```

---

## Déclencheur dans SessionLogger

### Bouton `▶` par set

- Ajouté dans la row de chaque set, entre les inputs et le bouton ✓
- Style : `h-7 w-7 rounded-lg bg-white/[0.04] text-white/40 hover:text-[#FFB800] hover:bg-white/[0.08] transition-colors`
- Icône : `Play` (Lucide), size 12
- Visible si : `parseTempo(resolvedTempo) !== null && plannedReps > 0`
- `plannedReps` = `parseInt(ex.reps)` si entier pur, sinon `ex.rep_min ?? 8`

### State dans SessionLogger

```typescript
const [tempoGuideTarget, setTempoGuideTarget] = useState<{
  exId: string
  setNum: number
  tempo: string
  reps: number
  exerciseName: string
} | null>(null)
```

```tsx
{tempoGuideTarget && (
  <TempoGuideModal
    tempo={tempoGuideTarget.tempo}
    reps={tempoGuideTarget.reps}
    exerciseName={tempoGuideTarget.exerciseName}
    onClose={() => setTempoGuideTarget(null)}
  />
)}
```

---

## Edge Cases

| Cas | Comportement |
|-----|-------------|
| Tempo `X-X-X-X` | Toutes phases 300ms, balle flash ultra-rapide |
| Phase `0` | Téléportation instantanée, pas de label affiché |
| `reps = 0` | Bouton `▶` masqué |
| `reps` range ex: "8-12" | Utilise `rep_min` (8) |
| Tempo non-parsable | Bouton `▶` masqué |
| `navigator.vibrate` absent | Silencieux, aucune erreur |
| Fermeture manuelle mid-rep | `onClose()` immédiat, RAF cancel |

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `components/client/TempoGuideModal.tsx` | Créer |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modifier — state + bouton ▶ + rendu modal |

---

## Non-inclus (Phase 2 si besoin)

- Son (beep aux transitions) — risque nuisance en salle
- Mode "1 rep boucle infinie" — choisi N reps fixes
- Countdown avant départ (3-2-1) — peut être ajouté dans la modal
- Historique tempo suivi vs prescrit

---

## Invariants

- Aucun state React dans la RAF loop — mutations DOM directes uniquement
- `cancelAnimationFrame` au cleanup `useEffect` — pas de leak
- Modal ne modifie pas les sets logs — guide informatif uniquement
- `parseTempo` déjà existant dans `lib/training/tempo.ts` — réutilisé tel quel
