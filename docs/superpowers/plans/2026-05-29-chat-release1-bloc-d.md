# Chat Release 1 — Bloc D: DB + Observabilité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pose la fondation DB + infrastructure LLM de la Release 1 — migration complète, wrapper LLM tracé, feature flags par coach/client, notifications coach, sans toucher à l'UX client.

**Architecture:** Migration SQL manuelle sur Supabase (ALTER + 4 nouvelles tables + 1 fonction RPC), wrapper centralisé `lib/llm/callLLM.ts` injecté dans `/api/client/chat/messages/POST`, route `/ai-coach/chat` dépréciée via redirect 308.

**Tech Stack:** Next.js App Router, Supabase (service_role), OpenAI SDK (`gpt-4o-mini`), Vitest, Resend (email)

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Modify | `lib/nutrition/physiological-date.ts` | Export `PHYSIOLOGICAL_DAY_OFFSET_HOURS` |
| Create | `lib/llm/types.ts` | Types partagés LLM (CallLLMParams, LLMResult, ProviderParams, ProviderResult) |
| Create | `lib/llm/providers/openai.ts` | Provider isolé — appel OpenAI, timeout, 1 retry |
| Create | `lib/llm/callLLM.ts` | Wrapper centralisé — trace, budget, fallback |
| Create | `tests/lib/llm/callLLM.test.ts` | Tests unitaires wrapper (injection dépendances) |
| Create | `supabase/migrations/20260529_chat_release1_bloc_d.sql` | Migration complète — ALTER + 4 tables + RPC |
| Modify | `lib/email/mailer.ts` | Ajouter `sendCoachAlertEmail` |
| Create | `lib/notifications/sendCoachNotification.ts` | INSERT coach_notifications + email safety |
| Modify | `app/api/client/chat/messages/route.ts` | Feature flag check + callLLM + trace_id + parent_message_id |
| Modify | `app/api/client/ai-coach/chat/route.ts` | Redirect 308 → `/api/client/chat/messages` |

---

## Task 1 — Export PHYSIOLOGICAL_DAY_OFFSET_HOURS

**Files:**
- Modify: `lib/nutrition/physiological-date.ts`

- [ ] **Remplacer `DAY_RESET_HOUR` par une constante exportée**

```typescript
// lib/nutrition/physiological-date.ts
import type { MealType } from "@/lib/nutrition/food-items"

export const PHYSIOLOGICAL_DAY_OFFSET_HOURS = 4

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  return `${year}-${month}-${day}`
}

export function computePhysiologicalDate(input: Date): string {
  const date = new Date(input)

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date passed to computePhysiologicalDate")
  }

  if (date.getHours() < PHYSIOLOGICAL_DAY_OFFSET_HOURS) {
    date.setDate(date.getDate() - 1)
  }

  return formatLocalDate(date)
}

export function inferMealType(input: Date): MealType {
  const hour = input.getHours()

  if (hour < 11) return "breakfast"
  if (hour < 15) return "lunch"
  if (hour < 22) return "dinner"
  return "snack"
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**

```bash
git add lib/nutrition/physiological-date.ts
git commit -m "chore(llm): export PHYSIOLOGICAL_DAY_OFFSET_HOURS from physiological-date"
```

---

## Task 2 — Types LLM partagés

**Files:**
- Create: `lib/llm/types.ts`

- [ ] **Créer le fichier de types**

```typescript
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
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 3 — Provider OpenAI isolé

**Files:**
- Create: `lib/llm/providers/openai.ts`

- [ ] **Créer le provider**

```typescript
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
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 4 — Tests callLLM (failing d'abord)

**Files:**
- Create: `tests/lib/llm/callLLM.test.ts`

- [ ] **Créer les tests**

```typescript
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
```

- [ ] **Lancer les tests — vérifier qu'ils échouent (module pas encore créé)**

```bash
npx vitest run tests/lib/llm/callLLM.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/llm/callLLM'`

---

## Task 5 — Implémenter callLLM

**Files:**
- Create: `lib/llm/callLLM.ts`

- [ ] **Créer le wrapper**

```typescript
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
```

---

## Task 6 — Lancer les tests callLLM

**Files:** aucun changement

- [ ] **Lancer les tests**

```bash
npx vitest run tests/lib/llm/callLLM.test.ts
```
Expected: 5 tests PASS.

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**

```bash
git add lib/llm/types.ts lib/llm/providers/openai.ts lib/llm/callLLM.ts tests/lib/llm/callLLM.test.ts
git commit -m "feat(llm): add centralized callLLM wrapper with llm_traces observability"
```

---

## Task 7 — Migration SQL complète

**Files:**
- Create: `supabase/migrations/20260529_chat_release1_bloc_d.sql`

> ⚠️ Ce fichier est à appliquer **manuellement** via Supabase Dashboard → SQL Editor. Faire un backup avant.

- [ ] **Créer le fichier de migration**

```sql
-- ─── Chat Release 1 — Bloc D : DB + Observabilité ────────────────────────────
-- Application : manuelle via Supabase Dashboard SQL Editor
-- Ordre : ce script doit être appliqué AVANT tous les autres blocs (A, B, C, E)

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ALTER chat_messages — 5 nouvelles colonnes
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS parent_message_id       uuid
    REFERENCES chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_coach_response boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_response_reason   text
    CHECK (coach_response_reason IN (
      'safety_health', 'safety_mental', 'out_of_scope_protocol',
      'out_of_scope_prediction', 'data_missing', 'llm_disabled'
    )),
  ADD COLUMN IF NOT EXISTS from_coach_human        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trace_id                uuid;

-- Étendre le CHECK message_type
-- Le nom auto-généré est chat_messages_message_type_check (vérifié via \d chat_messages si besoin)
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN (
    'text', 'quick_reply', 'slider', 'voice',
    'morning_init', 'evening_init',
    'checkin_summary', 'bilan_signed',
    'nutrition_alert_auto', 'training_alert_auto',
    'pattern_inquiry'
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ALTER coach_profiles — 5 nouvelles colonnes IA
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS has_ai_llm            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_tone               text    NOT NULL DEFAULT 'bienveillant'
    CHECK (ai_tone IN ('strict', 'bienveillant', 'motivant', 'neutre')),
  ADD COLUMN IF NOT EXISTS ai_coach_name         text,
  ADD COLUMN IF NOT EXISTS ai_permissions        jsonb   NOT NULL
    DEFAULT '{"give_nutrition_advice":true,"give_training_advice":true,"give_lifestyle_advice":true}',
  ADD COLUMN IF NOT EXISTS ai_custom_instructions text;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Nouvelle table : coach_ai_settings_per_client
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_ai_settings_per_client (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id              uuid        NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  ai_llm_enabled         boolean     NOT NULL DEFAULT false,
  ai_tone                text
    CHECK (ai_tone IN ('strict', 'bienveillant', 'motivant', 'neutre')),
  ai_custom_instructions text,
  monthly_quota          integer     CHECK (monthly_quota > 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id)
);

ALTER TABLE coach_ai_settings_per_client ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_ai_settings_coach_crud" ON coach_ai_settings_per_client
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "coach_ai_settings_client_select" ON coach_ai_settings_per_client
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS coach_ai_settings_coach_client_idx
  ON coach_ai_settings_per_client (coach_id, client_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Nouvelle table : coach_llm_budget
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_llm_budget (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                date        NOT NULL,
  tier_included_quota  integer     NOT NULL DEFAULT 500,
  purchased_credits    integer     NOT NULL DEFAULT 0,
  consumed_messages    integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, month)
);

ALTER TABLE coach_llm_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_llm_budget_coach_select" ON coach_llm_budget
  FOR SELECT USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_llm_budget_coach_month_idx
  ON coach_llm_budget (coach_id, month DESC);

-- Fonction RPC pour incrément atomique (évite race condition)
CREATE OR REPLACE FUNCTION increment_llm_budget(p_coach_id uuid, p_month date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO coach_llm_budget (coach_id, month, tier_included_quota, purchased_credits, consumed_messages)
  VALUES (p_coach_id, p_month, 500, 0, 1)
  ON CONFLICT (coach_id, month) DO UPDATE
    SET consumed_messages = coach_llm_budget.consumed_messages + 1,
        updated_at        = now();
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Nouvelle table : llm_traces (observabilité interne — pas d'accès coach R1)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS llm_traces (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  client_id        uuid        REFERENCES coach_clients(id) ON DELETE SET NULL,
  coach_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  chat_message_id  uuid        REFERENCES chat_messages(id) ON DELETE SET NULL,
  model            text        NOT NULL,
  system_prompt    text        NOT NULL,
  user_message     text        NOT NULL,
  context_summary  jsonb,
  response_content text,
  tokens_in        integer,
  tokens_out       integer,
  latency_ms       integer,
  error            text,
  error_type       text
);

-- RLS activé mais AUCUNE policy : service_role only (bypass RLS)
ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;

-- Index sélectifs (ne pas indexer les colonnes text volumineuses)
CREATE INDEX IF NOT EXISTS llm_traces_created_at_idx  ON llm_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS llm_traces_client_id_idx   ON llm_traces (client_id);
CREATE INDEX IF NOT EXISTS llm_traces_coach_id_idx    ON llm_traces (coach_id);
CREATE INDEX IF NOT EXISTS llm_traces_error_type_idx  ON llm_traces (error_type)
  WHERE error_type IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Nouvelle table : coach_notifications (inbox coach)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  coach_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  chat_message_id  uuid        REFERENCES chat_messages(id) ON DELETE SET NULL,
  category         text        NOT NULL CHECK (category IN (
    'safety', 'out_of_scope', 'pattern_inquiry', 'engagement', 'weight_off_track'
  )),
  subcategory      text,
  status           text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  priority         integer     NOT NULL DEFAULT 3
    CHECK (priority BETWEEN 1 AND 5),
  email_sent       boolean     NOT NULL DEFAULT false,
  resolved_at      timestamptz
);

ALTER TABLE coach_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_notifications_coach_crud" ON coach_notifications
  FOR ALL USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_notifications_coach_status_idx
  ON coach_notifications (coach_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS coach_notifications_pending_priority_idx
  ON coach_notifications (coach_id, priority, created_at DESC)
  WHERE status = 'pending';
```

- [ ] **Appliquer via Supabase Dashboard**

> Ouvrir Supabase Dashboard → SQL Editor → coller le contenu → Run.
> Vérifier dans l'onglet "Table Editor" que les 4 nouvelles tables apparaissent.

- [ ] **Commit du fichier de migration**

```bash
git add supabase/migrations/20260529_chat_release1_bloc_d.sql
git commit -m "schema(chat): bloc D migration — chat_messages, coach_profiles, 4 new tables, increment_llm_budget RPC"
```

---

## Task 8 — sendCoachAlertEmail

**Files:**
- Modify: `lib/email/mailer.ts` (ajouter à la fin)

- [ ] **Ajouter le type et la fonction en fin de fichier**

Ajouter après la fonction `sendWelcomeEmail` (ligne ~519) :

```typescript
// ─── 10. Alerte coach — message client requiert intervention ──────────────────

export interface SendCoachAlertEmailParams {
  to: string
  coachFirstName: string
  clientFirstName: string
  category: 'safety' | 'out_of_scope' | 'pattern_inquiry' | 'engagement' | 'weight_off_track'
  messageExcerpt: string  // déjà tronqué à 200 chars par l'appelant
  inboxUrl: string
}

const CATEGORY_LABELS: Record<SendCoachAlertEmailParams['category'], string> = {
  safety: 'Sécurité — message urgent',
  out_of_scope: 'Hors périmètre — à traiter',
  pattern_inquiry: 'Question de comportement',
  engagement: 'Client inactif',
  weight_off_track: 'Poids hors objectif',
}

export async function sendCoachAlertEmail(params: SendCoachAlertEmailParams) {
  const { to, coachFirstName, clientFirstName, category, messageExcerpt, inboxUrl } = params

  const isSafety = category === 'safety'
  const subjectPrefix = isSafety ? '🚨 [Urgent] ' : '⚡ Action requise — '
  const subject = `${subjectPrefix}${clientFirstName} vous a envoyé un message`

  const categoryLabel = CATEGORY_LABELS[category]

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      body: `
        ${greeting(coachFirstName)}
        ${bodyText(`<strong style="color:${DS.white};">${clientFirstName}</strong> vous a envoyé un message qui demande votre attention.`)}
        ${infoTable([
          { label: 'Catégorie', value: categoryLabel, accent: isSafety },
          { label: 'Extrait', value: `"${messageExcerpt}"` },
        ])}
        ${ctaButton(inboxUrl, 'Voir dans l\'espace coach')}
        ${hint('Ce message a été automatiquement signalé par le système STRYVR. Répondez depuis votre espace coach.')}
      `,
    }),
  })
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

---

## Task 9 — Utilitaire sendCoachNotification

**Files:**
- Create: `lib/notifications/sendCoachNotification.ts`

- [ ] **Créer l'utilitaire**

```typescript
// lib/notifications/sendCoachNotification.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendCoachAlertEmail } from '@/lib/email/mailer'

type NotificationCategory = 'safety' | 'out_of_scope' | 'pattern_inquiry' | 'engagement' | 'weight_off_track'

export interface NotifyCoachParams {
  db: SupabaseClient
  coachId: string
  clientId: string
  chatMessageId?: string
  category: NotificationCategory
  subcategory?: string
  priority: 1 | 2 | 3 | 4 | 5
  coachEmail: string
  coachFirstName: string
  clientFirstName: string
  messageExcerpt?: string
}

export async function notifyCoach(params: NotifyCoachParams): Promise<void> {
  const {
    db, coachId, clientId, chatMessageId,
    category, subcategory, priority,
    coachEmail, coachFirstName, clientFirstName, messageExcerpt,
  } = params

  // 1. INSERT coach_notifications
  await db.from('coach_notifications').insert({
    coach_id: coachId,
    client_id: clientId,
    chat_message_id: chatMessageId ?? null,
    category,
    subcategory: subcategory ?? null,
    priority,
    email_sent: false,
  })

  // 2. Email immédiat pour safety — les autres catégories gérées par Bloc E (préférences coach)
  if (category === 'safety') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stryvlab.com'
    const inboxUrl = `${siteUrl}/coach/clients/${clientId}`
    const excerpt = (messageExcerpt ?? '').slice(0, 200)

    await sendCoachAlertEmail({
      to: coachEmail,
      coachFirstName,
      clientFirstName,
      category,
      messageExcerpt: excerpt,
      inboxUrl,
    })

    // Marquer email_sent=true sur toutes les notifs safety pending du client
    await db
      .from('coach_notifications')
      .update({ email_sent: true })
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .eq('category', 'safety')
      .eq('status', 'pending')
  }
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**

```bash
git add lib/email/mailer.ts lib/notifications/sendCoachNotification.ts
git commit -m "feat(notifications): sendCoachAlertEmail + notifyCoach utility"
```

---

## Task 10 — Intégration feature flags + callLLM dans /chat/messages/POST

**Files:**
- Modify: `app/api/client/chat/messages/route.ts`

La fonction POST doit :
1. Inclure `coach_id` dans le select de `resolveClientFromUser`
2. Vérifier le feature flag LLM avant d'appeler OpenAI
3. Remplacer l'appel OpenAI direct par `callLLM`
4. Sauvegarder `trace_id` et `parent_message_id` sur le message bot
5. Si LLM désactivé : marquer le message user avec `requires_coach_response=true`

- [ ] **Remplacer la fonction POST complète**

Localiser la fonction `POST` dans [app/api/client/chat/messages/route.ts](app/api/client/chat/messages/route.ts) et la remplacer par :

```typescript
// POST — envoie message user → feature flag → (LLM ou escalade) → sauvegarde → retourne
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  // Inclure coach_id pour le feature flag check
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name, coach_id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json()
  const content: string = String(body.content ?? '').trim().slice(0, 500)
  const message_type: string = ['text', 'quick_reply', 'slider', 'voice'].includes(body.message_type)
    ? body.message_type
    : 'text'
  if (!content) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // Rate limit via ai_coach_daily_usage (existant — conserver)
  const today = computePhysiologicalDate(new Date())
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', cc.id)
    .eq('date', today)
    .single()

  const count = usage?.message_count ?? 0
  if (count >= DAILY_LIMIT) {
    return NextResponse.json({ error: 'Daily limit reached', remaining: 0 }, { status: 429 })
  }

  // Sauvegarder message utilisateur
  const { data: userMsg } = await db
    .from('chat_messages')
    .insert({ client_id: cc.id, role: 'user', content, message_type })
    .select('id, role, content, message_type, metadata, created_at')
    .single()

  // ── Feature flag check ──────────────────────────────────────────────────────
  const coachId = (cc as any).coach_id as string | null
  let llmEnabled = false

  if (coachId) {
    const [{ data: coachProfile }, { data: clientSettings }] = await Promise.all([
      db.from('coach_profiles')
        .select('has_ai_llm')
        .eq('coach_id', coachId)
        .maybeSingle(),
      db.from('coach_ai_settings_per_client')
        .select('ai_llm_enabled')
        .eq('coach_id', coachId)
        .eq('client_id', cc.id)
        .maybeSingle(),
    ])
    llmEnabled = (coachProfile?.has_ai_llm ?? false) && (clientSettings?.ai_llm_enabled ?? false)
  }

  if (!llmEnabled) {
    // Marquer message comme requérant intervention coach
    if (userMsg) {
      await db
        .from('chat_messages')
        .update({ requires_coach_response: true, coach_response_reason: 'llm_disabled' })
        .eq('id', userMsg.id)
    }
    return NextResponse.json({ userMessage: userMsg, botMessage: null, llmDisabled: true })
  }

  // ── Appel LLM via wrapper centralisé ────────────────────────────────────────
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const systemPrompt = await buildSystemPrompt(cc.id)

  const llmResult = await callLLM({
    systemPrompt,
    userMessage: content,
    conversationHistory: (history ?? [])
      .reverse()
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content) })),
    clientId: cc.id,
    coachId: coachId ?? undefined,
    chatMessageId: userMsg?.id,
    maxTokens: 300,
  })

  let botMsg = null
  if (llmResult) {
    const { data: inserted } = await db
      .from('chat_messages')
      .insert({
        client_id: cc.id,
        role: 'assistant',
        content: llmResult.content,
        message_type: 'text',
        parent_message_id: userMsg?.id ?? null,
        trace_id: llmResult.traceId || null,
      })
      .select('id, role, content, message_type, metadata, created_at')
      .single()
    botMsg = inserted
  }

  // Upsert usage (conserver comportement existant)
  await db.from('ai_coach_daily_usage').upsert(
    { client_id: cc.id, date: today, message_count: count + 1 },
    { onConflict: 'client_id,date' }
  )

  return NextResponse.json({
    userMessage: userMsg,
    botMessage: botMsg,
    remaining: DAILY_LIMIT - count - 1,
  })
}
```

- [ ] **Ajouter l'import callLLM en tête du fichier**

En haut du fichier, après les imports existants :

```typescript
import { callLLM } from '@/lib/llm/callLLM'
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**

```bash
git add app/api/client/chat/messages/route.ts
git commit -m "feat(chat): integrate callLLM wrapper + feature flag check in messages POST"
```

---

## Task 11 — Déprécier /api/client/ai-coach/chat

**Files:**
- Modify: `app/api/client/ai-coach/chat/route.ts`

- [ ] **Remplacer le handler POST par un redirect 308**

Remplacer tout le contenu du fichier par :

```typescript
// @deprecated — use /api/client/chat/messages instead (Chat Release 1 Bloc D)
// 308 Permanent Redirect — clients qui cachent les redirects ne réessaient pas (acceptable route interne)
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/client/chat/messages', req.url), 308)
}
```

- [ ] **Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Commit**

```bash
git add app/api/client/ai-coach/chat/route.ts
git commit -m "chore(chat): deprecate /ai-coach/chat — redirect 308 to /chat/messages"
```

---

## Task 12 — Test email notification (smoke test manuel)

**Objectif :** Vérifier que `sendCoachAlertEmail` envoie bien un email avant de merger.

- [ ] **Créer un script de test temporaire**

```typescript
// scripts/test-coach-alert-email.ts (à supprimer après test)
import { sendCoachAlertEmail } from '../lib/email/mailer'

async function main() {
  await sendCoachAlertEmail({
    to: 'kevhlf@gmail.com',
    coachFirstName: 'Kévin',
    clientFirstName: 'Thomas',
    category: 'safety',
    messageExcerpt: "J'ai très mal au dos depuis ce matin, impossible de bouger.",
    inboxUrl: 'http://localhost:3000/coach/clients/test-id',
  })
  console.log('Email envoyé.')
}

main().catch(console.error)
```

- [ ] **Lancer le script (nécessite RESEND_API_KEY dans .env)**

```bash
npx tsx scripts/test-coach-alert-email.ts
```
Expected: "Email envoyé." — vérifier réception dans la boîte Gmail.

- [ ] **Supprimer le script de test**

```bash
rm scripts/test-coach-alert-email.ts
```

---

## Task 13 — Vérification TypeScript finale + tests complets

- [ ] **TypeScript strict**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Suite de tests complète**

```bash
npx vitest run
```
Expected: tous les tests existants passent + 5 nouveaux tests callLLM PASS.

---

## Task 14 — CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Mettre à jour CHANGELOG.md**

Ajouter en tête sous la date du jour :

```
## 2026-05-29

FEATURE: Add centralized callLLM wrapper with llm_traces observability (lib/llm/callLLM.ts)
FEATURE: Add coach feature flags — has_ai_llm (coach_profiles) + ai_llm_enabled (coach_ai_settings_per_client)
SCHEMA: Chat Release 1 Bloc D — ALTER chat_messages (5 cols), ALTER coach_profiles (5 cols), 4 new tables, increment_llm_budget RPC
FEATURE: sendCoachAlertEmail + notifyCoach utility for coach inbox
CHORE: Deprecate /api/client/ai-coach/chat — redirect 308 to /chat/messages
CHORE: Export PHYSIOLOGICAL_DAY_OFFSET_HOURS from physiological-date.ts
```

- [ ] **Mettre à jour project-state.md**

Dans la section "📦 Modules Core Status", ajouter ou mettre à jour :

```markdown
| **Chat Release 1 — Bloc D** | ✅ DB + observabilité — schema, callLLM wrapper, feature flags | 2026-05-29 |
```

Dans "🚀 Dernières Avancées", ajouter une section :

```markdown
### 2026-05-29 — Chat Release 1 Bloc D — Fondation DB + Observabilité

- `supabase/migrations/20260529_chat_release1_bloc_d.sql` — ALTER chat_messages (+5 cols : parent_message_id, requires_coach_response, coach_response_reason, from_coach_human, trace_id), ALTER coach_profiles (+5 cols AI), 4 nouvelles tables (coach_ai_settings_per_client, coach_llm_budget, llm_traces, coach_notifications), RPC `increment_llm_budget` atomique — **appliquer manuellement via Supabase Dashboard**
- `lib/llm/types.ts` — CallLLMParams, LLMResult, ProviderParams, ProviderResult, LLMProvider
- `lib/llm/providers/openai.ts` — provider isolé, timeout 30s, maxRetries 1 (swap futur = 1 fichier)
- `lib/llm/callLLM.ts` — wrapper centralisé : INSERT llm_traces avant appel, UPDATE après, increment_llm_budget RPC, retourne null si erreur (jamais throw)
- `lib/email/mailer.ts` — +`sendCoachAlertEmail` (template Resend, sujet urgent si safety)
- `lib/notifications/sendCoachNotification.ts` — INSERT coach_notifications + email immédiat si category=safety
- `app/api/client/chat/messages/route.ts` — POST refactoré : feature flag check (has_ai_llm + ai_llm_enabled), callLLM, parent_message_id + trace_id sur botMsg, requires_coach_response si LLM désactivé
- `app/api/client/ai-coach/chat/route.ts` — deprecate POST → redirect 308 /chat/messages
- `lib/nutrition/physiological-date.ts` — export PHYSIOLOGICAL_DAY_OFFSET_HOURS = 4
- Points de vigilance : migration à appliquer manuellement ; llm_traces RLS = aucune policy (service_role only) ; race condition consumed_messages documentée (acceptable R1, fix R2) ; message_type CHECK étendu inclut morning_init/evening_init pour cohérence
```

Dans "Next Steps", cocher :

```markdown
- [x] Chat Release 1 Bloc D — DB + observabilité (2026-05-29)
- [ ] Chat Release 1 Bloc A — Urgences comportementales (branche séparée)
- [ ] Chat Release 1 Bloc C — Escalade silencieuse (branche séparée)
- [ ] Chat Release 1 Bloc B — Bot scripté enrichi (branche séparée)
- [ ] Chat Release 1 Bloc E — Workspace coach (branche séparée)
```

- [ ] **Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Chat Release 1 Bloc D"
```

---

## Récapitulatif des commits

1. `chore(llm): export PHYSIOLOGICAL_DAY_OFFSET_HOURS from physiological-date`
2. `feat(llm): add centralized callLLM wrapper with llm_traces observability`
3. `schema(chat): bloc D migration — chat_messages, coach_profiles, 4 new tables, increment_llm_budget RPC`
4. `feat(notifications): sendCoachAlertEmail + notifyCoach utility`
5. `feat(chat): integrate callLLM wrapper + feature flag check in messages POST`
6. `chore(chat): deprecate /ai-coach/chat — redirect 308 to /chat/messages`
7. `docs: update CHANGELOG and project-state for Chat Release 1 Bloc D`

## Critères de done — Bloc D

- [ ] Migration SQL appliquée (4 tables + 5 colonnes chat_messages + 5 colonnes coach_profiles + RPC)
- [ ] `callLLM` : 5 tests PASS, chaque appel crée une entrée `llm_traces`
- [ ] Feature flag `has_ai_llm=false` → LLM jamais appelé, `requires_coach_response=true` sur message user
- [ ] Email safety reçu sur kevhlf@gmail.com (smoke test)
- [ ] `/ai-coach/chat` POST → redirect 308 `/chat/messages`
- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] `npx vitest run` → 0 régression
- [ ] CHANGELOG + project-state mis à jour
