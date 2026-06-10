// lib/llm/providers/openai.ts
import OpenAI from 'openai'
import type { ProviderParams, ProviderResult } from '@/lib/llm/types'

export async function callOpenAI(params: ProviderParams): Promise<ProviderResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: params.timeoutMs,
    maxRetries: 1,
  })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: params.maxTokens,
    messages: params.messages,
  })

  return {
    content: completion.choices[0]?.message?.content ?? '',
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
  }
}
