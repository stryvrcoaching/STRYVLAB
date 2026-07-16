CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text NOT NULL,
  request_type text NOT NULL CHECK (
    request_type IN (
      'access',
      'rectification',
      'erasure',
      'restriction',
      'objection',
      'portability',
      'other'
    )
  ),
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN (
      'received',
      'identity_verification',
      'processing',
      'completed',
      'refused',
      'cancelled'
    )
  ),
  request_details text,
  source text NOT NULL DEFAULT 'in_app' CHECK (source IN ('in_app', 'email', 'support', 'other')),
  identity_verification_method text,
  identity_verified_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  statutory_due_at timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  extended_due_at timestamptz,
  extension_reason text,
  completed_at timestamptz,
  outcome_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_requests_requester_idx
  ON public.privacy_requests (requester_user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS privacy_requests_deadline_idx
  ON public.privacy_requests (status, statutory_due_at)
  WHERE status IN ('received', 'identity_verification', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_one_open_type_per_user_idx
  ON public.privacy_requests (requester_user_id, request_type)
  WHERE requester_user_id IS NOT NULL
    AND status IN ('received', 'identity_verification', 'processing');

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.privacy_requests FROM anon;
REVOKE ALL ON TABLE public.privacy_requests FROM authenticated;

COMMENT ON TABLE public.privacy_requests IS
  'Operational register for GDPR data-subject requests. Access is restricted to trusted server-side service-role workflows.';
