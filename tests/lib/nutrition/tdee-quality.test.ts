import { describe, expect, it } from 'vitest'
import { assessTdeeDataQuality } from '@/lib/nutrition/tdee-quality'

describe('assessTdeeDataQuality', () => {
  it('marks a dense client-logged window as actionable', () => {
    expect(assessTdeeDataQuality({
      windowDays: 14,
      weightSamples: 10,
      trackedDays: 12,
      caloriesSource: 'logs',
    })).toMatchObject({ score: 100, status: 'actionable' })
  })

  it('keeps partial client data in observation', () => {
    expect(assessTdeeDataQuality({
      windowDays: 14,
      weightSamples: 5,
      trackedDays: 7,
      caloriesSource: 'logs',
    }).status).toBe('observing')
  })

  it('never treats protocol calories as an actionable observation', () => {
    const quality = assessTdeeDataQuality({
      windowDays: 21,
      weightSamples: 12,
      trackedDays: 0,
      caloriesSource: 'protocol',
    })

    expect(quality.status).toBe('collecting')
    expect(quality.reasons.join(' ')).toContain('proxy')
  })

  it('penalizes windows that required excluding anomalous weigh-ins', () => {
    const baseline = assessTdeeDataQuality({
      windowDays: 14,
      weightSamples: 10,
      trackedDays: 12,
      caloriesSource: 'logs',
    })
    const withOutlier = assessTdeeDataQuality({
      windowDays: 14,
      weightSamples: 9,
      trackedDays: 12,
      caloriesSource: 'logs',
      outlierCount: 1,
    })

    expect(withOutlier.score).toBeLessThan(baseline.score)
    expect(withOutlier.reasons.join(' ')).toContain('aberrante')
  })
})
