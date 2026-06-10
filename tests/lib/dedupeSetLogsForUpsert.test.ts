import { describe, it, expect } from 'vitest'
import { dedupeSetLogsForUpsert } from '@/lib/training/dedupeSetLogsForUpsert'

describe('dedupeSetLogsForUpsert', () => {
  it('keeps last row when duplicate keys share exercise_id', () => {
    const rows = [
      { exercise_id: 'a', exercise_name: 'Squat', set_number: 1, side: 'bilateral', actual_reps: 5 },
      { exercise_id: 'a', exercise_name: 'Squat', set_number: 1, side: 'bilateral', actual_reps: 8 },
    ]
    const out = dedupeSetLogsForUpsert(rows)
    expect(out).toHaveLength(1)
    expect(out[0].actual_reps).toBe(8)
  })

  it('does not merge different exercises that share the same name', () => {
    const rows = [
      { exercise_id: 'ex-1', exercise_name: 'Row', set_number: 1, side: 'bilateral' },
      { exercise_id: 'ex-2', exercise_name: 'Row', set_number: 1, side: 'bilateral' },
    ]
    const out = dedupeSetLogsForUpsert(rows)
    expect(out).toHaveLength(2)
  })
})
