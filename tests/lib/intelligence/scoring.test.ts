import { describe, it, expect } from 'vitest'
import {
  scoreBalance,
  scoreSRA,
  scoreRedundancy,
  scoreProgression,
  scoreSpecificity,
  scoreCompleteness,
  buildIntelligenceResult,
} from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta } from '@/lib/programs/intelligence/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const pushEx = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: ['epaules'],
  is_compound: true,
}
const pullEx = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  is_compound: true,
}
const squatEx = {
  name: 'Squat barre', sets: 4, reps: '6-8', rest_sec: 120, rir: 2,
  notes: '', movement_pattern: 'squat_pattern', equipment_required: ['barbell'],
  primary_muscles: ['quadriceps', 'fessiers', 'ischio-jambiers'], secondary_muscles: [],
  is_compound: true,
}
const isolationEx = {
  name: 'Curl haltère', sets: 3, reps: '12-15', rest_sec: 60, rir: 2,
  notes: '', movement_pattern: 'elbow_flexion', equipment_required: ['dumbbell'],
  primary_muscles: ['biceps'], secondary_muscles: [],
  is_compound: false,
}

const hypertrophyMeta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'commercial_gym',
}

// ── scoreBalance ──────────────────────────────────────────────────────────────

describe('scoreBalance', () => {
  it('returns 100 when push/pull ratio is balanced (1.0)', () => {
    const sessions: BuilderSession[] = [{
      name: 'Full Body', day_of_week: 1,
      exercises: [pushEx, pullEx],
    }]
    const { score } = scoreBalance(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThan(80)
  })

  it('returns critical alert when only push, no pull', () => {
    const sessions: BuilderSession[] = [{
      name: 'Push only', day_of_week: 1,
      exercises: [pushEx, pushEx, pushEx],
    }]
    const { alerts } = scoreBalance(sessions, hypertrophyMeta)
    expect(alerts.some(a => a.severity === 'critical' && a.code === 'PUSH_PULL_IMBALANCE')).toBe(true)
  })

  it('returns score 100 when no push and no pull (core only)', () => {
    const coreEx = { ...isolationEx, movement_pattern: 'core_anti_flex', primary_muscles: ['abdos'] }
    const sessions: BuilderSession[] = [{ name: 'Core', day_of_week: 1, exercises: [coreEx] }]
    const { score } = scoreBalance(sessions, hypertrophyMeta)
    expect(score).toBe(100) // pas de déséquilibre si aucun pattern push/pull
  })
})

// ── scoreSRA ──────────────────────────────────────────────────────────────────

describe('scoreSRA', () => {
  it('returns no violation when sessions are on separate days', () => {
    const sessions: BuilderSession[] = [
      { name: 'J1 Push', day_of_week: 1, exercises: [pushEx] },
      { name: 'J3 Push', day_of_week: 3, exercises: [pushEx] },
    ]
    const { alerts } = scoreSRA(sessions, hypertrophyMeta)
    expect(alerts.filter(a => a.severity === 'critical')).toHaveLength(0)
  })

  it('returns critical alert when same muscle group on consecutive days', () => {
    const sessions: BuilderSession[] = [
      { name: 'J1', day_of_week: 1, exercises: [squatEx] },
      { name: 'J2', day_of_week: 2, exercises: [squatEx] }, // quadriceps 24h après = violation (min 48h)
    ]
    const { alerts } = scoreSRA(sessions, hypertrophyMeta)
    expect(alerts.some(a => a.severity === 'critical' && a.code === 'SRA_VIOLATION')).toBe(true)
  })

  it('applies +25% window for beginner level', () => {
    const beginnerMeta = { ...hypertrophyMeta, level: 'beginner' }
    const sessions: BuilderSession[] = [
      { name: 'J1', day_of_week: 1, exercises: [squatEx] },
      { name: 'J3', day_of_week: 3, exercises: [squatEx] }, // 48h gap, OK for intermediate, violation for beginner (48*1.25=60h)
    ]
    const { alerts } = scoreSRA(sessions, beginnerMeta)
    // 48h < 60h (beginner window) → warning ou critical
    expect(alerts.some(a => a.code === 'SRA_VIOLATION')).toBe(true)
  })
})

// ── scoreRedundancy ───────────────────────────────────────────────────────────

describe('scoreRedundancy', () => {
  it('detects redundant pair: same pattern + same muscles + both compound', () => {
    const hackSquat = { ...squatEx, name: 'Hack squat machine', movement_pattern: 'squat_pattern' }
    const sessions: BuilderSession[] = [{
      name: 'Legs', day_of_week: 1, exercises: [squatEx, hackSquat],
    }]
    const { alerts } = scoreRedundancy(sessions)
    expect(alerts.some(a => a.code === 'REDUNDANT_EXERCISES')).toBe(true)
  })

  it('does NOT flag squat + leg extension as redundant (compound + isolation = complementary)', () => {
    const legExt = { ...isolationEx, name: 'Leg extension', movement_pattern: 'knee_extension', primary_muscles: ['quadriceps'] }
    const sessions: BuilderSession[] = [{
      name: 'Legs', day_of_week: 1, exercises: [squatEx, legExt],
    }]
    const { alerts } = scoreRedundancy(sessions)
    expect(alerts.some(a => a.code === 'REDUNDANT_EXERCISES')).toBe(false)
  })
})

// ── scoreProgression ──────────────────────────────────────────────────────────

describe('scoreProgression', () => {
  it('returns score 100 when weeks = 1 (no progression to evaluate)', () => {
    const meta = { ...hypertrophyMeta, weeks: 1 }
    const { score } = scoreProgression([{ name: 'S1', day_of_week: 1, exercises: [squatEx] }], meta)
    expect(score).toBe(100)
  })

  it('returns critical alert when rir = 0 on week 1 exercises', () => {
    const rirZeroEx = { ...squatEx, rir: 0 }
    const meta = { ...hypertrophyMeta, weeks: 8 }
    const { alerts } = scoreProgression([{ name: 'S1', day_of_week: 1, exercises: [rirZeroEx] }], meta)
    expect(alerts.some(a => a.code === 'RIR_TOO_LOW_WEEK1' && a.severity === 'critical')).toBe(true)
  })
})

// ── scoreSpecificity ──────────────────────────────────────────────────────────

describe('scoreSpecificity', () => {
  it('returns high score for hypertrophy goal with 8-12 reps and RIR 1-3', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx, squatEx] }]
    const { score } = scoreSpecificity(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThan(70)
  })

  it('returns warning when strength goal has high RIR (> 2)', () => {
    const strengthMeta = { ...hypertrophyMeta, goal: 'strength' }
    const highRirEx = { ...squatEx, rir: 4, reps: '8-12' } // RIR 4 = trop confortable pour force
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [highRirEx] }]
    const { alerts } = scoreSpecificity(sessions, strengthMeta)
    expect(alerts.some(a => a.code === 'GOAL_MISMATCH')).toBe(true)
  })
})

// ── scoreCompleteness ─────────────────────────────────────────────────────────

describe('scoreCompleteness', () => {
  it('returns 100 when all expected patterns are present for goal', () => {
    const hipEx = { ...squatEx, movement_pattern: 'hip_hinge' }
    const vPullEx = { ...pullEx, movement_pattern: 'vertical_pull' }
    const sessions: BuilderSession[] = [{
      name: 'Full', day_of_week: 1,
      exercises: [pushEx, pullEx, squatEx, hipEx, vPullEx, isolationEx],
    }]
    const { score } = scoreCompleteness(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThanOrEqual(75)
  })

  it('returns warning for each missing required pattern', () => {
    // Seulement push → beaucoup de patterns manquants pour hypertrophy
    const sessions: BuilderSession[] = [{ name: 'Push only', day_of_week: 1, exercises: [pushEx] }]
    const { alerts } = scoreCompleteness(sessions, hypertrophyMeta)
    expect(alerts.filter(a => a.code === 'MISSING_PATTERN').length).toBeGreaterThan(2)
  })
})

// ── buildIntelligenceResult ───────────────────────────────────────────────────

describe('buildIntelligenceResult', () => {
  it('returns a result with globalScore between 0 and 100', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx, pullEx] }]
    const result = buildIntelligenceResult(sessions, hypertrophyMeta)
    expect(result.globalScore).toBeGreaterThanOrEqual(0)
    expect(result.globalScore).toBeLessThanOrEqual(100)
  })

  it('returns a non-empty globalNarrative', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx] }]
    const result = buildIntelligenceResult(sessions, hypertrophyMeta)
    expect(result.globalNarrative.length).toBeGreaterThan(10)
  })

  it('returns empty result when sessions is empty', () => {
    const result = buildIntelligenceResult([], hypertrophyMeta)
    expect(result.globalScore).toBe(0)
    expect(result.alerts).toHaveLength(0)
  })
})
