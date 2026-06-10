import { describe, it, expect } from 'vitest'
import {
  parseTempo,
  formatTempo,
  getDefaultTempo,
  calcTUT,
} from '@/lib/training/tempo'

describe('parseTempo', () => {
  it('parses a standard tempo string', () => {
    const result = parseTempo('2-2-3-1')
    expect(result).toEqual({ concentric: 2, isometric: 2, eccentric: 3, pause: 1, pauseBottom: 1, pauseTop: 2 })
  })

  it('parses X phases as "X"', () => {
    const result = parseTempo('X-0-2-0')
    expect(result).toEqual({ concentric: 'X', isometric: 0, eccentric: 2, pause: 0, pauseBottom: 0, pauseTop: 0 })
  })

  it('parses all-X tempo', () => {
    const result = parseTempo('X-X-X-X')
    expect(result).toEqual({ concentric: 'X', isometric: 'X', eccentric: 'X', pause: 'X', pauseBottom: 'X', pauseTop: 'X' })
  })

  it('returns null for invalid format — only 3 parts', () => {
    expect(parseTempo('1-2-3')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseTempo('')).toBeNull()
  })

  it('returns null for 5 parts', () => {
    expect(parseTempo('1-2-3-4-5')).toBeNull()
  })

  it('returns null for out-of-range eccentric > 8', () => {
    expect(parseTempo('10-1-2-0')).toBeNull()
  })

  it('returns null for negative value', () => {
    expect(parseTempo('-1-1-2-0')).toBeNull()
  })

  it('returns null for non-numeric non-X value', () => {
    expect(parseTempo('abc')).toBeNull()
    expect(parseTempo('a-b-c-d')).toBeNull()
  })
})

describe('formatTempo', () => {
  it('formats a parsed tempo back to string', () => {
    expect(formatTempo({ concentric: 2, isometric: 2, eccentric: 3, pause: 1, pauseBottom: 1, pauseTop: 2 })).toBe('2-2-3-1')
  })

  it('formats X phases correctly', () => {
    expect(formatTempo({ concentric: 'X', isometric: 0, eccentric: 2, pause: 0, pauseBottom: 0, pauseTop: 0 })).toBe('X-0-2-0')
  })
})

describe('getDefaultTempo', () => {
  // Hypertrophy defaults — per-pattern
  it('returns 2-1-3-1 for vertical_pull + hypertrophy', () => {
    expect(getDefaultTempo('vertical_pull', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 2-1-3-1 for horizontal_pull + hypertrophy', () => {
    expect(getDefaultTempo('horizontal_pull', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 2-1-2-1 for vertical_push + hypertrophy', () => {
    expect(getDefaultTempo('vertical_push', 'hypertrophy')).toBe('2-1-2-1')
  })

  it('returns 2-1-3-1 for horizontal_push + hypertrophy', () => {
    expect(getDefaultTempo('horizontal_push', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 1-1-3-1 for hip_hinge + hypertrophy', () => {
    expect(getDefaultTempo('hip_hinge', 'hypertrophy')).toBe('1-1-3-1')
  })

  it('returns 2-1-3-1 for knee_flexion + hypertrophy', () => {
    expect(getDefaultTempo('knee_flexion', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 2-1-3-0 for knee_extension + hypertrophy', () => {
    expect(getDefaultTempo('knee_extension', 'hypertrophy')).toBe('2-1-3-0')
  })

  it('returns 2-1-3-1 for elbow_flexion + hypertrophy (isolation)', () => {
    expect(getDefaultTempo('elbow_flexion', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 2-1-3-1 for elbow_extension + hypertrophy (isolation)', () => {
    expect(getDefaultTempo('elbow_extension', 'hypertrophy')).toBe('2-1-3-1')
  })

  it('returns 2-1-2-1 for core_anti_flex + hypertrophy', () => {
    expect(getDefaultTempo('core_anti_flex', 'hypertrophy')).toBe('2-1-2-1')
  })

  // Strength defaults — explosive concentric on compounds
  it('returns X-0-2-0 for vertical_pull + strength', () => {
    expect(getDefaultTempo('vertical_pull', 'strength')).toBe('X-0-2-0')
  })

  it('returns X-0-2-0 for horizontal_push + strength', () => {
    expect(getDefaultTempo('horizontal_push', 'strength')).toBe('X-0-2-0')
  })

  it('returns X-0-2-0 for squat_pattern + strength', () => {
    expect(getDefaultTempo('squat_pattern', 'strength')).toBe('X-0-2-0')
  })

  it('returns 2-0-2-0 for elbow_flexion + strength (isolation stays controlled)', () => {
    expect(getDefaultTempo('elbow_flexion', 'strength')).toBe('2-0-2-0')
  })

  // Endurance defaults — moderate tempo
  it('returns 2-0-2-0 for vertical_pull + endurance', () => {
    expect(getDefaultTempo('vertical_pull', 'endurance')).toBe('2-0-2-0')
  })

  it('returns 2-0-2-0 for hip_hinge + endurance', () => {
    expect(getDefaultTempo('hip_hinge', 'endurance')).toBe('2-0-2-0')
  })

  // Null / unknown pattern fallback
  it('returns 2-0-2-0 for null pattern', () => {
    expect(getDefaultTempo(null, 'hypertrophy')).toBe('2-0-2-0')
  })

  it('returns 2-0-2-0 for unknown pattern', () => {
    expect(getDefaultTempo('unknown_pattern', 'hypertrophy')).toBe('2-0-2-0')
  })

  // Unknown goal fallback to hypertrophy map
  it('falls back to hypertrophy defaults for unknown goal', () => {
    expect(getDefaultTempo('vertical_pull', 'unknown_goal')).toBe('2-1-3-1')
  })
})

describe('calcTUT', () => {
  it('calculates TUT for a standard tempo + reps', () => {
    // 2-2-3-1 × 10 reps = (2+2+3+1) × 10 = 80s
    const parsed = parseTempo('2-2-3-1')!
    expect(calcTUT(parsed, 10)).toBe(80)
  })

  it('treats X phases as 1 second for TUT calculation', () => {
    // X-0-2-0 × 5 reps = (1+0+2+0) × 5 = 15s
    const parsed = parseTempo('X-0-2-0')!
    expect(calcTUT(parsed, 5)).toBe(15)
  })

  it('returns 0 for 0 reps', () => {
    const parsed = parseTempo('2-2-3-1')!
    expect(calcTUT(parsed, 0)).toBe(0)
  })
})
