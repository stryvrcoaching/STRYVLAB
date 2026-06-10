# Spec — Chat Release 1 Bloc D : DB + Observabilité

**Date :** 2026-05-29  
**Statut :** Approuvé  
**Priorité :** BLOQUANT — à merger avant tous les autres blocs (A, B, C, E)  
**Branche cible :** `feat/chat-first-sp1`

---

## Contexte

Fondation technique de la Release 1. Tous les blocs suivants dépendent des colonnes, tables, et wrapper introduits ici. Aucune logique UI, aucun changement visible côté client — infrastructure pure.

---

## Périmètre

1. Migration SQL complète (ALTER + 4 nouvelles tables)
2. Wrapper LLM centralisé `lib/llm/callLLM.ts`
3. Intégration feature flag dans `/api/client/chat/messages/POST`
4. Dépréciation de `/api/client/ai-coach/chat/route.ts`
5. Fonction email coach `sendCoachAlertEmail` dans `lib/email/mailer.ts`
6. Utilitaire `lib/notifications/sendCoachNotification.ts`
7. Constante `PHYSIOLOGICAL_DAY_OFFSET_HOURS` exportée centralement

---

## Section 1 — Migration SQL

**Fichier :** `supabase/migrations/20260529_chat_release1_bloc_d.sql`  
**Application :** manuelle via Supabase Dashboard SQL Editor. Backup avant.

### 1.1 ALTER `chat_messages`

Cinq nouvelles colonnes :

```sql
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS parent_message_id    uuid        REFERENCES chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_coach_response boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_response_reason  text      CHECK (coach_response_reason IN (
    'safety_health', 'safety_mental', 'out_of_scope_protocol',
    'out_of_scope_prediction', 'data_missing', 'llm_disabled'
  )),
  ADD COLUMN IF NOT EXISTS from_coach_human      boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trace_id              uuid;
```

Extension du CHECK `message_type` (DROP + re-CREATE, nom auto-généré `chat_messages_message_type_check`) :

```sql
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN (
    'text', 'quick_reply', 'slider', 'voice',
    'checkin_summary', 'bilan_signed',
    'nutrition_alert_auto', 'training_alert_auto',
    'morning_init', 'evening_init',
    'pattern_inquiry'
  ));
```

> ⚠️ `morning_init` et `evening_init` déjà utilisés dans le code — inclus dans le nouveau CHECK pour cohérence.

### 1.2 ALTER `coach_profiles`

```sql
ALTER TABLE coach_profiles
  ADD COLUMN IF NOT EXISTS has_ai_llm            boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_tone               text     NOT NULL DEFAULT 'bienveillant'
    CHECK (ai_tone IN ('strict', 'bienveillant', 'motivant', 'neutre')),
  ADD COLUMN IF NOT EXISTS ai_coach_name         text,
  ADD COLUMN IF NOT EXISTS ai_permissions        jsonb    NOT NULL DEFAULT '{"give_nutrition_advice":true,"give_training_advice":true,"give_lifestyle_advice":true}',
  ADD COLUMN IF NOT EXISTS ai_custom_instructions text;
```

### 1.3 Nouvelle table `coach_ai_settings_per_client`

Override par client des paramètres globaux coach. Si ligne existe pour (coach_id, client_id), prime sur les défauts.

```sql
CREATE TABLE IF NOT EXISTS coach_ai_settings_per_client (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id              uuid        NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  ai_llm_enabled         boolean     NOT NULL DEFAULT false,
  ai_tone                text        CHECK (ai_tone IN ('strict', 'bienveillant', 'motivant', 'neutre')),
  ai_custom_instructions text,
  monthly_quota          integer     CHECK (monthly_quota > 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id)
);

ALTER TABLE coach_ai_settings_per_client ENABLE ROW LEVEL SECURITY;

-- Coach : CRUD sur ses propres lignes
CREATE POLICY "coach_ai_settings_coach_crud" ON coach_ai_settings_per_client
  FOR ALL USING (coach_id = auth.uid());

-- Client : SELECT uniquement (pour savoir si LLM activé)
CREATE POLICY "coach_ai_settings_client_select" ON coach_ai_settings_per_client
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS coach_ai_settings_coach_client_idx
  ON coach_ai_settings_per_client (coach_id, client_id);
```

### 1.4 Nouvelle table `coach_llm_budget`

Suivi mensuel de consommation LLM par coach. UI billing en R3.

```sql
CREATE TABLE IF NOT EXISTS coach_llm_budget (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id             uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                date    NOT NULL,  -- premier jour du mois
  tier_included_quota  integer NOT NULL DEFAULT 500,
  purchased_credits    integer NOT NULL DEFAULT 0,
  consumed_messages    integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, month)
);

ALTER TABLE coach_llm_budget ENABLE ROW LEVEL SECURITY;

-- Coach : SELECT uniquement (les incréments passent par service_role)
CREATE POLICY "coach_llm_budget_coach_select" ON coach_llm_budget
  FOR SELECT USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_llm_budget_coach_month_idx
  ON coach_llm_budget (coach_id, month DESC);
```

### 1.5 Nouvelle table `llm_traces`

Observabilité interne. Accès réservé à l'équipe (service_role). Pas d'accès coach en R1.

```sql
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

-- RLS : service_role bypass, aucun accès utilisateur direct
ALTER TABLE llm_traces ENABLE ROW LEVEL SECURITY;
-- Pas de policy : seul service_role peut écrire/lire

-- Index sélectifs (éviter les colonnes text volumineuses)
CREATE INDEX IF NOT EXISTS llm_traces_created_at_idx   ON llm_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS llm_traces_client_id_idx    ON llm_traces (client_id);
CREATE INDEX IF NOT EXISTS llm_traces_coach_id_idx     ON llm_traces (coach_id);
CREATE INDEX IF NOT EXISTS llm_traces_error_type_idx   ON llm_traces (error_type) WHERE error_type IS NOT NULL;
```

### 1.6 Nouvelle table `coach_notifications`

Inbox coach. Alimentée par Bloc C (escalades) et Bloc B (alertes patterns). Consommée par Bloc E.

```sql
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
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  priority         integer     NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  email_sent       boolean     NOT NULL DEFAULT false,
  resolved_at      timestamptz
);

ALTER TABLE coach_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_notifications_coach_crud" ON coach_notifications
  FOR ALL USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_notifications_coach_status_idx
  ON coach_notifications (coach_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS coach_notifications_coach_priority_idx
  ON coach_notifications (coach_id, priority, created_at DESC) WHERE status = 'pending';
```

---

## Section 2 — Wrapper LLM centralisé

**Fichier :** `lib/llm/callLLM.ts`  
**Provider :** `lib/llm/providers/openai.ts` (isolé pour swap futur)

### Types

```typescript
export interface CallLLMParams {
  systemPrompt: string
  userMessage: string
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[]
  contextSummary?: Record<string, unknown>
  clientId?: string
  coachId?: string
  chatMessageId?: string
  maxTokens?: number   // default: 300
}

export interface LLMResult {
  content: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  traceId: string
}
```

### Séquence d'exécution

1. `INSERT INTO llm_traces` avec tous les inputs → récupère `traceId`
2. Appelle `callOpenAI(params)` depuis `providers/openai.ts` (timeout 30s, 1 retry sur erreur transitoire)
3. **Succès :** `UPDATE llm_traces SET response_content, tokens_in, tokens_out, latency_ms`
   - `UPSERT coach_llm_budget (coach_id, month) → consumed_messages + 1`
   - Retourne `LLMResult`
4. **Erreur :** `UPDATE llm_traces SET error, error_type`
   - Retourne `null` (jamais de throw — l'appelant gère le fallback)

### Comportement erreur côté appelant

Si `callLLM` retourne `null` :
- Ne pas afficher de message d'erreur technique au client
- En R1 : ne pas insérer de message bot (silence)
- Prévu Bloc C : escalader comme `data_missing`

### Provider isolation

```typescript
// lib/llm/providers/openai.ts
export async function callOpenAI(params: ProviderParams): Promise<ProviderResult>
```

Interface `ProviderParams` / `ProviderResult` définie dans `lib/llm/types.ts`. Si swap vers Claude Sonnet → nouveau fichier `providers/anthropic.ts`, modifier 1 ligne dans `callLLM.ts`.

### Concurrence `consumed_messages`

R1 : légère imprécision acceptable (UPSERT sans transaction stricte). Non facturé au message. Documenter dans le code. Fix en R2 si billing activé.

---

## Section 3 — Intégration feature flag

**Fichier modifié :** `app/api/client/chat/messages/route.ts` — fonction POST

Avant appel LLM, vérifier dans l'ordre :

```typescript
// 1. Check coach global flag
const { data: coachProfile } = await db
  .from('coach_profiles')
  .select('has_ai_llm')
  .eq('coach_id', coachId)
  .single()

const globalEnabled = coachProfile?.has_ai_llm ?? false

// 2. Check per-client override
const { data: clientSettings } = await db
  .from('coach_ai_settings_per_client')
  .select('ai_llm_enabled')
  .eq('coach_id', coachId)
  .eq('client_id', clientId)
  .maybeSingle()

const llmEnabled = globalEnabled && (clientSettings?.ai_llm_enabled ?? false)
```

Si `!llmEnabled` : sauvegarder message user avec `requires_coach_response=true`, `coach_response_reason='llm_disabled'`. Retourner `{ userMessage, botMessage: null, llmDisabled: true }`.

Si `llmEnabled` : appeler `callLLM(...)`, sauvegarder botMessage avec `trace_id` de la réponse.

---

## Section 4 — Dépréciation `/api/client/ai-coach/chat`

**Fichier :** `app/api/client/ai-coach/chat/route.ts`

Remplacer le body POST par un redirect 308 vers `/api/client/chat/messages` :

```typescript
// @deprecated — use /api/client/chat/messages instead
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/client/chat/messages', req.url), 308)
}
```

Ne pas supprimer le fichier (clients potentiellement hardcodés en URL). La route `/api/client/ai-coach/context` (GET) n'est pas touchée.

---

## Section 5 — Email notification coach

**Fichier modifié :** `lib/email/mailer.ts` — ajouter en fin de fichier

```typescript
export interface SendCoachAlertEmailParams {
  to: string
  coachFirstName: string
  clientFirstName: string
  category: 'safety' | 'out_of_scope' | 'pattern_inquiry' | 'engagement' | 'weight_off_track'
  messageExcerpt: string   // tronqué à 200 chars côté appelant
  inboxUrl: string
}

export async function sendCoachAlertEmail(params: SendCoachAlertEmailParams): Promise<void>
```

Subject : `"⚡ Action requise — [clientFirstName] vous a envoyé un message"`  
Pour catégorie `safety` : subject `"🚨 [Urgent] [clientFirstName] — message à traiter"`

`inboxUrl` en R1 : `/coach/clients/[clientId]` (Bloc E n'étant pas encore livré, pas d'URL inbox dédiée).

Template réutilise `emailTemplate`, `greeting`, `bodyText`, `ctaButton` existants.

---

## Section 6 — Utilitaire notifications

**Fichier :** `lib/notifications/sendCoachNotification.ts`

```typescript
interface NotifyCoachParams {
  db: SupabaseClient          // service_role client
  coachId: string
  clientId: string
  chatMessageId?: string
  category: CoachNotificationCategory
  subcategory?: string
  priority: 1 | 2 | 3 | 4 | 5
  coachEmail: string
  coachFirstName: string
  clientFirstName: string
  messageExcerpt?: string
}

export async function notifyCoach(params: NotifyCoachParams): Promise<void>
```

Séquence :
1. INSERT `coach_notifications`
2. Si `category === 'safety'` → `sendCoachAlertEmail(...)` immédiatement, `email_sent = true`
3. Autres catégories R1 : email non envoyé (Bloc E gère les préférences)

---

## Section 7 — Constante physiologique

**Fichier modifié :** `lib/nutrition/physiological-date.ts`

Ajouter en tête :
```typescript
export const PHYSIOLOGICAL_DAY_OFFSET_HOURS = 4
```

La fonction `computePhysiologicalDate` utilise déjà ce offset hardcodé à `4` — le remplacer par la constante.

Les autres fichiers qui hardcodent `4h` (`chat-morning-brief.ts`, `chat-evening-brief.ts`, etc.) peuvent migrer vers la constante dans leurs propres PRs — pas bloquant pour ce bloc.

---

## Critères de done

- [ ] Migration SQL appliquée manuellement via Supabase Dashboard
- [ ] `callLLM` wrapper en place — chaque appel crée une entrée `llm_traces`
- [ ] `/chat/messages/POST` utilise `callLLM` + vérifie feature flags
- [ ] `/ai-coach/chat/POST` redirige 308 vers `/chat/messages`
- [ ] `sendCoachAlertEmail` opérationnelle (test : envoyer email de test vers kevhlf@gmail.com)
- [ ] `notifyCoach` INSERT dans `coach_notifications` + email si safety
- [ ] `PHYSIOLOGICAL_DAY_OFFSET_HOURS = 4` exportée
- [ ] `npx tsc --noEmit` — 0 erreur
- [ ] `project-state.md` + `CHANGELOG.md` mis à jour
- [ ] Aucun `any` TypeScript sur les types LLM, Facts, Decision

---

## Points de vigilance

- **`message_type` CHECK** : le nom auto-généré `chat_messages_message_type_check` peut différer si Supabase l'a nommé autrement. Vérifier via `\d chat_messages` avant le DROP. Alternativement : `ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;` est sûr (IF EXISTS).
- **`morning_init` / `evening_init`** déjà insérés dans la DB sans contrainte CHECK — inclus dans le nouveau CHECK pour éviter des violations futures.
- **`llm_traces` RLS** : aucune policy = seul service_role peut écrire/lire. Ne pas ajouter de policy coach accidentellement.
- **Race condition `consumed_messages`** : légère imprécision acceptée en R1, documenter dans le code avec `// TODO R2: wrap in transaction when billing is active`.
- **Backfill** : colonnes nouvelles sur `chat_messages` — valeurs DEFAULT appliquées automatiquement aux lignes existantes. Aucun backfill manuel nécessaire.
- **`/ai-coach/chat` redirect** : 308 permanent — les navigateurs/clients qui cachent les redirects ne réessaieront pas. Acceptable pour une route interne.
