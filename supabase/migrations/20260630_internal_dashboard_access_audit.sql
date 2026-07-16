CREATE TABLE IF NOT EXISTS public.internal_dashboard_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_key text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  ip_address text,
  user_agent text,
  request_method text NOT NULL,
  request_path text NOT NULL,
  outcome text NOT NULL
    CHECK (outcome IN ('allowed', 'denied', 'rate_limited', 'unauthenticated')),
  reason text,
  alert_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_dashboard_access_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS internal_dashboard_access_audit_dashboard_created_idx
  ON public.internal_dashboard_access_audit (dashboard_key, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_dashboard_access_audit_ip_created_idx
  ON public.internal_dashboard_access_audit (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS internal_dashboard_access_audit_outcome_created_idx
  ON public.internal_dashboard_access_audit (outcome, created_at DESC);
