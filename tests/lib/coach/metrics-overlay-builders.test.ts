import { describe, expect, it } from 'vitest'
import { buildNutritionOverlaySeries } from '@/lib/coach/metricsOverlay/builders/nutrition'
import { buildPerformanceOverlaySeries } from '@/lib/coach/metricsOverlay/builders/performance'

type QueryResult = { data: any; error: { code?: string; message?: string } | null }

function makeQuery(result: QueryResult) {
  const query = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    gte: () => query,
    lte: () => query,
    lt: () => query,
    in: () => query,
    or: () => query,
    order: () => query,
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)),
    catch: () => Promise.resolve(result),
  }

  return query
}

function createDbMock(resultsByTable: Record<string, QueryResult>) {
  return {
    from(table: string) {
      const result = resultsByTable[table]
      if (!result) {
        throw new Error(`Unexpected table in test: ${table}`)
      }
      return makeQuery(result)
    },
  } as any
}

const ctx = {
  clientId: 'client-1',
  coachId: 'coach-1',
  timezone: 'Europe/Brussels',
  dateKeys: ['2026-06-20'],
  startDateKey: '2026-06-20',
  endDateKey: '2026-06-20',
}

const twoDayCtx = {
  ...ctx,
  dateKeys: ['2026-06-20', '2026-06-21'],
  endDateKey: '2026-06-21',
}

describe('metrics overlay builders', () => {
  it('keeps consumed nutrition series when assignment table is unavailable', async () => {
    const db = createDbMock({
      client_nutrition_protocol_assignments: {
        data: null,
        error: {
          message: "Could not find the table 'public.client_nutrition_protocol_assignments' in the schema cache",
        },
      },
      nutrition_meals: {
        data: [{
          physiological_date: '2026-06-20',
          total_protein_g: 150,
          total_carbs_g: 200,
          total_fat_g: 60,
          total_fiber_g: 20,
          total_calories: 1940,
        }],
        error: null,
      },
      client_water_logs: {
        data: [{
          amount_ml: 1800,
          logged_at: '2026-06-20T12:00:00.000Z',
        }],
        error: null,
      },
    })

    const series = await buildNutritionOverlaySeries(db, ctx)

    expect(series.protein_consumed_g).toEqual([{ date: '2026-06-20', value: 150 }])
    expect(series.hydration_consumed_ml).toEqual([{ date: '2026-06-20', value: 1800 }])
    expect(series.protein_planned_g).toEqual([])
  }, 15000)

  it('does not turn an unlogged nutrition day into a zero-intake point', async () => {
    const db = createDbMock({
      client_nutrition_protocol_assignments: { data: [], error: null },
      nutrition_meals: {
        data: [{
          physiological_date: '2026-06-20',
          total_protein_g: 150,
          total_carbs_g: 200,
          total_fat_g: 60,
          total_fiber_g: 20,
          total_calories: 1940,
        }],
        error: null,
      },
      client_water_logs: {
        data: [{
          amount_ml: 1800,
          logged_at: '2026-06-20T12:00:00.000Z',
        }],
        error: null,
      },
    })

    const series = await buildNutritionOverlaySeries(db, twoDayCtx)

    expect(series.protein_consumed_g).toEqual([
      { date: '2026-06-20', value: 150 },
    ])
    expect(series.hydration_consumed_ml).toEqual([
      { date: '2026-06-20', value: 1800 },
    ])
  }, 15000)

  it('keeps performance series when assignment table is unavailable', async () => {
    const db = createDbMock({
      client_workout_program_assignments: {
        data: null,
        error: {
          message: "Could not find the table 'public.client_workout_program_assignments' in the schema cache",
        },
      },
      client_session_logs: {
        data: [{
          id: 'log-1',
          logged_at: '2026-06-20T09:00:00.000Z',
          completed_at: '2026-06-20T10:00:00.000Z',
          client_set_logs: [{
            actual_reps: 10,
            actual_weight_kg: 50,
            completed: true,
            rir_actual: 2,
            rpe: null,
          }],
        }],
        error: null,
      },
    })

    const series = await buildPerformanceOverlaySeries(db, ctx)

    expect(series.performance_volume).toEqual([{ date: '2026-06-20', value: 500 }])
    expect(series.performance_avg_load).toEqual([{ date: '2026-06-20', value: 50 }])
    expect(series.performance_completion_rate).toEqual([{ date: '2026-06-20', value: 100 }])
  }, 15000)
})
