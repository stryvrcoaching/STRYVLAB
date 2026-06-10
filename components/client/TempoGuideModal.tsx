'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { parseTempo, type ParsedTempo } from '@/lib/training/tempo'
import { useClientT } from '@/components/client/ClientI18nProvider'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TempoCloseResult {
  plannedReps: number
  bonusReps: number
  totalReps: number
}

interface TempoGuideModalProps {
  tempo: string
  reps: number
  exerciseName: string
  prepSeconds: number
  hapticsEnabled: boolean
  onClose: (result: TempoCloseResult) => void
}

// ─── Double-wave path ─────────────────────────────────────────────────────────
// viewBox 400×160 — 2 bosses visibles simultanément
// Balle avance toujours de gauche à droite (jamais de retour arrière)
// 1 rep = 1 bosse complète (creux→pic→creux), x progresse de 0 à 200
//
// Path : sinusoïde bézier — 3 bosses définies pour que la balle reste toujours
// dans le viewport quelle que soit sa position dans la rep.
//
//   x=0,y=140  creux gauche (hors écran gauche)
//   x=100,y=20  pic 1
//   x=200,y=140 creux centre
//   x=300,y=20  pic 2
//   x=400,y=140 creux droite (hors écran droit)
//
// La balle est positionnée sur ce path via getPointAtLength.
// On décale le viewBox horizontalement selon la progression dans la rep
// pour donner l'illusion de mouvement continu.

const WAVE_W = 400   // largeur d'une période (1 rep)
const WAVE_H = 160   // hauteur viewBox
const WAVE_PEAK_Y  = 20   // y des pics (ISO)
const WAVE_TROUGH_Y = 140 // y des creux (PAUSE/début CON)

// Path avec 3 bosses (largeur totale = 3 × WAVE_W = 1200)
// Chaque bosse : creux → pic → creux via béziers symétriques
function buildWavePath(): string {
  const segs: string[] = []
  segs.push(`M 0,${WAVE_TROUGH_Y}`)
  for (let i = 0; i < 3; i++) {
    const x0 = i * WAVE_W
    const xPeak = x0 + WAVE_W / 2
    const x1 = x0 + WAVE_W
    // montée : creux → pic
    segs.push(`C ${x0 + WAVE_W * 0.25},${WAVE_TROUGH_Y} ${x0 + WAVE_W * 0.25},${WAVE_PEAK_Y} ${xPeak},${WAVE_PEAK_Y}`)
    // descente : pic → creux
    segs.push(`C ${xPeak + WAVE_W * 0.25},${WAVE_PEAK_Y} ${xPeak + WAVE_W * 0.25},${WAVE_TROUGH_Y} ${x1},${WAVE_TROUGH_Y}`)
  }
  return segs.join(' ')
}

const WAVE_PATH_D = buildWavePath()
// Longueur totale du path (3 bosses × longueur d'une bosse)
// Longueur analytique approx d'une bosse sinusoïdale avec ces béziers ≈ 470px
// Calculé dynamiquement via pathRef.getTotalLength() au premier frame.

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG = [
  { label: 'CONTRACTER', color: '#5dba87' },  // 0 CON — vert (phase concentrique, montée)
  { label: 'TENIR',      color: '#ef4444' },  // 1 ISO — rouge (tenue sommet)
  { label: 'FREINER',    color: '#3b82f6' },  // 2 ECC — bleu (phase excentrique, descente)
  { label: 'PAUSE',      color: '#ef4444' },  // 3 PAUSE — rouge (tenue creux)
] as const

const ACCENT_TEMPO = '#5dba87'  // training green — countdown, GO, ready
const TRAIL_LEN = 6

// 300ms avant la fin d'une phase statique (ISO/PAUSE) → balle change de couleur
// pour annoncer la prochaine phase.
const PREVIEW_MS = 300

// ─── Landscape hook ───────────────────────────────────────────────────────────

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

// ─── Haptic helper ────────────────────────────────────────────────────────────

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate(pattern) } catch { /* not supported */ }
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export default function TempoGuideModal({
  tempo, reps, exerciseName, prepSeconds, hapticsEnabled, onClose,
}: TempoGuideModalProps) {
  const parsed = parseTempo(tempo)
  if (!parsed || reps <= 0) return null

  const ms = (p: typeof parsed.eccentric) => p === 'X' ? 300 : (p as number) * 1000
  const totalMs = ms(parsed.concentric) + ms(parsed.isometric ?? parsed.pauseTop) + ms(parsed.eccentric) + ms(parsed.pause ?? parsed.pauseBottom)
  if (totalMs === 0) return null

  return (
    <TempoGuideModalInner
      parsed={parsed}
      reps={reps}
      exerciseName={exerciseName}
      prepSeconds={prepSeconds}
      hapticsEnabled={hapticsEnabled}
      onClose={onClose}
    />
  )
}

// ─── Inner component ──────────────────────────────────────────────────────────

function TempoGuideModalInner({
  parsed, reps, exerciseName, prepSeconds, hapticsEnabled, onClose,
}: {
  parsed: ParsedTempo
  reps: number
  exerciseName: string
  prepSeconds: number
  hapticsEnabled: boolean
  onClose: (result: TempoCloseResult) => void
}) {
  const { t } = useClientT()
  const isLandscape = useIsLandscape()
  const vib = useCallback((pattern: number | number[]) => {
    if (hapticsEnabled) vibrate(pattern)
  }, [hapticsEnabled])

  const ms = (p: typeof parsed.eccentric) => p === 'X' ? 300 : (p as number) * 1000
  const phaseDurations = useMemo<number[]>(() => [
    ms(parsed.concentric),
    ms(parsed.isometric ?? parsed.pauseTop),
    ms(parsed.eccentric),
    ms(parsed.pause ?? parsed.pauseBottom),
  ], [parsed]) // eslint-disable-line react-hooks/exhaustive-deps
  const repDuration = phaseDurations.reduce((a, b) => a + b, 0)

  // ── React state ──
  const [currentPhase, setCurrentPhase] = useState(0)
  const [currentRep,   setCurrentRep]   = useState(0)
  const [bonusReps,    setBonusReps]     = useState(0)
  const [closing,      setClosing]       = useState(false)
  const [closingResult, setClosingResult] = useState<TempoCloseResult | null>(null)
  const [countdown,    setCountdown]     = useState<number | null>(prepSeconds > 0 ? prepSeconds : null)
  const [phaseTimer,   setPhaseTimer]    = useState<number>(0)
  const [phaseColor,   setPhaseColor]    = useState<string>(PHASE_CONFIG[0].color)
  // Pause/reprise
  const [paused,         setPaused]         = useState(false)
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null)
  const pausedAtRef       = useRef<number | null>(null)  // elapsed au moment de la pause
  // Auto-pause quand les reps planifiées se terminent — évite les reps fantômes
  const [autoFinished,   setAutoFinished]   = useState(false)
  const autoFinishedFiredRef = useRef(false)

  // Anticipation
  const [isAnticipating, setIsAnticipating] = useState(false)
  const anticipationFiredRef = useRef(false)
  const isAnticipatingRef    = useRef(false)

  // ── SVG DOM refs ──
  const pathRef         = useRef<SVGPathElement>(null)
  const ballRef         = useRef<SVGCircleElement>(null)
  const ballGlowRef     = useRef<SVGCircleElement>(null)
  const trailRefs       = useRef<SVGCircleElement[]>([])
  const svgRef          = useRef<SVGSVGElement>(null)
  // Diamants : 0=creux gauche(début rep), 1=montée intermédiaire, 2=sommet, 3=descente intermédiaire, 4=creux droit(fin rep)
  const diamondRefs     = useRef<SVGPolygonElement[]>([])

  // ── Label DOM refs ──
  const phaseLabelRef = useRef<HTMLSpanElement>(null)
  const phaseTimerRef = useRef<HTMLSpanElement>(null)

  // ── RAF mutable refs ──
  const rafRef        = useRef<number>(0)
  const startRef      = useRef<number | null>(null)
  const repRef        = useRef(0)
  const bonusRepsRef  = useRef(0)
  const lastPhaseRef  = useRef(-1)
  const pathLenRef    = useRef<number>(0)
  const repLenRef     = useRef<number>(0)
  // Couleur balle courante (DOM direct, évite setState)
  const ballColorRef  = useRef<string>(PHASE_CONFIG[0].color)
  // Diamant dernièrement pulsé (évite répétitions)
  const lastDiamondRef = useRef<number>(-1)

  // ── Countdown ──
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) { setCountdown(null); return }
    const t = setTimeout(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── Init path lengths + viewBox initial au mount ──
  useEffect(() => {
    if (!pathRef.current || !svgRef.current) return
    const total = pathRef.current.getTotalLength()
    pathLenRef.current = total
    repLenRef.current  = total / 3
    // Balle sur bosse 2 creux gauche = total/3 → toujours contexte gauche+droite visible
    const startPt = pathRef.current.getPointAtLength(total / 3)
    svgRef.current.setAttribute('viewBox', `${startPt.x - WAVE_W / 2} 0 ${WAVE_W} ${WAVE_H}`)
    if (ballRef.current) {
      ballRef.current.setAttribute('cx', String(startPt.x))
      ballRef.current.setAttribute('cy', String(startPt.y))
    }
    if (ballGlowRef.current) {
      ballGlowRef.current.setAttribute('cx', String(startPt.x))
      ballGlowRef.current.setAttribute('cy', String(startPt.y))
    }
  }, [])

  // ── Position balle pendant prep ──
  useEffect(() => {
    if (!ballRef.current || !ballGlowRef.current || !pathRef.current) return
    if (countdown === null) return
    // Position initiale = début de la bosse 2 (centre du path)
    const startLen = repLenRef.current || pathLenRef.current / 3
    const pt = pathRef.current.getPointAtLength(startLen)
    ballRef.current.setAttribute('cx', String(pt.x))
    ballRef.current.setAttribute('cy', String(pt.y))
    ballRef.current.setAttribute('fill', 'white')
    ballRef.current.setAttribute('r', '14')
    ballGlowRef.current.setAttribute('cx', String(pt.x))
    ballGlowRef.current.setAttribute('cy', String(pt.y))
  }, [countdown])

  // ── Close handler ──
  const handleClose = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const result: TempoCloseResult = {
      plannedReps: reps,
      bonusReps: bonusRepsRef.current,
      totalReps: reps + bonusRepsRef.current,
    }
    setClosingResult(result)
    setClosing(true)
  }, [reps])

  // ── RAF Loop ──
  const tick = useCallback((now: number) => {
    if (!ballRef.current || !ballGlowRef.current || !pathRef.current || !svgRef.current) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    // Init path lengths si pas encore fait
    if (pathLenRef.current === 0) {
      const total = pathRef.current.getTotalLength()
      pathLenRef.current = total
      repLenRef.current  = total / 3
    }

    // startRef initialisé dans useEffect au lancement — jamais null ici
    const elapsed = now - (startRef.current ?? now)

    const repIndex = Math.floor(elapsed / repDuration)
    const isBonus  = repIndex >= reps

    if (repIndex !== repRef.current) {
      repRef.current = repIndex
      setCurrentRep(repIndex)
      // Auto-pause à la fin des reps planifiées — évite reps fantômes
      if (repIndex === reps && !autoFinishedFiredRef.current) {
        autoFinishedFiredRef.current = true
        pausedAtRef.current = startRef.current !== null ? now - startRef.current : 0
        cancelAnimationFrame(rafRef.current)
        setPaused(true)
        setAutoFinished(true)
        vib([80, 40, 80, 40, 200])
        return
      }
      if (isBonus) {
        bonusRepsRef.current = repIndex - reps + 1
        setBonusReps(bonusRepsRef.current)
      }
      if (repIndex > 0) vib([60, 30, 60])
    }

    const tRep = elapsed % repDuration

    // Déterminer phase et temps dans la phase
    let cumMs = 0
    let phase = 3
    let tInPhaseMs = 0
    for (let i = 0; i < 4; i++) {
      const d = phaseDurations[i]
      if (d > 0 && tRep < cumMs + d) {
        phase = i
        tInPhaseMs = tRep - cumMs
        break
      }
      cumMs += d
      phase = i
      tInPhaseMs = phaseDurations[i]
    }

    const phaseMs      = phaseDurations[phase]
    const tInPhaseFrac = phaseMs > 0 ? Math.min(tInPhaseMs / phaseMs, 1) : 1
    const timeLeftMs   = phaseMs - tInPhaseMs

    // ── Phase change ──
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      setCurrentPhase(phase)
      isAnticipatingRef.current    = false
      anticipationFiredRef.current = false
      lastDiamondRef.current       = -1
      if (phase === 0) vib(80)
      else if (phase === 1) vib(40)
      else if (phase === 2) vib(40)
      else if (phase === 3) vib(30)
    }

    // ── Couleur balle prédictive ──
    // Règle : la couleur ANNONCE ce qui va se passer, pas ce qui se passe.
    //
    // En mouvement CON  → vert
    // En mouvement ECC  → orange
    // Arrivée sommet ISO ≥ 2s → rouge immédiat
    // Arrivée sommet ISO < 2s → orange (skip rouge, trop court)
    // 400ms avant fin ISO     → vert (annonce redémarrage ECC... attend, ECC est orange)
    //   → en fait : avant fin ISO, passer orange (annonce ECC)
    // Arrivée creux PAUSE ≥ 2s → rouge immédiat
    // Arrivée creux PAUSE < 2s → orange
    // 400ms avant fin PAUSE   → vert (annonce CON)

    let ballColor: string
    const isoDurMs   = phaseDurations[1]
    const pauseDurMs = phaseDurations[3]

    if (phase === 0) {
      // CON — vert toute la montée (phase concentrique)
      ballColor = '#5dba87'
    } else if (phase === 1) {
      // ISO (tenue sommet) — rouge, annonce ECC (bleu) 300ms avant fin
      ballColor = timeLeftMs <= PREVIEW_MS ? '#3b82f6' : '#ef4444'
    } else if (phase === 2) {
      // ECC — bleu toute la descente (phase excentrique)
      ballColor = '#3b82f6'
    } else {
      // PAUSE (tenue creux) — rouge, annonce CON (vert) 300ms avant fin
      ballColor = timeLeftMs <= PREVIEW_MS ? '#5dba87' : '#ef4444'
    }

    // Appliquer couleur balle si changée
    if (ballColor !== ballColorRef.current) {
      ballColorRef.current = ballColor
      if (phaseLabelRef.current) {
        const labelText = ballColor === '#5dba87' ? 'CONTRACTER'
          : ballColor === '#3b82f6' ? 'FREINER'
          : (phase === 1 ? 'TENIR' : 'PAUSE')
        phaseLabelRef.current.textContent = labelText
        phaseLabelRef.current.style.color  = ballColor
      }
      if (phaseTimerRef.current) {
        phaseTimerRef.current.style.color = ballColor
      }
      setPhaseColor(ballColor)
    }

    // ── Phase timer — DOM direct ──
    if (phaseMs > 0) {
      const remaining = Math.ceil(timeLeftMs / 1000)
      const timerVal  = Math.max(remaining, 0)
      setPhaseTimer(timerVal)
      if (phaseTimerRef.current) {
        phaseTimerRef.current.textContent = `${timerVal}s`
      }
    }

    // ── Position balle ──
    const repLen = repLenRef.current
    if (repLen === 0) { rafRef.current = requestAnimationFrame(tick); return }

    const conDur  = phaseDurations[0]
    const isoDur  = phaseDurations[1]
    const eccDur  = phaseDurations[2]
    const totalDur = conDur + isoDur + eccDur + pauseDurMs
    const timeFrac = Math.min(tRep / totalDur, 1)
    const conFrac  = totalDur > 0 ? conDur / totalDur : 0.25
    const isoFrac  = totalDur > 0 ? isoDur / totalDur : 0
    const eccFrac  = totalDur > 0 ? eccDur / totalDur : 0.25

    // Vitesse constante — linéaire pur, pas d'ease, durée = exactement le tempo affiché
    let repFrac: number
    if (timeFrac <= conFrac) {
      const t = conFrac > 0 ? timeFrac / conFrac : 1
      repFrac = t * 0.5  // linéaire 0→0.5
    } else if (timeFrac <= conFrac + isoFrac) {
      repFrac = 0.5
    } else if (timeFrac <= conFrac + isoFrac + eccFrac) {
      const t = eccFrac > 0 ? (timeFrac - conFrac - isoFrac) / eccFrac : 1
      repFrac = 0.5 + t * 0.5  // linéaire 0.5→1
    } else {
      repFrac = 1.0
    }

    // Bosse 2 (milieu du path) — toujours du contexte à gauche et à droite, pas de coupure
    const pathPos = repLen + repFrac * repLen
    const pt = pathRef.current.getPointAtLength(pathPos)

    const viewBoxX = pt.x - WAVE_W / 2
    svgRef.current.setAttribute('viewBox', `${viewBoxX} 0 ${WAVE_W} ${WAVE_H}`)

    ballRef.current.setAttribute('cx', String(pt.x))
    ballRef.current.setAttribute('cy', String(pt.y))
    ballGlowRef.current.setAttribute('cx', String(pt.x))
    ballGlowRef.current.setAttribute('cy', String(pt.y))

    // ── Ball appearance (taille + glow) ──
    const isStaticPhase = (phase === 1 || phase === 3) && phaseMs > 200
    ballRef.current.setAttribute('fill', ballColor)
    ballRef.current.style.filter = `drop-shadow(0 0 16px ${ballColor}bb) drop-shadow(0 0 6px ${ballColor})`
    ballGlowRef.current.setAttribute('fill', ballColor)

    if (isStaticPhase) {
      const pulse = Math.sin(tInPhaseFrac * Math.PI)
      ballRef.current.setAttribute('r', String(18 + pulse * 3))
      ballGlowRef.current.setAttribute('r', String(28 + pulse * 8))
      ballGlowRef.current.setAttribute('opacity', String(0.20 + pulse * 0.15))
    } else {
      ballRef.current.setAttribute('r', '18')
      ballGlowRef.current.setAttribute('r', '28')
      ballGlowRef.current.setAttribute('opacity', '0.18')
    }

    // ── Trail ──
    const trail = trailRefs.current
    if (!isStaticPhase) {
      for (let i = TRAIL_LEN - 1; i > 0; i--) {
        const prev = trail[i - 1]
        if (prev) {
          trail[i]?.setAttribute('cx', prev.getAttribute('cx') ?? '0')
          trail[i]?.setAttribute('cy', prev.getAttribute('cy') ?? '0')
        }
      }
      trail[0]?.setAttribute('cx', String(pt.x))
      trail[0]?.setAttribute('cy', String(pt.y))
      trail.forEach((el, i) => {
        if (!el) return
        el.setAttribute('fill', ballColor)
        el.setAttribute('opacity', String(((TRAIL_LEN - i) / TRAIL_LEN) * 0.20))
        el.setAttribute('r', String(Math.max(13 - i * 1.5, 2)))
      })
    } else {
      trail.forEach(el => el?.setAttribute('opacity', '0'))
    }

    // ── Diamants — 5 points clés sur la bosse centrale ──
    // 0=creux gauche (repFrac=0)  → vert  (annonce concentrique = montée)
    // 1=montée intermédiaire (0.25) → vert (on monte, on va contracter)
    // 2=sommet (repFrac=0.5)      → bleu  (annonce excentrique = descente)
    // 3=descente intermédiaire (0.75) → bleu (on descend, on freine)
    // 4=creux droit (repFrac=1)   → vert  (annonce concentrique = prochaine montée)
    const diamondPositions = [0, 0.25, 0.5, 0.75, 1]
    const diamonds = diamondRefs.current
    if (diamonds.length >= 5) {
      diamondPositions.forEach((frac, idx) => {
        const dPathPos = repLen + frac * repLen
        const dPt = pathRef.current!.getPointAtLength(dPathPos)
        const el = diamonds[idx]
        if (!el) return
        // sommet et descente → bleu ; creux et montée → vert
        const dColor = (frac === 0.5 || frac === 0.75) ? '#3b82f6' : '#5dba87'
        el.setAttribute('fill', dColor)
        el.setAttribute('opacity', '0.65')
        el.setAttribute('transform', `translate(${dPt.x}, ${dPt.y})`)
      })
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [reps, repDuration, phaseDurations, vib, hapticsEnabled])

  useEffect(() => {
    if (countdown !== null) return
    if (paused) return  // RAF stoppé pendant pause
    if (resumeCountdown !== null) return  // RAF stoppé pendant countdown reprise
    // Ancrer startRef au moment exact du lancement — évite le drift du 1er frame RAF
    if (startRef.current === null) startRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick, countdown, paused, resumeCountdown])

  // ── Resume countdown tick ──
  useEffect(() => {
    if (resumeCountdown === null) return
    if (resumeCountdown === 0) {
      // Repartir : balle au début de la rep courante, startRef recalculé pour que tRep=0
      const elapsedAtPause = pausedAtRef.current ?? 0
      const repIndex = Math.floor(elapsedAtPause / repDuration)
      // Nouveau startRef : maintenant - (repIndex * repDuration) → tRep démarre à 0 de cette rep
      startRef.current = performance.now() - repIndex * repDuration
      pausedAtRef.current = null
      lastPhaseRef.current = -1  // force phase change pour redéclencher couleur/label
      setResumeCountdown(null)
      return
    }
    const t = setTimeout(() => setResumeCountdown(c => (c !== null && c > 0 ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [resumeCountdown, repDuration])

  // ── Tap handler : pause/play sur tap n'importe où ──
  const handleTap = useCallback(() => {
    if (countdown !== null) return
    if (resumeCountdown !== null) return
    if (autoFinished) return  // overlay gère l'interaction, tap ignoré

    if (!paused) {
      pausedAtRef.current = startRef.current !== null
        ? performance.now() - startRef.current
        : 0
      cancelAnimationFrame(rafRef.current)
      setPaused(true)
    } else {
      setPaused(false)
      setResumeCountdown(3)
    }
  }, [paused, countdown, resumeCountdown, autoFinished])

  // ── Derived (premier rendu uniquement — ensuite DOM direct) ──
  const visualPhaseValues = [
    parsed.concentric,
    parsed.isometric ?? parsed.pauseTop,
    parsed.eccentric,
    parsed.pause ?? parsed.pauseBottom,
  ]
  const phaseValue  = visualPhaseValues[currentPhase]
  const phaseIsX    = phaseValue === 'X'
  const phaseTotalS = phaseIsX ? 0.3 : (phaseValue as number)

  // ── SVG wave ──
  const waveEl = (
    <svg
      ref={svgRef}
      viewBox={`${-WAVE_W / 2} 0 ${WAVE_W} ${WAVE_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      {/* Path invisible pour mesure getTotalLength */}
      <path ref={pathRef} d={WAVE_PATH_D} fill="none" stroke="none" />

      {/* Wave track — plus épais */}
      <path
        d={WAVE_PATH_D}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Trail */}
      {Array.from({ length: TRAIL_LEN }).map((_, i) => (
        <circle
          key={i}
          ref={el => { if (el) trailRefs.current[i] = el }}
          r="10"
          fill="white"
          opacity="0"
        />
      ))}

      {/* Diamants — 5 points clés (creux gauche, montée, sommet, descente, creux droit) */}
      {[0, 1, 2, 3, 4].map(idx => (
        <polygon
          key={idx}
          ref={el => { if (el) diamondRefs.current[idx] = el }}
          points="-7,0 0,-7 7,0 0,7"
          fill={ACCENT_TEMPO}
          opacity="0.55"
          transform={`translate(${WAVE_W / 2}, ${WAVE_H / 2})`}
        />
      ))}

      {/* Glow */}
      <circle ref={ballGlowRef} r="28" fill={ACCENT_TEMPO} opacity="0.18" />

      {/* Ball — plus grosse, correspond au track */}
      <circle
        ref={ballRef}
        r="18"
        fill={PHASE_CONFIG[0].color}
        style={{ filter: `drop-shadow(0 0 16px ${PHASE_CONFIG[0].color}bb) drop-shadow(0 0 6px ${PHASE_CONFIG[0].color})` }}
      />
    </svg>
  )

  const PHASE_SUBLABELS = [t('tempo.phase.ecc'), t('tempo.phase.iso'), t('tempo.phase.con'), t('tempo.phase.pause')]

  // ── Rep bars — fenêtre glissante, N barres fixes, centrées ──
  // Fenêtre : toujours N barres à l'écran.
  // Quand bonusReps > 0 : la fenêtre avance — on perd la première barre complétée à gauche,
  // on gagne une nouvelle barre grise à droite.
  const BAR_COUNT = isLandscape ? 12 : 20  // nb fixe de barres visibles
  const barGap = 3
  const barContainerW = isLandscape ? 120 : 300
  const barW = Math.max(8, Math.floor((barContainerW - barGap * (BAR_COUNT - 1)) / BAR_COUNT))

  // windowStart : la fenêtre glisse pour garder currentRep visible.
  // Commence à 0 jusqu'à ce que currentRep dépasse BAR_COUNT-1.
  const windowStart = Math.max(0, currentRep - BAR_COUNT + 2)

  const repBarsEl = (
    <div
      className="flex flex-row items-center justify-center gap-[3px]"
      style={{ width: '100%' }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, slot) => {
        const i = windowStart + slot
        const isBonus   = i >= reps
        const isDone    = i < currentRep
        const isCurrent = i === currentRep
        const exists    = i < reps + bonusReps + 1  // +1 pour la barre courante
        return (
          <motion.div
            key={i}
            className="shrink-0 rounded-lg"
            style={{ width: barW, height: 28 }}
            animate={{
              backgroundColor: !exists
                ? 'rgba(255,255,255,0.06)'
                : isBonus
                  ? (isDone || isCurrent ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.07)')
                  : (isDone || isCurrent ? '#e0e0e0' : 'rgba(255,255,255,0.09)'),
              boxShadow: 'none',
            }}
            initial={false}
            transition={{ backgroundColor: { duration: 0.15 } }}
          />
        )
      })}
    </div>
  )

  return (
    <AnimatePresence onExitComplete={() => onClose(closingResult ?? { plannedReps: reps, bonusReps: 0, totalReps: reps })}>
      {!closing && (
        <motion.div
          key="tempo-guide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={handleTap}
          className="fixed inset-0 bg-[#080808] z-[60] select-none touch-none cursor-pointer"
          style={{ display: 'flex', flexDirection: isLandscape ? 'row' : 'column' }}
        >
          {/* ── Fond couleur synchronisé balle — lueur subtile centrée ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse 70% 40% at 50% 50%, ${phaseColor}18 0%, transparent 70%)`,
              transition: 'background 200ms ease-out',
              pointerEvents: 'none',
              opacity: (currentPhase === 1 || currentPhase === 3) ? undefined : 1,
              animation: (currentPhase === 1 || currentPhase === 3) ? 'tempoBgPulse 0.9s ease-in-out infinite' : 'none',
            }}
          />
          <style>{`
            @keyframes tempoBgPulse {
              0%, 100% { opacity: 0.5; }
              50%      { opacity: 1.0; }
            }
          `}</style>

          {/* ── Overlay PAUSE / TERMINÉ ── */}
          <AnimatePresence>
            {paused && (
              <motion.div
                key="pause-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute', inset: 0, zIndex: 5,
                  background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(4px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 20, pointerEvents: 'none',
                }}
              >
                {autoFinished ? (
                  /* ── Auto-pause : reps planifiées terminées ── */
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>✓</div>
                      <span style={{ fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: 28, color: '#5dba87', display: 'block', marginBottom: 4 }}>
                        {reps} rép. terminées
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Que veux-tu faire ?
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClose() }}
                        style={{
                          height: 48, padding: '0 24px', borderRadius: 14,
                          background: '#5dba87', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700,
                          fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#080808',
                        }}
                      >
                        Terminer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAutoFinished(false)
                          autoFinishedFiredRef.current = false
                          setPaused(false)
                          setResumeCountdown(3)
                        }}
                        style={{
                          height: 48, padding: '0 24px', borderRadius: 14,
                          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700,
                          fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)',
                        }}
                      >
                        Continuer
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Pause manuelle ── */
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClose() }}
                      style={{
                        position: 'absolute', top: 20, right: 20,
                        width: 36, height: 36, borderRadius: 12,
                        background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.12)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(255,255,255,0.70)', pointerEvents: 'auto',
                      }}
                    >
                      <X size={16} />
                    </button>
                    <span style={{ fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', fontSize: 32, color: 'white' }}>
                      PAUSE
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none' }}>
                      {t('tempo.tap_resume')}
                    </span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Overlay countdown reprise — 3..2..1 ── */}
          <AnimatePresence>
            {resumeCountdown !== null && resumeCountdown > 0 && (
              <motion.div
                key="resume-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute', inset: 0, zIndex: 6,
                  background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(4px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 12, pointerEvents: 'none',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={resumeCountdown}
                    initial={{ opacity: 0, scale: 1.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.22 }}
                    style={{ fontSize: 120, color: ACCENT_TEMPO, fontFamily: 'monospace', fontWeight: 900, lineHeight: 1 }}
                  >
                    {resumeCountdown}
                  </motion.span>
                </AnimatePresence>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                  Reprise
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {isLandscape ? (
            /* ══ LANDSCAPE ══
               Courbe plein hauteur à gauche, panneau contrôles à droite.
               Header intégré dans le panneau droit (pas de bande séparée). */
            <>
              {/* Courbe — occupe toute la hauteur, ~60% de la largeur */}
              <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
                {waveEl}
                {/* Countdown overlay — fond assombri + blur */}
                <AnimatePresence>
                  {countdown !== null && countdown > 0 && (
                    <motion.div
                      key="countdown-bg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.82)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none' }}
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={countdown}
                          initial={{ opacity: 0, scale: 1.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.22 }}
                          style={{ fontSize: 120, color: ACCENT_TEMPO, fontFamily: 'monospace', fontWeight: 900, lineHeight: 1 }}
                        >
                          {countdown}
                        </motion.span>
                      </AnimatePresence>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                        {t('tempo.position')}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {countdown === 0 && (
                    <motion.div key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 80, color: ACCENT_TEMPO, fontFamily: 'monospace', fontWeight: 900 }}>GO</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Panneau droit — 180px, flex-col, tout centré verticalement */}
              <div style={{ width: 180, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px 16px 16px 12px', borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Nom exercice + fermer */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Tempo</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{exerciseName}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)' }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Phase label + sous-label */}
                <div>
                  <span
                    ref={phaseLabelRef}
                    style={{ fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 20, color: countdown !== null ? ACCENT_TEMPO : phaseColor, display: 'block', marginBottom: 2 }}
                  >
                    {countdown !== null ? t('tempo.ready') : PHASE_CONFIG[currentPhase].label}
                  </span>
                  {countdown === null && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
                      {PHASE_SUBLABELS[currentPhase]}
                    </p>
                  )}
                </div>

                {/* Timer grand */}
                <div style={{ minHeight: 52 }}>
                  {countdown === null && phaseTotalS > 0 && (
                    <span
                      ref={phaseTimerRef}
                      style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 48, lineHeight: 1, color: phaseColor, display: 'block' }}
                    >
                      {phaseIsX ? 'X' : `${phaseTimer}s`}
                    </span>
                  )}
                </div>

                {/* Barres reps */}
                <div>{repBarsEl}</div>

                {/* Counter */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 32, lineHeight: 1, color: currentRep >= reps ? 'rgba(255,255,255,0.5)' : '#f2f2f2' }}>
                    {currentRep + 1}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>/</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 24, color: 'rgba(255,255,255,0.55)' }}>{reps}</span>
                  {bonusReps > 0 && <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>+{bonusReps}</span>}
                </div>
              </div>
            </>
          ) : (
            /* ══ PORTRAIT ══
               Header compact → Courbe flex-1 → Label+Timer → Barres → Counter */
            <>
              {/* Header */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 12px' }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Tempo guide</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{exerciseName}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Courbe — flex-1, prend tout l'espace disponible */}
              <div style={{ flex: '1 1 0', position: 'relative', minHeight: 0 }}>
                {waveEl}
                {/* Countdown portrait — fond assombri + blur */}
                <AnimatePresence>
                  {countdown !== null && countdown > 0 && (
                    <motion.div
                      key="countdown-bg-portrait"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.82)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none' }}
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={countdown}
                          initial={{ opacity: 0, scale: 1.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ duration: 0.22 }}
                          style={{ fontSize: 120, color: ACCENT_TEMPO, fontFamily: 'monospace', fontWeight: 900, lineHeight: 1 }}
                        >
                          {countdown}
                        </motion.span>
                      </AnimatePresence>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                        {t('tempo.position')}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {countdown === 0 && (
                    <motion.div key="go" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 96, color: ACCENT_TEMPO, fontFamily: 'monospace', fontWeight: 900 }}>GO</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Divider */}
              <div style={{ flexShrink: 0, height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 20px' }} />

              {/* Label + sous-label */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 8px' }}>
                <span
                  ref={phaseLabelRef}
                  style={{ fontFamily: 'var(--font-barlow-condensed, sans-serif)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', fontSize: 28, color: countdown !== null ? ACCENT_TEMPO : phaseColor }}
                >
                  {countdown !== null ? 'PRÊT' : PHASE_CONFIG[currentPhase].label}
                </span>
                {countdown === null && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 3, letterSpacing: '0.06em' }}>
                    {PHASE_SUBLABELS[currentPhase]}
                  </p>
                )}
              </div>

              {/* Timer */}
              <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', minHeight: 72, alignItems: 'center', paddingBottom: 8 }}>
                {countdown === null && phaseTotalS > 0 && (
                  <span
                    ref={phaseTimerRef}
                    style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 64, lineHeight: 1, color: phaseColor }}
                  >
                    {phaseIsX ? 'X' : `${phaseTimer}s`}
                  </span>
                )}
              </div>

              {/* Barres reps */}
              <div style={{ flexShrink: 0, padding: '0 20px 12px' }}>
                {repBarsEl}
              </div>

              {/* Counter */}
              <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 6, paddingBottom: 40 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 52, lineHeight: 1, color: currentRep >= reps ? 'rgba(255,255,255,0.5)' : '#f2f2f2' }}>
                  {currentRep + 1}
                </span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 28, color: 'rgba(255,255,255,0.2)' }}>/</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 36, color: 'rgba(255,255,255,0.55)' }}>{reps}</span>
                {bonusReps > 0 && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>+{bonusReps}</span>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
