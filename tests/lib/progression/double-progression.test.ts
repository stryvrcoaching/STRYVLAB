import { describe, expect, it } from 'vitest'
import { evaluateProgression } from '@/lib/progression/double-progression'

describe('evaluateProgression', () => {
  it('ignores warmup sets for overload decisions', () => {
    const result = evaluateProgression({
      exercise_id: 'exercise-1',
      exercise_name: 'Bench press',
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      sets_prescribed: 3,
      current_weight_kg: 80,
      weight_increment_kg: 2.5,
      sets: [
        { set_number: 1, set_type: 'warmup', actual_reps: 20, rir_actual: 6, completed: true, rep_max: 20, target_rir: 6 },
        { set_number: 2, set_type: 'working', actual_reps: 12, rir_actual: 2, completed: true },
        { set_number: 3, set_type: 'working', actual_reps: 12, rir_actual: 2, completed: true },
      ],
    })

    expect(result.trigger).toBe('overload')
    expect(result.sets_evaluated).toBe(2)
    expect(result.new_weight_kg).toBe(82.5)
  })

  it('uses per-set RIR targets when available', () => {
    const result = evaluateProgression({
      exercise_id: 'exercise-1',
      exercise_name: 'Bench press',
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      sets_prescribed: 2,
      current_weight_kg: 80,
      weight_increment_kg: 2.5,
      sets: [
        { set_number: 1, set_type: 'working', actual_reps: 12, rir_actual: 3, completed: true, target_rir: 3 },
        { set_number: 2, set_type: 'working', actual_reps: 12, rir_actual: 2, completed: true, target_rir: 2 },
      ],
    })

    expect(result.trigger).toBe('overload')
    expect(result.all_sets_rir_compliant).toBe(true)
  })

  it('keeps maintain when a working set misses its own rep max', () => {
    const result = evaluateProgression({
      exercise_id: 'exercise-1',
      exercise_name: 'Bench press',
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      sets_prescribed: 2,
      current_weight_kg: 80,
      weight_increment_kg: 2.5,
      sets: [
        { set_number: 1, set_type: 'working', actual_reps: 12, rir_actual: 2, completed: true, rep_max: 12 },
        { set_number: 2, set_type: 'working', actual_reps: 10, rir_actual: 2, completed: true, rep_max: 12 },
      ],
    })

    expect(result.trigger).toBe('maintain')
    expect(result.new_weight_kg).toBeNull()
  })
})
