// lib/llm/types.ts

export interface CallLLMParams {
  systemPrompt: string
  userMessage: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
  contextSummary?: Record<string, unknown>
  clientId?: string
  coachId?: string
  chatMessageId?: string
  maxTokens?: number
}

export interface LLMResult {
  content: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  traceId: string
}

export interface ProviderParams {
  systemPrompt: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  maxTokens: number
  timeoutMs: number
}

export interface ProviderResult {
  content: string
  tokensIn: number
  tokensOut: number
}

export type LLMProvider = (params: ProviderParams) => Promise<ProviderResult>
