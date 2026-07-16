import { describe, expect, it } from 'vitest'
import { generateRecommendations } from '@/lib/performance/recommendations'
import type { PerformanceAnalysis } from '@/lib/performance/analyzer'

describe('generateRecommendations', () => {
  it('maps canonical analysis entries back to program exercise UUIDs', () => {
    const analysis: PerformanceAnalysis = {
      analysis_period_weeks: 8,
      global_overreaching: false,
      exercises: [
        {
          exercise_id: 'catalog:leg-extension',
          exercise_name: 'Leg Extension',
          sessions_count: 4,
          completion_rate: 1,
          avg_rir: 4,
          rir_trend: 'stable',
          overloads_last_4_weeks: 1,
          stagnation: false,
          overreaching: false,
        },
      ],
    }

    const recommendations = generateRecommendations(analysis, {
      exercises: [
        {
          id: '8f9cf4fc-f0dc-4510-b4f8-f9f7fb8650d3',
          name: 'Leg Extension',
          sets: 3,
          current_weight_kg: 55,
        },
      ],
    })

    expect(recommendations).toHaveLength(1)
    expect(recommendations[0]?.exercise_id).toBe('8f9cf4fc-f0dc-4510-b4f8-f9f7fb8650d3')
    expect(recommendations[0]?.type).toBe('increase_volume')
  })

  it('keeps null exercise_id when no concrete program exercise matches', () => {
    const analysis: PerformanceAnalysis = {
      analysis_period_weeks: 8,
      global_overreaching: false,
      exercises: [
        {
          exercise_id: 'catalog:unknown-move',
          exercise_name: 'Unknown Move',
          sessions_count: 4,
          completion_rate: 0.7,
          avg_rir: 1.5,
          rir_trend: 'declining',
          overloads_last_4_weeks: 0,
          stagnation: false,
          overreaching: true,
        },
      ],
    }

    const recommendations = generateRecommendations(analysis, { exercises: [] })

    expect(recommendations).toHaveLength(1)
    expect(recommendations[0]?.exercise_id).toBeNull()
    expect(recommendations[0]?.type).toBe('decrease_volume')
  })
})
