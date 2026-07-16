import type { CyclePhase } from '@/lib/nutrition/engine/cycleSync'

export type CyclePhaseCheckin = {
  cycle_phase: CyclePhase | null
  energy_level?: number | null
  hunger_level?: number | null
  stress_level?: number | null
}

export type CyclePhaseObservation = {
  phase: CyclePhase
  samples: number
  energyAverage: number | null
  hungerAverage: number | null
  stressAverage: number | null
  isReliable: boolean
}

const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => Number.isFinite(value))
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

export function buildCyclePhaseObservations(checkins: CyclePhaseCheckin[]): CyclePhaseObservation[] {
  return PHASES.map((phase) => {
    const samples = checkins.filter((checkin) => checkin.cycle_phase === phase)
    return {
      phase,
      samples: samples.length,
      energyAverage: average(samples.map((sample) => sample.energy_level)),
      hungerAverage: average(samples.map((sample) => sample.hunger_level)),
      stressAverage: average(samples.map((sample) => sample.stress_level)),
      isReliable: samples.length >= 3,
    }
  })
}
