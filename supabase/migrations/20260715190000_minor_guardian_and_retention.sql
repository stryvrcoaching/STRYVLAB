-- Minor authorization evidence and post-cancellation data window.

ALTER TABLE public.coach_clients
  ADD COLUMN IF NOT EXISTS minor_authorization_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS minor_guardian_name text,
  ADD COLUMN IF NOT EXISTS minor_guardian_email text,
  ADD COLUMN IF NOT EXISTS minor_authorization_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS minor_authorization_confirmed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_clients_minor_authorization_status_check'
  ) THEN
    ALTER TABLE public.coach_clients
      ADD CONSTRAINT coach_clients_minor_authorization_status_check
      CHECK (minor_authorization_status IN (
        'not_required', 'authorization_required', 'authorized', 'revoked'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_clients_minor_authorization_evidence_check'
  ) THEN
    ALTER TABLE public.coach_clients
      ADD CONSTRAINT coach_clients_minor_authorization_evidence_check
      CHECK (
        minor_authorization_status <> 'authorized'
        OR (
          length(btrim(coalesce(minor_guardian_name, ''))) >= 2
          AND length(btrim(coalesce(minor_guardian_email, ''))) >= 3
          AND minor_authorization_confirmed_at IS NOT NULL
          AND minor_authorization_confirmed_by IS NOT NULL
        )
      );
  END IF;
END $$;

UPDATE public.coach_clients
SET minor_authorization_status = CASE
  WHEN date_of_birth IS NOT NULL
    AND date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date
    THEN 'authorization_required'
  ELSE 'not_required'
END
WHERE minor_authorization_status = 'not_required';

CREATE INDEX IF NOT EXISTS coach_clients_minor_authorization_idx
  ON public.coach_clients (coach_id, minor_authorization_status)
  WHERE minor_authorization_status IN ('authorization_required', 'revoked');

COMMENT ON COLUMN public.coach_clients.minor_authorization_status IS
  'Operational safeguard: guardian authorization status for clients under 18.';
COMMENT ON COLUMN public.coach_clients.minor_authorization_confirmed_by IS
  'Coach auth user who attested that guardian authority and authorization were verified.';

ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS billing_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_export_available_until timestamptz,
  ADD COLUMN IF NOT EXISTS data_deletion_scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS coach_profiles_data_deletion_schedule_idx
  ON public.coach_profiles (data_deletion_scheduled_at)
  WHERE data_deletion_scheduled_at IS NOT NULL;

COMMENT ON COLUMN public.coach_profiles.data_export_available_until IS
  'End of the read/export window after platform subscription cancellation.';
COMMENT ON COLUMN public.coach_profiles.data_deletion_scheduled_at IS
  'Operational review date; deletion remains subject to legal holds and statutory retention.';

-- Billing state must only be changed through trusted server-side routes and webhooks.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.coach_profiles TO authenticated;
