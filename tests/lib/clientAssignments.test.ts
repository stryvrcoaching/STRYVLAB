import { describe, expect, it } from 'vitest'
import {
  activateNutritionProtocolAssignment,
  closeNutritionProtocolAssignment,
} from '@/lib/assignments/clientAssignments'

type QueryResult = { data: any; error: { code?: string; message?: string } | null }

function makeQuery(result: QueryResult) {
  const query = {
    update: () => query,
    select: () => query,
    insert: () => query,
    eq: () => query,
    neq: () => query,
    is: () => query,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  }

  return query
}

function createDbMock(result: QueryResult) {
  return {
    from(table: string) {
      if (table !== 'client_nutrition_protocol_assignments') {
        throw new Error(`Unexpected table in test: ${table}`)
      }
      return makeQuery(result)
    },
  } as any
}

describe('client nutrition assignments', () => {
  it('skips activation when assignment table is unavailable', async () => {
    const db = createDbMock({
      data: null,
      error: {
        message: "Could not find the table 'public.client_nutrition_protocol_assignments' in the schema cache",
      },
    })

    await expect(
      activateNutritionProtocolAssignment(db, {
        clientId: 'client-1',
        coachId: 'coach-1',
        protocolId: 'protocol-1',
        startedBy: 'coach-1',
      }),
    ).resolves.toBeNull()
  })

  it('skips closing when assignment table is unavailable', async () => {
    const db = createDbMock({
      data: null,
      error: {
        message: "Could not find the table 'public.client_nutrition_protocol_assignments' in the schema cache",
      },
    })

    await expect(
      closeNutritionProtocolAssignment(db, {
        clientId: 'client-1',
        protocolId: 'protocol-1',
        endedBy: 'coach-1',
        reason: 'unshare',
      }),
    ).resolves.toBeUndefined()
  })
})
