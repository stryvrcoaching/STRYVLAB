-- User-authorized imports from Apple Health / Health Connect.
-- Keep imported daily summaries separate from client-entered check-ins.

CREATE TABLE IF NOT EXISTS public.client_health_connections (
  client_id UUID PRIMARY KEY REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_health_daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  steps INTEGER CHECK (steps IS NULL OR steps BETWEEN 0 AND 200000),
  sleep_minutes INTEGER CHECK (sleep_minutes IS NULL OR sleep_minutes BETWEEN 0 AND 1440),
  resting_heart_rate INTEGER CHECK (resting_heart_rate IS NULL OR resting_heart_rate BETWEEN 30 AND 220),
  weight_kg NUMERIC(5,2) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 300),
  source_details JSONB NOT NULL DEFAULT '{}',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, local_date, platform)
);

CREATE INDEX IF NOT EXISTS client_health_daily_summaries_client_date_idx
  ON public.client_health_daily_summaries (client_id, local_date DESC);

ALTER TABLE public.client_health_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_health_daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_read_own_health_connection"
  ON public.client_health_connections
  FOR SELECT
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE user_id = auth.uid()));

CREATE POLICY "client_read_own_health_summaries"
  ON public.client_health_daily_summaries
  FOR SELECT
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE user_id = auth.uid()));

CREATE POLICY "coach_read_client_health_summaries"
  ON public.client_health_daily_summaries
  FOR SELECT
  USING (client_id IN (SELECT id FROM public.coach_clients WHERE coach_id = auth.uid()));
