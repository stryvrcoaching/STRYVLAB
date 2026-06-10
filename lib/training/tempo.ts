// Tempo d'exécution — 4 phases: Concentrique-Isométrique-Excentrique-Pause
// Notation: "2-2-3-1" = 2s montée, 2s contraction max, 3s descente, 1s position initiale
// Valeur spéciale: "X" = explosif (aussi vite que possible)

export type TempoPhase = number | 'X'

export interface ParsedTempo {
  concentric: TempoPhase
  isometric?: TempoPhase
  eccentric: TempoPhase
  pause?: TempoPhase
  // Backward-compatible aliases for older call sites.
  pauseBottom: TempoPhase
  pauseTop: TempoPhase
}

// Parse "2-2-3-1" or "X-0-X-0" into structured object.
// Returns null if format is invalid (not 4 parts, non-numeric/X values, out of range).
export function parseTempo(raw: string): ParsedTempo | null {
  if (!raw || typeof raw !== 'string') return null
  const parts = raw.trim().split('-')
  if (parts.length !== 4) return null
  const parsed: TempoPhase[] = []
  for (const part of parts) {
    const upper = part.toUpperCase()
    if (upper === 'X') {
      parsed.push('X')
    } else {
      const n = parseInt(upper, 10)
      if (isNaN(n) || n < 0 || n > 8) return null
      // Reject if part has non-numeric chars (e.g. "1a")
      if (!/^\d+$/.test(upper)) return null
      parsed.push(n)
    }
  }
  return {
    concentric: parsed[0],
    isometric: parsed[1],
    eccentric: parsed[2],
    pause: parsed[3],
    pauseBottom: parsed[3],
    pauseTop: parsed[1],
  }
}

// Format parsed tempo back to canonical string
export function formatTempo(t: ParsedTempo): string {
  const fmt = (p: TempoPhase) => (p === 'X' ? 'X' : String(p))
  return `${fmt(t.concentric)}-${fmt(t.isometric ?? t.pauseTop)}-${fmt(t.eccentric)}-${fmt(t.pause ?? t.pauseBottom)}`
}

// Time Under Tension in seconds for a given parsed tempo and rep count.
// X phases count as 1s (explosive — near-zero time but not zero for calculation).
export function calcTUT(t: ParsedTempo, reps: number): number {
  const val = (p: TempoPhase) => (p === 'X' ? 1 : p)
  return (val(t.concentric) + val(t.isometric ?? t.pauseTop) + val(t.eccentric) + val(t.pause ?? t.pauseBottom)) * reps
}

// ─── Default Tempos ────────────────────────────────────────────────────────────
// Scientific basis:
//   Hypertrophy: maximize TUT — controlled concentric, optional iso, long eccentric
//   Strength: explosive concentric (X), controlled eccentric for safety
//   Endurance: moderate tempo (2-0-2-0) — sustainable over high reps
//
// Called at render-time only. Result is NEVER persisted when coach hasn't set tempo.

type MovementPattern = string | null | undefined

// Isolation patterns — single-joint movements. Stay controlled even for strength.
const ISOLATION_PATTERNS = new Set([
  'elbow_flexion',
  'elbow_extension',
  'lateral_raise',
  'calf_raise',
  'hip_abduction',
  'hip_adduction',
  'shoulder_rotation',
])

// Per-pattern hypertrophy tempos — research-based TUT targets
const HYPERTROPHY_TEMPO_MAP: Record<string, string> = {
  vertical_pull:         '2-1-3-1', // lat sous tension excentrique + 1s contraction haute
  horizontal_pull:       '2-1-3-1', // rowing : squeeze omoplate 1s
  vertical_push:         '2-1-2-1', // overhead : contraction deltoïde au sommet
  horizontal_push:       '2-1-3-1', // pec sous tension en allongé
  hip_hinge:             '1-1-3-1', // ischio excentrique + 1s contraction fessier au sommet
  squat_pattern:         '2-1-3-1', // quad : 1s verrouillage genou haut
  knee_flexion:          '2-1-3-1', // leg curl : contraction ischio 1s
  knee_extension:        '2-1-3-0', // leg extension : contraction quad 1s
  elbow_flexion:         '2-1-3-1', // biceps : contraction pic 1s
  elbow_extension:       '2-1-3-1', // triceps : verrouillage coude 1s
  lateral_raise:         '2-1-2-1', // déjà à 1 — maintenu
  calf_raise:            '2-1-2-1', // mollet : contraction plantar 1s
  hip_abduction:         '2-1-2-1', // fessier moyen : contraction abduction 1s
  hip_adduction:         '2-1-2-1', // adducteur : 1s
  shoulder_rotation:     '2-1-2-1', // coiffe : 1s
  core_anti_flex:        '2-1-2-1', // déjà à 1 — maintenu
  core_flex:             '2-1-2-1', // déjà à 1 — maintenu
  core_rotation:         '2-1-2-1', // déjà à 1 — maintenu
  carry:                 '2-1-2-0', // farmer carry : tension isométrique portée
  scapular_elevation:    '2-1-2-1', // haussement : sommet 1s
  scapular_retraction:   '2-1-2-1', // rétraction : squeeze 1s
  scapular_protraction:  '2-1-2-0', // protraction : 1s
}

const STRENGTH_COMPOUND  = 'X-0-2-0' // explosif concentrique
const STRENGTH_ISOLATION = '2-0-2-0' // contrôlé même en force
const ENDURANCE_DEFAULT  = '2-0-2-0'
const FALLBACK_DEFAULT   = '2-0-2-0'

/**
 * Returns the recommended tempo string for a movement pattern and program goal.
 * Always returns a valid string — never null.
 * Called at render-time; result is NEVER persisted when coach hasn't set a tempo.
 */
export function getDefaultTempo(pattern: MovementPattern, goal: string): string {
  const g = (goal ?? '').toLowerCase()

  if (g === 'endurance' || g === 'athletic') {
    return ENDURANCE_DEFAULT
  }

  if (g === 'strength' || g === 'fat_loss' || g === 'maintenance') {
    if (pattern && ISOLATION_PATTERNS.has(pattern)) {
      return STRENGTH_ISOLATION
    }
    return STRENGTH_COMPOUND
  }

  // hypertrophy, recomp, unknown → per-pattern hypertrophy map
  if (pattern && HYPERTROPHY_TEMPO_MAP[pattern]) {
    return HYPERTROPHY_TEMPO_MAP[pattern]
  }

  return FALLBACK_DEFAULT
}
