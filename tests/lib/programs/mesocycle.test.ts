import { describe, expect, it } from 'vitest'
import {
  MESOCYCLE_ENGINE_VERSION,
  adjustMesocycleSets,
  applyMesocycleExercisePatch,
  buildMesocyclePreview,
  type MesocycleConfig,
} from '@/lib/programs/mesocycle'

const config: MesocycleConfig = {
  version: MESOCYCLE_ENGINE_VERSION,
  sourceWeekIds: ['week-a'],
  outputWeekCount: 4,
  volume: { mode: 'linear', startPercent: 100, endPercent: 120 },
  rir: { mode: 'linear', start: 3, end: 1 },
  deload: { enabled: true, volumePercent: 60, rir: 4 },
  safety: { minSetsPerExercise: 1, maxSetsPerExercise: 8 },
  completionBehavior: 'repeat',
}

describe('buildMesocyclePreview', () => {
  it('builds transparent volume, RIR and deload progressions', () => {
    const preview = buildMesocyclePreview(config, [{
      id: 'week-a',
      label: 'Semaine type',
      sessionCount: 4,
      exerciseCount: 20,
      totalSets: 60,
    }])

    expect(preview.weeks.map((week) => week.volumePercent)).toEqual([100, 110, 120, 60])
    expect(preview.weeks.map((week) => week.targetRir)).toEqual([3, 2, 1, 4])
    expect(preview.weeks.map((week) => week.weekType)).toEqual([
      'base',
      'build',
      'overload',
      'deload',
    ])
    expect(preview.weeks.map((week) => week.projectedTotalSets)).toEqual([60, 66, 72, 36])
  })

  it('alternates multiple source weeks across the output', () => {
    const preview = buildMesocyclePreview(
      { ...config, outputWeekCount: 5, deload: { ...config.deload, enabled: false } },
      [
        { id: 'week-a', label: 'A', sessionCount: 3, exerciseCount: 10, totalSets: 30 },
        { id: 'week-b', label: 'B', sessionCount: 4, exerciseCount: 12, totalSets: 40 },
      ],
    )

    expect(preview.weeks.map((week) => week.sourceWeekId)).toEqual([
      'week-a',
      'week-b',
      'week-a',
      'week-b',
      'week-a',
    ])
  })
})

describe('exercise progression', () => {
  it('rounds and clamps sets inside safety limits', () => {
    expect(adjustMesocycleSets(3, 120, config.safety)).toBe(4)
    expect(adjustMesocycleSets(8, 150, config.safety)).toBe(8)
    expect(adjustMesocycleSets(1, 40, config.safety)).toBe(1)
  })

  it('updates sets, RIR and per-set prescriptions for strength work', () => {
    const patched = applyMesocycleExercisePatch({
      sets: 3,
      reps: '8-12',
      rest_sec: 90,
      rir: 3,
      execution_type: 'reps_rir',
      tempo: '2-1-3-1',
      set_prescriptions: [],
    }, { volumePercent: 120, targetRir: 1.5 }, config.safety)

    expect(patched.sets).toBe(4)
    expect(patched.rir).toBe(1.5)
    expect(patched.target_rir).toBe(1.5)
    expect(patched.set_prescriptions).toHaveLength(4)
    expect(patched.set_prescriptions.every((set) => set.rir === 1.5)).toBe(true)
  })

  it('leaves time and distance work unchanged', () => {
    const source = { sets: 5, rir: null, execution_type: 'time_rpe' }
    expect(applyMesocycleExercisePatch(
      source,
      { volumePercent: 60, targetRir: 4 },
      config.safety,
    )).toEqual(source)
  })
})
