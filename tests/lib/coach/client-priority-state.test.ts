import { describe, expect, it } from 'vitest'
import {
  createPriorityStateRow,
  hasMaterialSourceChange,
  shouldHidePriorityFromState,
  upsertPlannedState,
  upsertTreatedState,
} from '@/lib/coach/client-priority-state'

describe('client-priority-state', () => {
  it('creates a planned state row with timestamps', () => {
    const row = createPriorityStateRow({
      coach_id: 'coach-1',
      client_id: 'client-1',
      priority_key: 'k1',
      kind: 'assessment_review',
      state: 'planned',
    })

    expect(row.planned_at).toBeTruthy()
    expect(row.treated_at).toBeNull()
  })

  it('upserts planned state idempotently', () => {
    const next = upsertPlannedState(null, {
      coach_id: 'coach-1',
      client_id: 'client-1',
      priority_key: 'k1',
      kind: 'assessment_review',
      agenda_event_id: 'ev1',
    })

    expect(next.state).toBe('planned')
    expect(next.agenda_event_id).toBe('ev1')
  })

  it('upserts treated state and keeps timestamps', () => {
    const next = upsertTreatedState(null, {
      coach_id: 'coach-1',
      client_id: 'client-1',
      priority_key: 'k1',
      kind: 'assessment_review',
    })

    expect(next.state).toBe('treated')
    expect(next.treated_at).toBeTruthy()
  })

  it('detects material source changes from metadata fingerprint', () => {
    expect(
      hasMaterialSourceChange(
        {
          coach_id: 'coach-1',
          client_id: 'client-1',
          priority_key: 'k1',
          kind: 'assessment_review',
          state: 'treated',
          metadata: { sourceFingerprint: 'old' },
        },
        { sourceFingerprint: 'new' },
      ),
    ).toBe(true)
  })

  it('hides treated item when fingerprint is unchanged', () => {
    expect(
      shouldHidePriorityFromState(
        {
          coach_id: 'coach-1',
          client_id: 'client-1',
          priority_key: 'k1',
          kind: 'assessment_review',
          state: 'treated',
          metadata: { sourceFingerprint: 'same' },
        },
        { sourceFingerprint: 'same' },
      ),
    ).toBe(true)
  })
})
