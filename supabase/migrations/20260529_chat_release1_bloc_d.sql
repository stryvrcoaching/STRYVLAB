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
