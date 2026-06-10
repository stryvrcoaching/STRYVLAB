// lib/llm/callLLM.ts
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { callOpenAI } from '@/lib/llm/providers/openai'
import type { CallLLMParams, LLMResult, LLMProvider } from '@/lib/llm/types'

interface CallLLMDeps {
  db?: SupabaseClient
  provider?: LLMProvider
}

function svc(): SupabaseClient {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function inferErrorType(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('timeout')) return 'timeout'
  if (msg.includes('429') || msg.toLowerCase().includes('rate_limit')) return 'rate_limit'
  if (msg.toLowerCase().includes('invalid')) return 'invalid_response'
  return 'unknown'
}

export async function callLLM(
  params: CallLLMParams,
  deps?: CallLLMDeps
): Promise<LLMResult | null> {
  const db = deps?.db ?? svc()
  const provider = deps?.provider ?? callOpenAI

  const messages = [
    { role: 'system' as const, content: params.systemPrompt },
    ...(params.conversationHistory ?? []),
    { role: 'user' as const, content: params.userMessage },
  ]

  // 1. Insert trace entry (best-effort — never throw)
  let traceId = ''
  try {
    const { data: trace, error } = await db
      .from('llm_traces')
      .insert({
        client_id: params.clientId ?? null,
        coach_id: params.coachId ?? null,
        chat_message_id: params.chatMessageId ?? null,
        model: 'gpt-4o-mini',
        system_prompt: params.systemPrompt,
        user_message: params.userMessage,
        context_summary: params.contextSummary ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[callLLM] trace insert failed:', error.message)
    } else if (trace) {
      traceId = trace.id as string
    }
  } catch (e) {
    console.error('[callLLM] trace insert threw:', e)
  }

  // 2. Call provider
  const start = Date.now()
  try {
    const result = await provider({
      systemPrompt: params.systemPrompt,
      messages,
      maxTokens: params.maxTokens ?? 300,
      timeoutMs: 30_000,
    })

    const latencyMs = Date.now() - start

    // 3. Update trace with success (best-effort)
    if (traceId) {
      await db
        .from('llm_traces')
        .update({
          response_content: result.content,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          latency_ms: latencyMs,
        })
        .eq('id', traceId)
    }

    // 4. Increment coach budget (best-effort, documented race condition acceptable R1)
    // TODO R2: replace with transaction when billing is active
    if (params.coachId) {
      const month = new Date().toISOString().slice(0, 7) + '-01'
      await db.rpc('increment_llm_budget', {
        p_coach_id: params.coachId,
        p_month: month,
      })
    }

    return { content: result.content, tokensIn: result.tokensIn, tokensOut: result.tokensOut, latencyMs, traceId }
  } catch (err) {
    const latencyMs = Date.now() - start
    const errorMsg = err instanceof Error ? err.message : String(err)
    const errorType = inferErrorType(err)

    // 5. Update trace with failure (best-effort)
    if (traceId) {
      await db
        .from('llm_traces')
        .update({ latency_ms: latencyMs, error: errorMsg, error_type: errorType })
        .eq('id', traceId)
    }

    return null
  }
}
