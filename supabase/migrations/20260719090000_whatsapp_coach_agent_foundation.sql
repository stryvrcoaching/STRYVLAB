-- WhatsApp Coach Agent — foundation
-- The agent is opt-in, uses a verified coach phone number and is read-only by default.

CREATE TABLE IF NOT EXISTS public.coach_whatsapp_agents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id                uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164              text NOT NULL UNIQUE CHECK (phone_e164 ~ '^[1-9][0-9]{7,14}$'),
  enabled                 boolean NOT NULL DEFAULT false,
  action_policy           text NOT NULL DEFAULT 'confirm_all'
                          CHECK (action_policy IN ('confirm_all')),
  proactive_alerts_enabled boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_whatsapp_agents_enabled_idx
  ON public.coach_whatsapp_agents (phone_e164)
  WHERE enabled = true;

DROP TRIGGER IF EXISTS coach_whatsapp_agents_updated_at ON public.coach_whatsapp_agents;
CREATE TRIGGER coach_whatsapp_agents_updated_at
  BEFORE UPDATE ON public.coach_whatsapp_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coach_whatsapp_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_whatsapp_agents_own" ON public.coach_whatsapp_agents;
CREATE POLICY "coach_whatsapp_agents_own"
  ON public.coach_whatsapp_agents
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Meta can retry deliveries.  Keeping the provider message id makes processing idempotent.
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  coach_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_phone_e164 text NOT NULL CHECK (sender_phone_e164 ~ '^[1-9][0-9]{7,14}$'),
  message_type      text NOT NULL CHECK (message_type IN ('text', 'audio', 'unsupported')),
  body              text,
  raw_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  response_text     text,
  processing_error  text
);

CREATE INDEX IF NOT EXISTS whatsapp_inbound_messages_coach_received_idx
  ON public.whatsapp_inbound_messages (coach_id, received_at DESC);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

-- This table contains raw WhatsApp content and is deliberately service-role only.

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN (
    'webhook_verified', 'message_received', 'message_ignored',
    'assistant_replied', 'assistant_failed', 'action_blocked'
  )),
  message_id  uuid REFERENCES public.whatsapp_inbound_messages(id) ON DELETE SET NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_agent_audit_logs_coach_created_idx
  ON public.whatsapp_agent_audit_logs (coach_id, created_at DESC);

ALTER TABLE public.whatsapp_agent_audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.coach_whatsapp_agents IS
  'WhatsApp Coach Agent configuration. Any write action requires a separate confirmation workflow.';
COMMENT ON TABLE public.whatsapp_inbound_messages IS
  'Service-role-only record of incoming WhatsApp messages for idempotency and audit.';
