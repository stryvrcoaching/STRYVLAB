import { vi } from 'vitest'

// ─── Types helpers ───────────────────────────────────────────

export interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  // Resolved value — set this per-test
  _result: { data: unknown; error: unknown }
}

/**
 * Build a chainable Supabase query mock.
 * All chain methods return `this` so calls can be chained freely.
 * `.single()` and the final awaited call resolve to `_result`.
 */
function makeQueryBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: any = {
    _result: result,
  }
  const chainMethods = ['select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'in', 'is', 'order', 'limit', 'gte', 'lte', 'contains']
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder)
  }
  // .single() and .maybeSingle() return a Promise resolving to _result
  builder.single = vi.fn().mockImplementation(() => Promise.resolve(builder._result))
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(builder._result))
  // Make the builder itself thenable (for `await db.from(...).select(...)`)
  builder.then = (resolve: (v: unknown) => void) => Promise.resolve(builder._result).then(resolve)
  builder.catch = (reject: (e: unknown) => void) => Promise.resolve(builder._result).catch(reject)
  return builder
}

/**
 * Create a complete Supabase client mock.
 *
 * Usage in tests:
 *   const { serverMock, serviceMock, setServerUser, setServiceResult } = createSupabaseMocks()
 *
 * Then in vi.mock:
 *   vi.mock('@/utils/supabase/server', () => ({ createClient: () => serverMock }))
 *   vi.mock('@supabase/supabase-js', () => ({ createClient: () => serviceMock }))
 */
export function createSupabaseMocks() {
  // ── Server client (auth.getUser) ─────────────────────────────
  const serverMock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'coach-123', email: 'coach@test.com', user_metadata: { first_name: 'Test' } } },
        error: null,
      }),
    },
  }

  // ── Service client (DB operations) ───────────────────────────
  // We track the latest query builder so tests can inspect calls
  let currentBuilder = makeQueryBuilder()

  const serviceMock = {
    from: vi.fn().mockImplementation(() => currentBuilder),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
  }

  // ── Helpers ──────────────────────────────────────────────────

  /** Override the authenticated user returned by server client */
  function setServerUser(user: { id: string; email?: string; user_metadata?: Record<string, string> } | null) {
    serverMock.auth.getUser.mockResolvedValue({
      data: { user },
      error: user ? null : { message: 'Not authenticated' },
    })
  }

  /** Set what the next DB call returns. Call before the route handler. */
  function setServiceResult(data: unknown, error: unknown = null) {
    currentBuilder = makeQueryBuilder({ data, error })
    serviceMock.from.mockReturnValue(currentBuilder)
  }

  /**
   * Set sequential results for multiple DB calls in one handler.
   * e.g. [result1, result2] — first call gets result1, second gets result2, etc.
   */
  function setServiceResults(results: Array<{ data: unknown; error?: unknown }>) {
    const builders = results.map(r => makeQueryBuilder({ data: r.data, error: r.error ?? null }))
    let callCount = 0
    serviceMock.from.mockImplementation(() => {
      const b = builders[callCount] ?? builders[builders.length - 1]
      callCount++
      return b
    })
  }

  /** Reset all mocks between tests */
  function resetMocks() {
    vi.clearAllMocks()
    currentBuilder = makeQueryBuilder()
    serviceMock.from.mockReturnValue(currentBuilder)
    serverMock.auth.getUser.mockResolvedValue({
      data: { user: { id: 'coach-123', email: 'coach@test.com', user_metadata: { first_name: 'Test' } } },
      error: null,
    })
  }

  return { serverMock, serviceMock, setServerUser, setServiceResult, setServiceResults, resetMocks }
}
