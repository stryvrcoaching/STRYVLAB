CREATE TABLE IF NOT EXISTS public.sensitive_operation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key text NOT NULL,
  dashboard_key text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  ip_address text,
  user_agent text,
  request_path text,
  request_method text,
  target_type text,
  target_id text,
  outcome text NOT NULL
    CHECK (outcome IN ('success', 'failure', 'blocked')),
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensitive_operation_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS sensitive_operation_audit_created_at_idx
  ON public.sensitive_operation_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS sensitive_operation_audit_operation_key_idx
  ON public.sensitive_operation_audit (operation_key, created_at DESC);

CREATE INDEX IF NOT EXISTS sensitive_operation_audit_actor_user_id_idx
  ON public.sensitive_operation_audit (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sensitive_operation_audit_dashboard_key_idx
  ON public.sensitive_operation_audit (dashboard_key, created_at DESC);
