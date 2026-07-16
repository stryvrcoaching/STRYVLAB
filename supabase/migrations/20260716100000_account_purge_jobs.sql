-- Idempotent account-purge queue. The queue is intentionally not linked to
-- auth.users so the audit record survives successful account deletion.

CREATE TABLE IF NOT EXISTS public.account_purge_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'legal_review', 'completed', 'failed', 'canceled')),
  scheduled_for timestamptz NOT NULL,
  next_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  legal_hold_reason text,
  last_error text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_purge_jobs_due_idx
  ON public.account_purge_jobs (status, scheduled_for, next_attempt_at)
  WHERE status IN ('scheduled', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS account_purge_jobs_attention_idx
  ON public.account_purge_jobs (status, updated_at DESC)
  WHERE status IN ('legal_review', 'failed');

ALTER TABLE public.account_purge_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_purge_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.account_purge_jobs TO service_role;

COMMENT ON TABLE public.account_purge_jobs IS
  'Backend-only queue and minimal proof for post-cancellation account purges.';

CREATE OR REPLACE FUNCTION public.sync_account_purge_job_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_status = 'canceled' AND NEW.data_deletion_scheduled_at IS NOT NULL THEN
    INSERT INTO public.account_purge_jobs (
      coach_id,
      status,
      scheduled_for,
      next_attempt_at,
      attempt_count,
      started_at,
      completed_at,
      legal_hold_reason,
      last_error,
      manifest,
      updated_at
    )
    VALUES (
      NEW.coach_id,
      'scheduled',
      NEW.data_deletion_scheduled_at,
      NEW.data_deletion_scheduled_at,
      0,
      NULL,
      NULL,
      NULL,
      NULL,
      '{}'::jsonb,
      now()
    )
    ON CONFLICT (coach_id) DO UPDATE SET
      status = 'scheduled',
      scheduled_for = EXCLUDED.scheduled_for,
      next_attempt_at = EXCLUDED.next_attempt_at,
      attempt_count = 0,
      started_at = NULL,
      completed_at = NULL,
      legal_hold_reason = NULL,
      last_error = NULL,
      manifest = '{}'::jsonb,
      updated_at = now();
  ELSE
    UPDATE public.account_purge_jobs
    SET
      status = 'canceled',
      next_attempt_at = NULL,
      legal_hold_reason = NULL,
      last_error = NULL,
      updated_at = now()
    WHERE coach_id = NEW.coach_id
      AND status IN ('scheduled', 'processing', 'legal_review', 'failed');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_account_purge_job_from_profile ON public.coach_profiles;
CREATE TRIGGER sync_account_purge_job_from_profile
  AFTER INSERT OR UPDATE OF billing_status, data_deletion_scheduled_at
  ON public.coach_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_account_purge_job_from_profile();

REVOKE ALL ON FUNCTION public.sync_account_purge_job_from_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_account_purge_job_from_profile() TO service_role;

INSERT INTO public.account_purge_jobs (coach_id, scheduled_for, next_attempt_at)
SELECT coach_id, data_deletion_scheduled_at, data_deletion_scheduled_at
FROM public.coach_profiles
WHERE billing_status = 'canceled'
  AND data_deletion_scheduled_at IS NOT NULL
ON CONFLICT (coach_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_due_account_purge_jobs(batch_size integer DEFAULT 5)
RETURNS SETOF public.account_purge_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.account_purge_jobs
    WHERE scheduled_for <= now()
      AND attempt_count < 3
      AND (
        (status IN ('scheduled', 'failed') AND coalesce(next_attempt_at, scheduled_for) <= now())
        OR (status = 'processing' AND started_at < now() - interval '2 hours')
      )
    ORDER BY scheduled_for ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(batch_size, 20))
  ), claimed AS (
    UPDATE public.account_purge_jobs jobs
    SET
      status = 'processing',
      attempt_count = jobs.attempt_count + 1,
      started_at = now(),
      last_error = NULL,
      updated_at = now()
    FROM due
    WHERE jobs.id = due.id
    RETURNING jobs.*
  )
  SELECT * FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_account_purge_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_account_purge_jobs(integer) TO service_role;
