import { describe, expect, it } from 'vitest'
import {
  evaluateTdeeObservationTransition,
  hasCurrentTdeeSkip,
  type ClientTdeeStateRow,
} from '@/lib/nutrition/tdee-state'

function makeState(overrides: Partial<ClientTdeeStateRow>): ClientTdeeStateRow {
  return {
    client_id: 'client-1',
    current_tdee: 2200,
    current_tdee_at: '2026-07-13T04:00:00.000Z',
    latest_observed_tdee: 2200,
    latest_observed_at: '2026-07-13T04:00:00.000Z',
    confidence: 'medium',
    confidence_score: 60,
    confidence_reasons: [],
    source: 'weight_delta',
    method_version: 'adaptive_tdee_v3',
    stability_status: 'stable',
    pending_direction: null,
    pending_delta_kcal: null,
    pending_streak: 0,
    last_attempt_at: '2026-07-13T04:00:00.000Z',
    last_success_at: '2026-07-13T04:00:00.000Z',
    last_skip_at: null,
    last_skip_reason: null,
    last_error_at: null,
    last_error: null,
    window_days: 14,
    tracked_days: 10,
    weight_samples: 5,
    excluded_current_day: true,
    anchored_to_protocol: true,
    smoothed_weight_used: true,
    applied_luteal_correction: false,
    estimation_status: 'observing',
    data_quality_score: 65,
    data_quality_reasons: [],
    auto_enabled: false,
    current_tdee_lower: 2100,
    current_tdee_upper: 2300,
    latest_observed_lower: 2100,
    latest_observed_upper: 2300,
    actionable_streak: 0,
    context_changed_at: null,
    created_at: '2026-07-01T04:00:00.000Z',
    updated_at: '2026-07-13T04:00:00.000Z',
    ...overrides,
  }
}

describe('hasCurrentTdeeSkip', () => {
  it('hides a skip superseded by a successful calculation', () => {
    expect(hasCurrentTdeeSkip(makeState({
      last_skip_at: '2026-07-10T04:00:00.000Z',
      last_skip_reason: 'window_too_short_since_protocol_start',
      last_success_at: '2026-07-13T04:00:00.000Z',
    }))).toBe(false)
  })

  it('keeps the latest skip visible until a successful calculation occurs', () => {
    expect(hasCurrentTdeeSkip(makeState({
      last_skip_at: '2026-07-14T04:00:00.000Z',
      last_skip_reason: 'low_confidence',
      last_success_at: '2026-07-13T04:00:00.000Z',
    }))).toBe(true)
  })
})

describe('evaluateTdeeObservationTransition', () => {
  it('keeps a non-actionable estimate in shadow mode', () => {
    expect(evaluateTdeeObservationTransition(null, {
      tdeeAdaptive: 2250,
      confidenceScore: 70,
      estimationStatus: 'observing',
    })).toMatchObject({
      currentTdee: null,
      updateOutcome: 'noise',
    })
  })

  it('requires two consecutive actionable windows before initializing a client TDEE', () => {
    const first = evaluateTdeeObservationTransition(null, {
      tdeeAdaptive: 2250,
      confidenceScore: 90,
      estimationStatus: 'actionable',
    })
    const second = evaluateTdeeObservationTransition(makeState({
      current_tdee: null,
      actionable_streak: 1,
      estimation_status: 'actionable',
    }), {
      tdeeAdaptive: 2250,
      confidenceScore: 90,
      estimationStatus: 'actionable',
    })

    expect(first).toMatchObject({ currentTdee: null, updateOutcome: 'noise' })
    expect(second).toMatchObject({ currentTdee: 2250, updateOutcome: 'initialized' })
  })
})
