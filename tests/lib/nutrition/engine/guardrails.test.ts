import { describe, it, expect } from 'vitest'
import {
  checkAdherenceGuardrail,
  checkFatigueGuardrail,
  runGuardrails,
} from '@/lib/nutrition/engine/guardrails'

describe('checkAdherenceGuardrail', () => {
  it('blocks when adherence < 85%', () => {
    const result = checkAdherenceGuardrail(0.80)
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('adherence_block')
  })

  it('blocks at exactly 84.9%', () => {
    expect(checkAdherenceGuardrail(0.849).blocked).toBe(true)
  })

  it('allows at exactly 85%', () => {
    expect(checkAdherenceGuardrail(0.85).blocked).toBe(false)
  })

  it('allows at 100%', () => {
    expect(checkAdherenceGuardrail(1.0).blocked).toBe(false)
  })

  it('allows when adherence is null (no data)', () => {
    expect(checkAdherenceGuardrail(null).blocked).toBe(false)
  })
})

describe('checkFatigueGuardrail', () => {
  it('blocks when sleep < 6h + 3+ consecutive fatigue days', () => {
    const result = checkFatigueGuardrail({
      avgSleepH: 5.5,
      avgEnergyLevel: 3,
      avgStressLevel: 3,
      consecutiveFatigueDays: 3,
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('fatigue_block')
  })

  it('blocks when energy ≤ 2 + 3+ consecutive fatigue days', () => {
    const result = checkFatigueGuardrail({
      avgSleepH: 7,
      avgEnergyLevel: 2,
      avgStressLevel: 2,
      consecutiveFatigueDays: 4,
    })
    expect(result.blocked).toBe(true)
  })

  it('blocks when stress ≥ 4 + 3+ consecutive fatigue days', () => {
    const result = checkFatigueGuardrail({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 4,
      consecutiveFatigueDays: 3,
    })
    expect(result.blocked).toBe(true)
  })

  it('does NOT block when only 2 consecutive fatigue days', () => {
    const result = checkFatigueGuardrail({
      avgSleepH: 5,
      avgEnergyLevel: 2,
      avgStressLevel: 5,
      consecutiveFatigueDays: 2,
    })
    expect(result.blocked).toBe(false)
  })

  it('does NOT block when all signals are normal', () => {
    const result = checkFatigueGuardrail({
      avgSleepH: 7.5,
      avgEnergyLevel: 4,
      avgStressLevel: 2,
      consecutiveFatigueDays: 0,
    })
    expect(result.blocked).toBe(false)
  })
})

describe('runGuardrails', () => {
  it('returns adherence_block first when both triggered', () => {
    const result = runGuardrails({
      adherencePct: 0.70,
      avgSleepH: 4,
      avgEnergyLevel: 1,
      avgStressLevel: 5,
      consecutiveFatigueDays: 5,
    })
    expect(result.triggered).toBe('adherence_block')
  })

  it('returns null when no guardrails triggered', () => {
    const result = runGuardrails({
      adherencePct: 0.95,
      avgSleepH: 7.5,
      avgEnergyLevel: 4,
      avgStressLevel: 2,
      consecutiveFatigueDays: 0,
    })
    expect(result.triggered).toBeNull()
  })
})
