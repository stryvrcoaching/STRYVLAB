CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  actor_type text NOT NULL
    CHECK (actor_type IN ('anonymous', 'client', 'coach', 'internal', 'system')),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  ip_address text,
  user_agent text,
  request_path text,
  request_method text,
  resource_type text,
  resource_id text,
  outcome text NOT NULL
    CHECK (outcome IN ('success', 'failure', 'blocked', 'info')),
  reason text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS security_events_created_at_idx
  ON public.security_events (created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_event_type_idx
  ON public.security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_actor_user_id_idx
  ON public.security_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_ip_address_idx
  ON public.security_events (ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS public.security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL
    CHECK (source IN ('auth', 'api', 'frontend', 'llm', 'cron', 'security', 'manual')),
  severity text NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  title text NOT NULL,
  description text,
  dedupe_key text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  ip_address text,
  route text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS security_incidents_dedupe_key_open_idx
  ON public.security_incidents (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('open', 'investigating');

CREATE INDEX IF NOT EXISTS security_incidents_status_idx
  ON public.security_incidents (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS security_incidents_severity_idx
  ON public.security_incidents (severity, last_seen_at DESC);
