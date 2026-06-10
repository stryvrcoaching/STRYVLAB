# Tempo v2 + Hydratation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complète du TempoGuideModal (circuit triangle fermé, codes couleurs, anticipation isométrique, reps bonus, landscape) + sync IA↔tempo + rappel hydratation dans SessionLogger.

**Architecture:** TempoGuideModal est entièrement réécrit — même interface Props externe, `onClose` enrichi avec `{ plannedReps, bonusReps, totalReps }`. SessionLogger reçoit `clientWeight?: number` depuis page.tsx, et la logique de déclenchement tempo est mise à jour pour lire les reps depuis les recommandations IA. L'hydratation est un timer local + bottom sheet dans SessionLogger.

**Tech Stack:** React RAF loop, SVG path geometry, Framer Motion AnimatePresence, Lucide icons, Tailwind CSS, TypeScript strict.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/client/TempoGuideModal.tsx` | Rewrite | Triangle SVG, couleurs phases, anticipation ISO, reps bonus, landscape |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modify | Sync IA reps, feed bonusReps → actual_reps, hydratation timer + sheet |
| `app/client/programme/session/[sessionId]/page.tsx` | Modify | Fetch clientWeight, passer à SessionLogger |

**Fichiers non touchés:** `lib/training/tempo.ts`, `lib/training/setRecommendation.ts`

---

## Task 1: Triangle SVG + RAF loop de base

**Files:**
- Modify: `components/client/TempoGuideModal.tsx`

Réécrire le path SVG et la RAF loop pour utiliser le triangle fermé. Pas encore de couleurs ni d'anticipation — juste la géométrie correcte et la continuité de la balle.

- [ ] **Step 1: Remplacer les constantes de géométrie**

Remplacer les constantes `PATH_D`, `T_BASE_LEFT`, `T_PEAK`, `T_BASE_RIGHT` par la géométrie triangle. Aussi supprimer `MOTION_PHASES`, `STATIC_PHASES` — remplacés par la logique de phase directe.

```tsx
// Sommets du triangle (viewBox 300×280)
const TRI_A = { x: 150, y: 40  }  // sommet ISO (haut centre)
const TRI_B = { x: 280, y: 240 }  // base droite (fin ECC)
const TRI_C = { x: 20,  y: 240 }  // base gauche (fin PAUSE / début CON)

// Path triangle fermé
const PATH_D = `M ${TRI_C.x} ${TRI_C.y} L ${TRI_A.x} ${TRI_A.y} L ${TRI_B.x} ${TRI_B.y} Z`

// Longueurs de segments (pour interpolation sans getPointAtLength)
function segLen(p1: {x:number,y:number}, p2: {x:number,y:number}) {
  return Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)
}
const SEG_CON   = segLen(TRI_C, TRI_A)  // C→A
const SEG_ISO   = 0                      // point fixe
const SEG_ECC   = segLen(TRI_A, TRI_B)  // A→B
const SEG_PAUSE = segLen(TRI_B, TRI_C)  // B→C

// Interpolation linéaire entre deux points
function lerpPt(p1: {x:number,y:number}, p2: {x:number,y:number}, t: number) {
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }
}
```

- [ ] **Step 2: Mettre à jour le viewBox SVG**

```tsx
// Remplacer viewBox="0 0 400 185" par :
viewBox="0 0 300 280"
```

- [ ] **Step 3: Réécrire la logique de position balle dans la RAF loop**

Remplacer tout le bloc `let pathT: number` + `pathRef.current.getPointAtLength(pathT * totalLen)` par interpolation directe sur les segments du triangle.

```tsx
// Dans tick(), après détermination de phase et tInPhaseFrac :
let ballPos: { x: number; y: number }

if (phase === 0) {
  // CON: C → A, ease-out quad
  const eased = tInPhaseFrac * (2 - tInPhaseFrac)
  ballPos = lerpPt(TRI_C, TRI_A, eased)
} else if (phase === 1) {
  // ISO: frozen at A
  ballPos = TRI_A
} else if (phase === 2) {
  // ECC: A → B, ease-in quad
  const eased = tInPhaseFrac * tInPhaseFrac
  ballPos = lerpPt(TRI_A, TRI_B, eased)
} else {
  // PAUSE: B → C, linear (retour naturel)
  ballPos = lerpPt(TRI_B, TRI_C, tInPhaseFrac)
}

ballRef.current.setAttribute('cx', String(ballPos.x))
ballRef.current.setAttribute('cy', String(ballPos.y))
ballGlowRef.current.setAttribute('cx', String(ballPos.x))
ballGlowRef.current.setAttribute('cy', String(ballPos.y))
```

- [ ] **Step 4: Supprimer les refs pathRef et les appels getTotalLength / getPointAtLength**

Le `pathRef` n'est plus nécessaire pour la mesure — la géométrie est calculée analytiquement. Supprimer `pathRef` et `pathRef.current.getTotalLength()` partout. Conserver le `<path>` SVG visible (stroke) mais supprimer le path invisible de mesure.

- [ ] **Step 5: Mettre à jour les diamants de transition**

Les diamonds de pic et de base droite doivent se positionner aux nouveaux sommets du triangle :

```tsx
// Diamond sommet ISO (A)
<polygon
  ref={peakDiamondRef}
  points="-8,0 0,-8 8,0 0,8"
  fill={ACCENT}
  opacity="0.55"
  transform={`translate(${TRI_A.x}, ${TRI_A.y})`}
/>

// Diamond base droite (B)
<polygon
  ref={baseRDiamondRef}
  points="-8,0 0,-8 8,0 0,8"
  fill={ACCENT}
  opacity="0.40"
  transform={`translate(${TRI_B.x}, ${TRI_B.y})`}
/>

// Diamond base gauche (C) — nouveau, marque début CON
<polygon
  ref={baseLDiamondRef}
  points="-8,0 0,-8 8,0 0,8"
  fill={ACCENT}
  opacity="0.40"
  transform={`translate(${TRI_C.x}, ${TRI_C.y})`}
/>
```

Ajouter `baseLDiamondRef = useRef<SVGPolygonElement>(null)`.

- [ ] **Step 6: Mettre à jour le trail comète**

Remplacer le shift de trail basé sur `getPointAtLength` par les positions directes `ballPos` :

```tsx
// Dans tick(), après calcul de ballPos :
// Shift trail
for (let i = TRAIL_LEN - 1; i > 0; i--) {
  const prev = trailRefs.current[i - 1]
  if (prev) {
    trailRefs.current[i]?.setAttribute('cx', prev.getAttribute('cx') ?? '0')
    trailRefs.current[i]?.setAttribute('cy', prev.getAttribute('cy') ?? '0')
  }
}
trailRefs.current[0]?.setAttribute('cx', String(ballPos.x))
trailRefs.current[0]?.setAttribute('cy', String(ballPos.y))

// Masquer trail pendant ISO et PAUSE (phases statiques)
const isStaticPhase = (phase === 1 || phase === 3) && phaseDurations[phase] > 200
trailRefs.current.forEach((el, i) => {
  if (!el) return
  if (isStaticPhase) {
    el.setAttribute('opacity', '0')
  } else {
    el.setAttribute('opacity', String(((TRAIL_LEN - i) / TRAIL_LEN) * 0.30))
    el.setAttribute('r', String(Math.max(14 - i * 1.3, 2)))
  }
})
```

- [ ] **Step 7: Vérifier visuellement**

Lancer `npm run dev`, naviguer sur une séance, taper ▶ sur un exercice avec tempo. Vérifier :
- La balle trace un triangle continu
- Pas de snap/discontinuité lors du retour PAUSE (B→C)
- La balle passe correctement par les 3 sommets

- [ ] **Step 8: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo): replace open arch with closed triangle path"
```

---

## Task 2: Codes couleurs + labels de phase

**Files:**
- Modify: `components/client/TempoGuideModal.tsx`

- [ ] **Step 1: Définir la table couleurs/labels par phase**

```tsx
// Remplacer PHASE_LABELS et PHASE_SUBLABELS par :
const PHASE_CONFIG = [
  { label: 'CONTRACTER', color: '#22c55e' },  // CON
  { label: 'TENIR',      color: '#ef4444' },  // ISO
  { label: 'FREINER',    color: '#f97316' },  // ECC
  { label: 'PAUSE',      color: '#ef4444' },  // PAUSE
] as const

// Supprimer const ACCENT = '#FFB800' — remplacé par couleur dynamique par phase
// Garder ACCENT_TEMPO = '#FFB800' pour le comptdown et le GO flash (inchangés)
const ACCENT_TEMPO = '#FFB800'
```

- [ ] **Step 2: Ajouter state couleur courante**

```tsx
const [phaseColor, setPhaseColor] = useState(PHASE_CONFIG[0].color)
```

Mettre à jour `phaseColor` dans la RAF loop lors du changement de phase :

```tsx
// Dans le bloc if (phase !== lastPhaseRef.current) :
setPhaseColor(PHASE_CONFIG[phase].color)
```

- [ ] **Step 3: Appliquer couleur au label de phase**

Dans le JSX du label, remplacer `color: ACCENT` par `color: phaseColor` :

```tsx
<span
  className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-2xl transition-colors duration-150"
  style={{ color: countdown !== null ? ACCENT_TEMPO : phaseColor }}
>
  {countdown !== null ? 'PRÊT' : PHASE_CONFIG[currentPhase].label}
</span>
```

Supprimer le sous-label `PHASE_SUBLABELS` — remplacé par le label unique coloré.

- [ ] **Step 4: Appliquer couleur à la balle**

Dans la RAF loop, remplacer la logique `isStatic` / `fill: 'white'` / `fill: ACCENT` par la couleur de phase :

```tsx
// Dans tick(), après calcul de ballPos :
const currentColor = PHASE_CONFIG[phase].color
ballRef.current.setAttribute('fill', currentColor)
ballRef.current.style.filter = `drop-shadow(0 0 18px ${currentColor}99) drop-shadow(0 0 6px ${currentColor}cc)`
ballGlowRef.current.setAttribute('fill', currentColor)

// Pulse sur phases statiques (ISO et PAUSE durée > 200ms)
const isStaticPhase = (phase === 1 || phase === 3) && phaseDurations[phase] > 200
if (isStaticPhase) {
  const r = 18 + tInPhaseFrac * 4
  ballRef.current.setAttribute('r', String(r))
  ballGlowRef.current.setAttribute('r', String(28 + tInPhaseFrac * 8))
  ballGlowRef.current.setAttribute('opacity', String(0.20 + tInPhaseFrac * 0.22))
} else {
  ballRef.current.setAttribute('r', '18')
  ballGlowRef.current.setAttribute('r', '28')
  ballGlowRef.current.setAttribute('opacity', '0.18')
}
```

- [ ] **Step 5: Mettre à jour les barres reps**

Les barres reps utilisaient `ACCENT` (#FFB800). Remplacer par `#ffe01e` (DS v3.0 accent) pour les reps planifiées :

```tsx
animate={{
  backgroundColor: isDone || isCurrent ? '#ffe01e' : 'rgba(255,255,255,0.10)',
  boxShadow: isCurrent ? `0 0 14px rgba(255,224,30,0.6), 0 0 4px rgba(255,224,30,0.9)` : 'none',
  ...
}}
```

- [ ] **Step 6: Vérifier visuellement**

Confirmer que chaque phase affiche le bon label et la bonne couleur. CON=vert, ISO=rouge, ECC=orange, PAUSE=rouge.

- [ ] **Step 7: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo): phase color codes + barlow-condensed labels per phase"
```

---

## Task 3: Anticipation isométrique (multi-canal)

**Files:**
- Modify: `components/client/TempoGuideModal.tsx`

- [ ] **Step 1: Ajouter state anticipation**

```tsx
const [isAnticipating, setIsAnticipating] = useState(false)
const anticipationFiredRef = useRef(false)  // pour ne déclencher haptic qu'une fois par phase
```

- [ ] **Step 2: Calculer et déclencher l'anticipation dans la RAF loop**

Dans `tick()`, après calcul de `phase` et `tInPhaseFrac` :

```tsx
// Anticipation isométrique : 0.8s avant fin de phase → si phase suivante est ISO
const nextPhaseIsIso = (phase === 0 && phaseDurations[1] > 0)   // fin CON → ISO
                    || (phase === 3 && phaseDurations[1] > 0)   // fin PAUSE → ISO (prochain cycle)
const phaseDurSec = phaseDurations[phase] / 1000
const anticipationThreshold = phaseDurSec > 0.8 ? 1 - (0.8 / phaseDurSec) : 0

const shouldAnticipate = nextPhaseIsIso && tInPhaseFrac >= anticipationThreshold

if (shouldAnticipate && !anticipationFiredRef.current) {
  anticipationFiredRef.current = true
  setIsAnticipating(true)
  if (hapticsEnabled) {
    try { navigator.vibrate(10) } catch { /* not supported */ }
  }
}
if (!shouldAnticipate) {
  anticipationFiredRef.current = false
  setIsAnticipating(false)
}
```

- [ ] **Step 3: Décélération balle pendant anticipation**

Dans le calcul de `ballPos`, pour CON uniquement, remplacer l'easing par un easing plus agressif si `isAnticipating` :

```tsx
if (phase === 0) {
  // CON: ease-out normal → ease-out agressif si anticipation
  const eased = isAnticipating
    ? Math.min(tInPhaseFrac * (2 - tInPhaseFrac * 0.3), 1)  // décélération plus forte
    : tInPhaseFrac * (2 - tInPhaseFrac)  // ease-out quad normal
  ballPos = lerpPt(TRI_C, TRI_A, Math.min(eased, 1))
}
```

Note : `isAnticipating` est un state React qui ne sera pas disponible directement dans la RAF. Utiliser un ref :

```tsx
const isAnticipatingRef = useRef(false)
// Sync ref avec state dans RAF :
isAnticipatingRef.current = shouldAnticipate
// Utiliser isAnticipatingRef.current dans le calcul easing
```

- [ ] **Step 4: Clignotement orange → rouge du label**

Quand `isAnticipating === true` et phase CON en cours, le label doit clignoter orange → rouge.

```tsx
// State supplémentaire
const [blinkOrange, setBlinkOrange] = useState(false)

// useEffect pour le clignotement
useEffect(() => {
  if (!isAnticipating) { setBlinkOrange(false); return }
  let count = 0
  const iv = setInterval(() => {
    setBlinkOrange(prev => !prev)
    count++
    if (count >= 4) clearInterval(iv)  // 2 cycles = 4 toggles
  }, 125)  // 4Hz = 250ms période, 125ms demi-période
  return () => clearInterval(iv)
}, [isAnticipating])

// Dans le JSX du label :
const anticipationColor = blinkOrange ? '#f97316' : '#ef4444'
const labelColor = isAnticipating ? anticipationColor : phaseColor

<span
  className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-2xl"
  style={{ color: countdown !== null ? ACCENT_TEMPO : labelColor }}
>
  {countdown !== null ? 'PRÊT' : PHASE_CONFIG[currentPhase].label}
</span>
```

- [ ] **Step 5: Reset anticipation au changement de phase**

Dans le bloc `if (phase !== lastPhaseRef.current)` de la RAF loop :

```tsx
isAnticipatingRef.current = false
setIsAnticipating(false)
anticipationFiredRef.current = false
```

- [ ] **Step 6: Vérifier**

Utiliser un tempo avec ISO > 0 (ex: `3-2-3-1`). Confirmer :
- ~0.8s avant fin CON → label clignote orange/rouge
- Haptique court si haptics activés
- Balle décélère légèrement
- Signal s'arrête dès que ISO commence

- [ ] **Step 7: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo): isometric anticipation signal — deceleration + blink + haptic"
```

---

## Task 4: Reps bonus (mode relais) + onClose enrichi

**Files:**
- Modify: `components/client/TempoGuideModal.tsx`

- [ ] **Step 1: Mettre à jour la signature onClose**

Dans `TempoGuideModalProps` et `TempoGuideModalInner` :

```tsx
interface TempoGuideModalProps {
  tempo: string
  reps: number
  exerciseName: string
  prepSeconds: number
  hapticsEnabled: boolean
  onClose: (result: { plannedReps: number; bonusReps: number; totalReps: number }) => void
}
```

- [ ] **Step 2: Ajouter state bonusReps**

```tsx
const [bonusReps, setBonusReps] = useState(0)
const bonusRepsRef = useRef(0)  // ref pour accès dans RAF sans stale closure
```

- [ ] **Step 3: Modifier la condition de fin de série dans la RAF loop**

Actuellement le code s'arrête quand `repIndex >= reps`. Retirer cette condition d'arrêt et comptabiliser les bonus :

```tsx
// Remplacer :
const repIndex = Math.min(Math.floor(elapsed / repDuration), reps)
if (repIndex >= reps) {
  // freeze + done
  ...
  setDone(true)
  return
}

// Par :
const repIndex = Math.floor(elapsed / repDuration)
const isBonus = repIndex >= reps

if (repIndex !== repRef.current) {
  repRef.current = repIndex
  setCurrentRep(repIndex)
  if (isBonus) {
    bonusRepsRef.current = repIndex - reps + 1
    setBonusReps(bonusRepsRef.current)
  }
  if (repIndex > 0) vib([60, 30, 60])
}
```

Pas de `setDone(true)` automatique — la série continue indéfiniment jusqu'à ce que l'utilisateur ferme manuellement.

- [ ] **Step 4: Afficher les barres bonus**

Dans le JSX des rep bars, remplacer le rendu statique par un rendu dynamique qui ajoute des barres grises au-delà des reps planifiées :

```tsx
{/* Rep bars — planned + bonus */}
<div className="flex gap-[3px]" style={{ height: 38 }}>
  {Array.from({ length: reps + bonusReps }).map((_, i) => {
    const isBonus   = i >= reps
    const isDone    = i < currentRep
    const isCurrent = i === currentRep
    return (
      <motion.div
        key={i}
        className="flex-1 rounded-xl"
        animate={{
          backgroundColor: isBonus
            ? (isDone || isCurrent ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.08)')
            : (isDone || isCurrent ? '#ffe01e' : 'rgba(255,255,255,0.10)'),
          boxShadow: isCurrent && !isBonus
            ? `0 0 14px rgba(255,224,30,0.6), 0 0 4px rgba(255,224,30,0.9)`
            : isCurrent && isBonus
              ? `0 0 10px rgba(255,255,255,0.2)`
              : 'none',
          scaleY: isCurrent ? [1, 1.06, 1] : 1,
        }}
        initial={false}
        transition={{
          backgroundColor: { duration: 0.25 },
          boxShadow: { duration: 0.25 },
          scaleY: { duration: 0.4, repeat: isCurrent ? Infinity : 0, repeatType: 'reverse' },
        }}
      />
    )
  })}
</div>
```

- [ ] **Step 5: Mettre à jour le rep counter**

```tsx
{/* Rep counter */}
<div className="shrink-0 flex justify-center items-baseline gap-1 pb-14">
  <span className="font-mono text-[36px] font-black leading-none tabular-nums" style={{ color: currentRep >= reps ? 'rgba(255,255,255,0.6)' : '#ffe01e' }}>
    {currentRep + 1}
  </span>
  <span className="font-mono text-[22px] font-bold text-white/20 mx-1">/</span>
  <span className="font-mono text-[28px] font-black text-white/60 leading-none tabular-nums">
    {reps}
  </span>
  {bonusReps > 0 && (
    <span className="font-mono text-[16px] font-bold text-white/30 ml-1">
      +{bonusReps}
    </span>
  )}
</div>
```

- [ ] **Step 6: Passer le résultat à onClose**

Dans `handleClose` et dans l'auto-close après `done` :

```tsx
const handleClose = useCallback(() => {
  cancelAnimationFrame(rafRef.current)
  const result = {
    plannedReps: reps,
    bonusReps: bonusRepsRef.current,
    totalReps: reps + bonusRepsRef.current,
  }
  setClosingResult(result)
  setClosing(true)
}, [reps])
```

Ajouter state `closingResult` :

```tsx
const [closingResult, setClosingResult] = useState<{ plannedReps: number; bonusReps: number; totalReps: number } | null>(null)
```

Dans `AnimatePresence onExitComplete` :

```tsx
<AnimatePresence onExitComplete={() => onClose(closingResult ?? { plannedReps: reps, bonusReps: 0, totalReps: reps })}>
```

Supprimer `setDone(true)` (plus d'auto-close). L'utilisateur ferme manuellement.

- [ ] **Step 7: Vérifier**

Tapper ▶ sur un exercice 3 reps. Laisser tourner jusqu'à rep 5. Confirmer :
- Barres 4 et 5 apparaissent en gris
- Compteur affiche `4/3 +1`
- À la fermeture, onClose reçoit `{ plannedReps: 3, bonusReps: 2, totalReps: 5 }`

- [ ] **Step 8: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo): bonus reps relay mode — continuous past planned reps, grey bonus bars"
```

---

## Task 5: Support landscape

**Files:**
- Modify: `components/client/TempoGuideModal.tsx`

- [ ] **Step 1: Ajouter le hook useIsLandscape**

Au-dessus du composant `TempoGuideModal` :

```tsx
function useIsLandscape(): boolean {
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

- [ ] **Step 2: Utiliser le hook dans TempoGuideModalInner**

```tsx
const isLandscape = useIsLandscape()
```

- [ ] **Step 3: Layout conditionnel portrait vs landscape**

Remplacer la structure `flex flex-col` par :

```tsx
<motion.div
  key="tempo-guide"
  className="fixed inset-0 bg-[#080808] z-[60] select-none touch-none"
  ...
>
  {/* Header — toujours en haut */}
  <div className="flex items-center justify-between px-6 pt-safe-top pt-6 pb-2 shrink-0 absolute top-0 left-0 right-0 z-10">
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-0.5">Tempo guide</p>
      <p className="text-[15px] font-bold text-white leading-tight truncate max-w-[240px]">{exerciseName}</p>
    </div>
    <button onClick={handleClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/35 hover:text-white/70 hover:bg-white/[0.10] active:scale-95 transition-all">
      <X size={16} />
    </button>
  </div>

  {/* Corps principal — conditionnel */}
  <div className={`flex h-full pt-16 ${isLandscape ? 'flex-row items-center px-4 gap-6' : 'flex-col items-center'}`}>
    {/* SVG Triangle */}
    <div className={`flex items-center justify-center ${isLandscape ? 'w-[45vw] h-full' : 'flex-1 w-full px-4'}`}>
      <svg
        viewBox="0 0 300 280"
        preserveAspectRatio="xMidYMid meet"
        className={isLandscape ? 'h-[80vh] w-auto' : 'w-full'}
        style={{ overflow: 'visible' }}
      >
        {/* ... contenu SVG ... */}
      </svg>
    </div>

    {/* Panneau droit (label + barres + counter) */}
    <div className={`flex shrink-0 ${isLandscape ? 'flex-col justify-center gap-4 w-[45vw] pb-4' : 'flex-col items-center w-full pb-4 gap-2'}`}>
      {/* Phase label */}
      <div className={`${isLandscape ? '' : 'flex flex-col items-center'} pt-3`}>
        {/* ... label JSX ... */}
      </div>

      {/* Rep bars — orientation selon landscape */}
      <div className={`${isLandscape ? 'flex flex-col gap-[3px]' : 'flex flex-row gap-[3px] px-6'}`}
           style={isLandscape ? { width: 38, height: 'auto' } : { height: 38 }}>
        {Array.from({ length: reps + bonusReps }).map((_, i) => {
          // ... barres existantes ...
          return (
            <motion.div
              key={i}
              className={isLandscape ? 'rounded-xl' : 'flex-1 rounded-xl'}
              style={isLandscape ? { height: 24, minWidth: 38 } : {}}
              animate={{ /* ... */ }}
            />
          )
        })}
      </div>

      {/* Rep counter */}
      <div className={`flex items-baseline gap-1 ${isLandscape ? '' : 'justify-center'}`}>
        {/* ... counter JSX ... */}
      </div>

      {/* Bouton fermer en landscape (en bas du panneau) */}
      {isLandscape && (
        <button
          onClick={handleClose}
          className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 transition-all text-[12px] font-medium"
        >
          <X size={14} /> Terminer
        </button>
      )}
    </div>
  </div>

  {/* Countdown et GO overlays — inchangés */}
</motion.div>
```

- [ ] **Step 4: Vérifier sur iOS landscape**

Tester sur simulateur ou appareil réel en mode paysage. Confirmer :
- Triangle visible à gauche, labels + barres à droite
- Pas d'overflow, pas de scrollbar
- Rotation portrait → landscape en cours de session ne crash pas

- [ ] **Step 5: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo): responsive landscape layout — split triangle/controls"
```

---

## Task 6: Sync IA ↔ Tempo dans SessionLogger

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

- [ ] **Step 1: Mettre à jour la résolution des reps au tap ▶ — set solo (ligne ~1119)**

```tsx
// Remplacer :
const repCount = resolveReps(ex)

// Par :
const setKey = recKey(ex.id, s.set_number, s.side)
const recForSet = recommendations[setKey]
const repCount = recForSet?.reps ?? resolveReps(ex)
```

Le `s` est accessible dans le scope de l'IIFE qui rend le bouton tempo. Si pas accessible directement, passer `s.set_number` et `s.side` en closure.

- [ ] **Step 2: Mettre à jour la résolution des reps — set superset (ligne ~1289)**

```tsx
// Remplacer :
const ssRepCount = resolveReps(ex)

// Par :
const ssSetKey = recKey(ex.id, s.set_number, s.side)
const ssRecForSet = recommendations[ssSetKey]
const ssRepCount = ssRecForSet?.reps ?? resolveReps(ex)
```

- [ ] **Step 3: Mettre à jour les calls setPrepTimeTarget et setTempoGuideTarget**

Les deux points de déclenchement (solo ~1123 et superset ~1314) passent déjà `reps: repCount` (resp. `ssRepCount`) — aucun changement supplémentaire nécessaire si les steps 1 et 2 sont corrects.

- [ ] **Step 4: Mettre à jour le handler onClose de TempoGuideModal**

Actuellement `onClose={() => setTempoGuideTarget(null)}`. Remplacer par :

```tsx
onClose={(result) => {
  if (result.bonusReps > 0 && tempoGuideTarget) {
    // Retrouver le set courant pour override actual_reps
    // Le set courant est celui qui a déclenché le tempo (currentEx, set non complété)
    // On cherche le premier set non complété de l'exercice courant
    const targetEx = exercises.find(e => (swappedNames[e.id] ?? e.name) === tempoGuideTarget.exerciseName || e.name === tempoGuideTarget.exerciseName)
    if (targetEx) {
      const firstUncompleted = sets.find(s => s.exercise_id === targetEx.id && !s.completed)
      if (firstUncompleted) {
        const key = recKey(targetEx.id, firstUncompleted.set_number, firstUncompleted.side)
        // Override actual_reps + marquer comme manuellement édité (pas re-overridable par IA)
        setSets(prev => prev.map(s =>
          s.exercise_id === targetEx.id && s.set_number === firstUncompleted.set_number && s.side === firstUncompleted.side
            ? { ...s, actual_reps: String(result.totalReps) }
            : s
        ))
        setManuallyEdited(prev => new Set(prev).add(key))
      }
    }
  }
  setTempoGuideTarget(null)
}}
```

- [ ] **Step 5: Vérifier**

1. Compléter un set (ex: 10 reps 80kg RIR 3) → IA recommande 12 reps pour le set suivant
2. Tapper ▶ sur le set suivant → TempoGuideModal doit s'ouvrir avec 12 barres (pas 10)
3. Laisser aller jusqu'à rep 14 → 2 barres bonus grises apparaissent
4. Fermer → `actual_reps` du set = 14

- [ ] **Step 6: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Résoudre tous les erreurs.

- [ ] **Step 7: Commit**

```bash
git add "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(tempo): sync AI reps to tempo guide, feed bonus reps to actual_reps"
```

---

## Task 7: Rappel hydratation

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`
- Modify: `app/client/programme/session/[sessionId]/page.tsx`

### Sous-tâche A — page.tsx: fetch clientWeight

- [ ] **Step 1: Ajouter le fetch du poids client dans page.tsx**

Après la résolution du client, ajouter :

```tsx
// Fetch poids client (dernière valeur depuis assessment_submissions)
let clientWeight: number | undefined
const { data: weightData } = await service
  .from('assessment_submissions')
  .select('answers')
  .eq('client_id', client.id)
  .not('answers', 'is', null)
  .order('bilan_date', { ascending: false })
  .limit(5)

if (weightData) {
  for (const sub of weightData) {
    const answers = (sub as any).answers
    if (typeof answers === 'object' && answers !== null) {
      const w = answers.weight_kg ?? answers.poids_kg ?? answers.weight
      if (typeof w === 'number' && w > 0 && w < 300) {
        clientWeight = w
        break
      }
    }
  }
}
```

- [ ] **Step 2: Passer clientWeight à SessionLogger**

```tsx
return (
  <SessionLogger
    clientId={client.id}
    sessionId={params.sessionId}
    session={{ id: session.id, name: session.name }}
    exercises={exercisesWithAlternatives}
    lastPerformance={lastPerformance}
    goal={goal}
    level={level}
    clientWeight={clientWeight}
  />
)
```

### Sous-tâche B — SessionLogger.tsx: hydratation

- [ ] **Step 3: Ajouter clientWeight à Props et import Droplets**

```tsx
// Dans l'interface Props :
clientWeight?: number

// Imports Lucide :
import { ..., Droplets } from 'lucide-react'
```

- [ ] **Step 4: Ajouter la fonction calcHydrationPlan**

Avant le composant, dans la section helpers :

```tsx
function calcHydrationPlan(weightKg: number, durationMin: number) {
  const totalMl = weightKg * 35 + durationMin * 8
  const intervalMin = 15
  const sips = Math.max(1, Math.floor(durationMin / intervalMin))
  const mlPerSip = Math.round(totalMl / sips)
  return { totalMl, intervalMin, mlPerSip }
}
```

- [ ] **Step 5: Ajouter les states et timer hydratation dans le composant**

Dans `SessionLogger`, après les states existants :

```tsx
const [showHydration, setShowHydration] = useState(false)
const [sipsConsumed, setSipsConsumed] = useState(0)
const hydrationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
const HYDRATION_INTERVAL_MS = 15 * 60 * 1000  // 15 minutes

const hydrationPlan = useMemo(() => {
  const w = clientWeight ?? 70
  const estimatedDuration = 60  // estimation séance standard en minutes
  return calcHydrationPlan(w, estimatedDuration)
}, [clientWeight])

// Démarrer le timer au mount
useEffect(() => {
  hydrationTimerRef.current = setInterval(() => {
    setShowHydration(true)
  }, HYDRATION_INTERVAL_MS)
  return () => {
    if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current)
  }
}, [])

function resetHydrationTimer(delayMs: number) {
  if (hydrationTimerRef.current) clearInterval(hydrationTimerRef.current)
  hydrationTimerRef.current = setInterval(() => {
    setShowHydration(true)
  }, delayMs)
}
```

- [ ] **Step 6: Ajouter l'icône hydratation dans le header SessionLogger**

Trouver le header du SessionLogger (zone avec le chrono et le titre de séance). Ajouter l'icône goutte :

```tsx
{/* Hydratation reminder icon — dans le header, à côté du chrono */}
<button
  onClick={() => setShowHydration(true)}
  className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/[0.04] active:scale-95 transition-all"
>
  <Droplets size={14} className="text-blue-400 animate-pulse" />
</button>
```

- [ ] **Step 7: Ajouter la bottom sheet hydratation**

Juste avant la fermeture du return principal (avant `</div>` final), ajouter :

```tsx
{/* ── Hydratation reminder sheet ── */}
{showHydration && (
  <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => {
    setShowHydration(false)
    resetHydrationTimer(5 * 60 * 1000)  // Ignorer = rappel dans 5min
  }}>
    <div
      className="w-full bg-[#161616] rounded-t-2xl border-t border-white/[0.08] px-5 pt-5 pb-8"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
          <Droplets size={18} className="text-blue-400" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-white">Hydratation</p>
          <p className="text-[11px] text-white/40">
            Bois environ {hydrationPlan.mlPerSip} ml
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => {
            setSipsConsumed(prev => prev + 1)
            setShowHydration(false)
            resetHydrationTimer(HYDRATION_INTERVAL_MS)
          }}
          className="flex-1 h-11 rounded-xl font-bold text-[13px] uppercase tracking-[0.08em]"
          style={{ backgroundColor: '#ffe01e', color: '#0d0d0d' }}
        >
          J'ai bu
        </button>
        <button
          onClick={() => {
            setShowHydration(false)
            resetHydrationTimer(5 * 60 * 1000)
          }}
          className="flex-1 h-11 rounded-xl bg-white/[0.04] text-white/50 font-medium text-[13px] hover:text-white/70 transition-colors"
        >
          Ignorer
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 8: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

0 erreurs.

- [ ] **Step 9: Vérifier fonctionnellement**

Pas de moyen facile de tester à 15min — temporairement changer `HYDRATION_INTERVAL_MS` à `5000` (5s), confirmer que la sheet apparaît, que "J'ai bu" reset à 15min (5s en test), que "Ignorer" reset à 5min (2.5s en test). Remettre à `15 * 60 * 1000` avant commit.

- [ ] **Step 10: Commit**

```bash
git add "app/client/programme/session/[sessionId]/SessionLogger.tsx" "app/client/programme/session/[sessionId]/page.tsx"
git commit -m "feat(session): hydration reminders — 15min interval, ml estimate, sip tracking"
```

---

## Task 8: CHANGELOG + project-state + TypeScript final

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-05-17` :

```markdown
FEATURE: TempoGuideModal v2 — closed triangle circuit (continuous ball, no snap)
FEATURE: TempoGuideModal v2 — phase color codes + labels (CONTRACTER/FREINER/TENIR/PAUSE)
FEATURE: TempoGuideModal v2 — isometric anticipation signal (deceleration + blink + haptic)
FEATURE: TempoGuideModal v2 — bonus reps relay mode (continuous past planned, grey bars)
FEATURE: TempoGuideModal v2 — landscape layout (split triangle/controls)
FEATURE: SessionLogger — AI↔tempo sync (uses rec.reps when available)
FEATURE: SessionLogger — bonus reps feed to actual_reps
FEATURE: SessionLogger — hydration reminders (15min interval, ml estimate)
```

- [ ] **Step 2: Mettre à jour project-state.md**

Dans le tableau "Modules Core Status", mettre à jour la ligne Client App :

```markdown
| **Client App** | ✅ Session logging, PWA, weights, superset UX, tempo display + guide modal v2 (triangle, couleurs, bonus reps, landscape, hydratation) | 2026-05-17 |
```

Ajouter section "Dernières Avancées" pour 2026-05-17 Tempo v2.

- [ ] **Step 3: Vérification TypeScript finale**

```bash
npx tsc --noEmit
```

0 erreurs. Si erreurs, les corriger avant de continuer.

- [ ] **Step 4: Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Tempo v2 + hydration"
```

---

## Checklist spec → plan

| Spec requirement | Task |
|-----------------|------|
| Triangle fermé, balle continue | Task 1 |
| Codes couleurs + labels CONTRACTER/FREINER/TENIR/PAUSE | Task 2 |
| Anticipation isométrique multi-canal | Task 3 |
| Reps bonus mode relais, barres grises | Task 4 |
| onClose enrichi { plannedReps, bonusReps, totalReps } | Task 4 |
| Support landscape split layout | Task 5 |
| Sync IA reps → tempo | Task 6 |
| Feed bonusReps → actual_reps | Task 6 |
| Hydratation calcul + timer + sheet | Task 7 |
| clientWeight depuis profil | Task 7 |
| CHANGELOG + project-state | Task 8 |
