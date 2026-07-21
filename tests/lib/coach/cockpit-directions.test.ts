import { describe, expect, it } from 'vitest'
import { buildCockpitDirections } from '@/lib/coach/cockpit-directions'

const base = {
  clientId: 'c1',
  energyState: 'aligné' as const,
  adherenceState: 'aligné' as const,
  activityState: 'aligné' as const,
  recoveryState: 'aligné' as const,
  energyReality: -300,
  energyPrescription: -300,
  energyDifference: 0,
  adherencePct: 90,
  activityRatio: 1,
  actualSteps: 10000,
  plannedSteps: 10000,
  recoveryScore: 75,
  overreaching: false,
  cyclePhase: null,
  hasLiveDraft: false,
}

describe('buildCockpitDirections', () => {
  it('prioritizes recovery when disponibilité is critical', () => {
    const dirs = buildCockpitDirections({
      ...base,
      recoveryState: 'à corriger',
      recoveryScore: 40,
      overreaching: true,
      energyState: 'à corriger',
      energyDifference: 400,
    })
    expect(dirs[0]?.id).toBe('protect-recovery')
    expect(dirs[0]?.href).toContain('/protocoles/entrainement')
  })

  it('puts adherence before energy retarget when both are off', () => {
    const dirs = buildCockpitDirections({
      ...base,
      adherenceState: 'à corriger',
      adherencePct: 60,
      energyState: 'à corriger',
      energyDifference: 500,
      recoveryState: 'aligné',
    })
    expect(dirs[0]?.id).toBe('fix-adherence')
    // Energy hard retarget should not outrank adherence
    expect(dirs.find((d) => d.id === 'align-energy')).toBeUndefined()
  })

  it('suggests completing data when many gauges are empty', () => {
    const dirs = buildCockpitDirections({
      ...base,
      energyState: 'à compléter',
      adherenceState: 'à compléter',
      activityState: 'à compléter',
      recoveryState: 'aligné',
      energyReality: null,
      energyPrescription: null,
      energyDifference: null,
      adherencePct: null,
      activityRatio: null,
    })
    expect(dirs[0]?.id).toBe('complete-data')
  })

  it('returns maintain when everything is fine', () => {
    const dirs = buildCockpitDirections(base)
    expect(dirs.some((d) => d.id === 'maintain')).toBe(true)
  })

  it('flags low activity with a concrete step target action', () => {
    const dirs = buildCockpitDirections({
      ...base,
      activityState: 'à corriger',
      activityRatio: 0.5,
      actualSteps: 4000,
      plannedSteps: 10000,
      activityRealityKcal: 250,
      activityPlanKcal: 600,
    })
    expect(dirs[0]?.id).toBe('activity-gap')
    expect(dirs[0]?.title.toLowerCase()).toContain('sous')
    expect(dirs[0]?.why).toMatch(/kcal/)
  })

  it('routes training under-delivery to workout studio', () => {
    const dirs = buildCockpitDirections({
      ...base,
      activityState: 'à corriger',
      activityRatio: 0.45,
      activityRealityKcal: 200,
      activityPlanKcal: 550,
      activityStrengthSessionsActual: 1,
      activityStrengthSessionsPlan: 4,
      activityEatReality: 50,
      activityEatPlan: 250,
    })
    expect(dirs[0]?.id).toBe('activity-gap')
    expect(dirs[0]?.href).toContain('/protocoles/entrainement')
  })
})
