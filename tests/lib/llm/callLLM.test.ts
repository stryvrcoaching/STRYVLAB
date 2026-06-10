// tests/lib/llm/callLLM.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CallLLMParams, LLMProvider } from '@/lib/llm/types'

// ── Mock Supabase service client ──────────────────────────────────────────────
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

// Chain: .from().insert().select().single()
// Chain: .from().update().eq()
// Chain: .rpc()
function makeMockDb(traceId = 'trace-uuid-123') {
  const single = vi.fn().mockResolvedValue({ data: { id: traceId }, error: null })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select, data: null, error: null })
  const eq = vi.fn().mockReturnValue({ data: null, error: null })
  const update = vi.fn().mockReturnValue({ eq })
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  return {
    from: vi.fn().mockReturnValue({ insert, update, select }),
    rpc,
    _mocks: { insert, select, single, update, eq, rpc },
  }
}

// ── Mock provider ─────────────────────────────────────────────────────────────
const mockProvider: LLMProvider = vi.fn().mockResolvedValue({
  content: 'Voici ma réponse.',
  tokensIn: 120,
  tokensOut: 40,
})

describe('callLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns LLMResult on success', async () => {
    const { callLLM } = await import('@/lib/llm/callLLM')
    const db = makeMockDb('trace-abc')

    const result = await callLLM(
      {
        systemPrompt: 'Tu es un coach.',
        userMessage: 'Comment ça va ?',
        clientId: 'client-1',
        coachId: 'coach-1',
        chatMessageId: 'msg-1',
        maxTokens: 200,
      },
      { db: db as any, provider: mockProvider }
    )

    expect(result).not.toBeNull()
    expect(result!.content).toBe('Voici ma réponse.')
    expect(result!.tokensIn).toBe(120)
    expect(result!.tokensOut).toBe(40)
    expect(result!.traceId).toBe('trace-abc')
    expect(result!.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('passes systemPrompt + conversationHistory + userMessage to provider', async () => {
    const { callLLM } = await import('@/lib/llm/callLLM')
    const db = makeMockDb()
    const provider = vi.fn().mockResolvedValue({ content: 'ok', tokensIn: 10, tokensOut: 5 })

    await callLLM(
      {
        systemPrompt: 'System.',
        userMessage: 'Nouveau message',
        conversationHistory: [
          { role: 'user', content: 'Ancien message' },
          { role: 'assistant', content: 'Ancienne réponse' },
        ],
      },
      { db: db as any, provider }
    )

    expect(provider).toHaveBeenCalledOnce()
    const { messages } = provider.mock.calls[0][0]
    expect(messages[0]).toEqual({ role: 'system', content: 'System.' })
    expect(messages[1]).toEqual({ role: 'user', content: 'Ancien message' })
    expect(messages[2]).toEqual({ role: 'assistant', content: 'Ancienne réponse' })
    expect(messages[3]).toEqual({ role: 'user', content: 'Nouveau message' })
  })

  it('returns null and updates trace on provider error', async () => {
    const { callLLM } = await import('@/lib/llm/callLLM')
    const db = makeMockDb('trace-err')
    const failingProvider: LLMProvider = vi.fn().mockRejectedValue(new Error('timeout exceeded'))

    const result = await callLLM(
      { systemPrompt: 'S', userMessage: 'U' },
      { db: db as any, provider: failingProvider }
    )

    expect(result).toBeNull()
    // trace should be updated with error info
    expect(db._mocks.update).toHaveBeenCalled()
    const updateArg = db._mocks.update.mock.calls[0][0]
    expect(updateArg.error).toContain('timeout')
    expect(updateArg.error_type).toBe('timeout')
  })

  it('uses default maxTokens 300 when not provided', async () => {
    const { callLLM } = await import('@/lib/llm/callLLM')
    const db = makeMockDb()
    const provider = vi.fn().mockResolvedValue({ content: 'ok', tokensIn: 5, tokensOut: 2 })

    await callLLM(
      { systemPrompt: 'S', userMessage: 'U' },
      { db: db as any, provider }
    )

    expect(provider.mock.calls[0][0].maxTokens).toBe(300)
  })

  it('still returns result when trace insert fails (non-blocking)', async () => {
    const { callLLM } = await import('@/lib/llm/callLLM')
    // db whose insert returns an error
    const brokenDb = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    const result = await callLLM(
      { systemPrompt: 'S', userMessage: 'U' },
      { db: brokenDb as any, provider: mockProvider }
    )

    expect(result).not.toBeNull()
    expect(result!.content).toBe('Voici ma réponse.')
    // traceId is empty string when trace creation fails
    expect(result!.traceId).toBe('')
  })
})
