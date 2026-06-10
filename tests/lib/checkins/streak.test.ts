import { describe, it, expect } from 'vitest'
import { evaluateStreak, shouldResetStreak, isLateCheckin } from '@/lib/checkins/streak'
import type { StreakState } from '@/lib/checkins/streak'

const empty: StreakState = { current_streak: 0, longest_streak: 0, last_checkin_date: null }
const allDays = [0, 1, 2, 3, 4, 5, 6]
const weekdays = [0, 1, 2, 3, 4] // Mon–Fri

describe('isLateCheckin', () => {
  it('returns false for on-time checkin', () => {
    const respondedAt = new Date('2026-04-29T20:00:00Z')
    expect(isLateCheckin(respondedAt, '2026-04-29')).toBe(false)
  })

  it('returns true for checkin in grace window (00h–02h next day)', () => {
    const respondedAt = new Date('2026-04-30T01:00:00Z')
    expect(isLateCheckin(respondedAt, '2026-04-29')).toBe(true)
  })

  it('returns false after 02h00 next day', () => {
    const respondedAt = new Date('2026-04-30T03:00:00Z')
    expect(isLateCheckin(respondedAt, '2026-04-29')).toBe(false)
  })
})

describe('evaluateStreak', () => {
  it('first ever checkin sets streak to 1', () => {
    const result = evaluateStreak(empty, '2026-04-29', false, allDays)
    expect(result.current_streak).toBe(1)
    expect(result.longest_streak).toBe(1)
    expect(result.last_checkin_date).toBe('2026-04-29')
  })

  it('late first checkin does not increment streak', () => {
    const result = evaluateStreak(empty, '2026-04-29', true, allDays)
    expect(result.current_streak).toBe(0)
  })

  it('consecutive day increments streak', () => {
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-28' }
    const result = evaluateStreak(state, '2026-04-29', false, allDays)
    expect(result.current_streak).toBe(4)
    expect(result.longest_streak).toBe(4)
  })

  it('consecutive late preserves streak, does not increment', () => {
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-28' }
    const result = evaluateStreak(state, '2026-04-29', true, allDays)
    expect(result.current_streak).toBe(3)
    expect(result.longest_streak).toBe(3)
  })

  it('gap of 1 non-configured day does not break streak', () => {
    // Mon=0, Tue=1, Thu=3, Fri=4 — skip Wed=2
    const state: StreakState = { current_streak: 2, longest_streak: 2, last_checkin_date: '2026-04-28' } // Tue
    // Thu — Wed is not in config [0,1,3,4]
    const result = evaluateStreak(state, '2026-04-30', false, [0, 1, 3, 4])
    expect(result.current_streak).toBe(3)
  })

  it('gap skipping a configured day resets streak', () => {
    const state: StreakState = { current_streak: 5, longest_streak: 5, last_checkin_date: '2026-04-27' } // Mon
    // Wed checkin, skipped Tue (configured)
    const result = evaluateStreak(state, '2026-04-29', false, allDays)
    expect(result.current_streak).toBe(1)
  })

  it('duplicate checkin same day is no-op', () => {
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-29' }
    const result = evaluateStreak(state, '2026-04-29', false, allDays)
    expect(result.current_streak).toBe(3)
  })

  it('updates longest_streak when current exceeds it', () => {
    const state: StreakState = { current_streak: 9, longest_streak: 9, last_checkin_date: '2026-04-28' }
    const result = evaluateStreak(state, '2026-04-29', false, allDays)
    expect(result.longest_streak).toBe(10)
  })

  it('longest_streak not regressed when current is lower', () => {
    const state: StreakState = { current_streak: 1, longest_streak: 20, last_checkin_date: '2026-04-28' }
    const result = evaluateStreak(state, '2026-04-29', false, allDays)
    expect(result.longest_streak).toBe(20)
  })
})

describe('shouldResetStreak', () => {
  it('returns false if no last_checkin_date', () => {
    expect(shouldResetStreak(empty, '2026-04-29', allDays)).toBe(false)
  })

  it('returns false if streak already 0', () => {
    const state: StreakState = { current_streak: 0, longest_streak: 5, last_checkin_date: '2026-04-27' }
    expect(shouldResetStreak(state, '2026-04-29', allDays)).toBe(false)
  })

  it('returns false if last checkin was yesterday', () => {
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-28' }
    expect(shouldResetStreak(state, '2026-04-29', allDays)).toBe(false)
  })

  it('returns true if a configured day was skipped', () => {
    // Last checkin Mon, today is Wed — Tue (configured) was missed
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-27' }
    expect(shouldResetStreak(state, '2026-04-29', allDays)).toBe(true)
  })

  it('returns false if only non-configured days were skipped', () => {
    // Last checkin Mon, today is Wed — Tue NOT in config
    const state: StreakState = { current_streak: 3, longest_streak: 3, last_checkin_date: '2026-04-27' }
    expect(shouldResetStreak(state, '2026-04-29', [0, 2, 3, 4, 5, 6])).toBe(false)
  })
})
