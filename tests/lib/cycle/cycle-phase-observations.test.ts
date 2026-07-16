import { describe, expect, it } from 'vitest'
import { buildCyclePhaseObservations } from '@/lib/cycle/cycle-phase-observations'

describe('cycle phase observations', () => {
  it('summarizes phase-specific check-ins and marks three samples as reliable', () => {
    const result = buildCyclePhaseObservations([
      { cycle_phase: 'luteal', energy_level: 2, hunger_level: 4, stress_level: 4 },
      { cycle_phase: 'luteal', energy_level: 3, hunger_level: 3, stress_level: 3 },
      { cycle_phase: 'luteal', energy_level: 4, hunger_level: 2, stress_level: 2 },
      { cycle_phase: 'follicular', energy_level: 4 },
    ])

    const luteal = result.find((item) => item.phase === 'luteal')!
    expect(luteal).toMatchObject({ samples: 3, energyAverage: 3, hungerAverage: 3, stressAverage: 3, isReliable: true })
    expect(result.find((item) => item.phase === 'follicular')?.isReliable).toBe(false)
  })
})
