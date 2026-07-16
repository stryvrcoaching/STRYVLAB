import { describe, expect, it } from 'vitest'
import {
  buildDuplicatedExerciseInsert,
  buildDuplicatedSessionInsert,
  nextProgramWeekPosition,
} from '@/lib/programs/programWeeks'

describe('program week duplication payloads', () => {
  it('copies session configuration without database identity or nested exercises', () => {
    expect(buildDuplicatedSessionInsert({
      id: 'session-source',
      program_id: 'program-source',
      program_week_id: 'week-source',
      lineage_id: 'session-lineage',
      name: 'Push',
      position: 2,
      days_of_week: [1, 4],
      program_exercises: [{ id: 'exercise-source' }],
      created_at: '2026-07-12T00:00:00Z',
    }, 'program-target', 'week-target')).toEqual({
      lineage_id: 'session-lineage',
      name: 'Push',
      position: 2,
      days_of_week: [1, 4],
      program_id: 'program-target',
      program_week_id: 'week-target',
    })
  })

  it('uses the source row identity as lineage for legacy sessions', () => {
    expect(buildDuplicatedSessionInsert({
      id: 'session-source',
      name: 'Push',
    }, 'program-target', 'week-target').lineage_id).toBe('session-source')
  })

  it('copies exercise prescriptions while assigning a new session identity', () => {
    expect(buildDuplicatedExerciseInsert({
      id: 'exercise-source',
      session_id: 'session-source',
      lineage_id: 'exercise-lineage',
      name: 'Développé couché',
      sets: 4,
      reps: '8-10',
      set_prescriptions: [{ set_number: 1, reps: '8', rir: 2 }],
      created_at: '2026-07-12T00:00:00Z',
    }, 'session-target')).toEqual({
      lineage_id: 'exercise-lineage',
      name: 'Développé couché',
      sets: 4,
      reps: '8-10',
      set_prescriptions: [{ set_number: 1, reps: '8', rir: 2 }],
      session_id: 'session-target',
    })
  })

  it('appends after the highest stored position', () => {
    expect(nextProgramWeekPosition([{ position: 0 }, { position: 3 }, { position: 1 }])).toBe(4)
    expect(nextProgramWeekPosition([])).toBe(0)
  })
})
