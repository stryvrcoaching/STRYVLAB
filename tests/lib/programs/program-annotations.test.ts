import { describe, expect, it } from 'vitest'
import {
  ensureProgramSharedAnnotation,
  upsertProgramUpdatedAnnotation,
} from '@/lib/programs/programAnnotations'

function createDbMock(existingId: string | null) {
  const inserts: Record<string, unknown>[] = []
  const updates: Record<string, unknown>[] = []

  const db = {
    from(table: string) {
      expect(table).toBe('metric_annotations')
      let operation: 'select' | 'insert' | 'update' = 'select'
      const query = {
        select() {
          return query
        },
        eq() {
          return query
        },
        limit() {
          return query
        },
        insert(payload: Record<string, unknown>) {
          operation = 'insert'
          inserts.push(payload)
          return query
        },
        update(payload: Record<string, unknown>) {
          operation = 'update'
          updates.push(payload)
          return query
        },
        async maybeSingle() {
          return { data: existingId ? { id: existingId } : null, error: null }
        },
        async single() {
          return { data: { id: operation === 'insert' ? 'new-event' : existingId }, error: null }
        },
        then(resolve: (result: { data: null; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: null, error: null }))
        },
      }
      return query
    },
  }

  return { db: db as any, inserts, updates }
}

const input = {
  clientId: 'client-1',
  coachId: 'coach-1',
  programId: 'program-1',
  programName: 'Hypertrophie 01',
  eventDate: '2026-07-15',
}

describe('program timeline annotations', () => {
  it('does not duplicate the initial program event', async () => {
    const { db, inserts } = createDbMock('existing-event')

    const id = await ensureProgramSharedAnnotation(db, input)

    expect(id).toBe('existing-event')
    expect(inserts).toEqual([])
  })

  it('creates a dated event when a shared program is updated', async () => {
    const { db, inserts } = createDbMock(null)

    const id = await upsertProgramUpdatedAnnotation(db, input)

    expect(id).toBe('new-event')
    expect(inserts).toEqual([
      expect.objectContaining({
        event_type: 'program_change',
        event_date: '2026-07-15',
        label: 'Mise à jour du programme : Hypertrophie 01',
        source_id: 'program-1',
      }),
    ])
  })

  it('updates the same-day event instead of creating another one', async () => {
    const { db, inserts, updates } = createDbMock('existing-update')

    const id = await upsertProgramUpdatedAnnotation(db, input)

    expect(id).toBe('existing-update')
    expect(inserts).toEqual([])
    expect(updates).toEqual([
      { label: 'Mise à jour du programme : Hypertrophie 01' },
    ])
  })
})
