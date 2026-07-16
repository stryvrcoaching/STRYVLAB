ALTER TABLE public.beta_waitlist
  ADD COLUMN IF NOT EXISTS lead_kind text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_coach_id uuid REFERENCES public.coach_profiles(coach_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beta_waitlist_lead_kind_check'
  ) THEN
    ALTER TABLE public.beta_waitlist
      ADD CONSTRAINT beta_waitlist_lead_kind_check
      CHECK (lead_kind IN ('client_beta', 'coach_lead', 'coach_demo', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beta_waitlist_lead_status_check'
  ) THEN
    ALTER TABLE public.beta_waitlist
      ADD CONSTRAINT beta_waitlist_lead_status_check
      CHECK (lead_status IN ('new', 'qualified', 'contacted', 'demo_requested', 'demo_scheduled', 'proposal_sent', 'won', 'lost', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beta_waitlist_priority_check'
  ) THEN
    ALTER TABLE public.beta_waitlist
      ADD CONSTRAINT beta_waitlist_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

UPDATE public.beta_waitlist
SET
  lead_kind = CASE
    WHEN source = 'coaches-demo-request' THEN 'coach_demo'
    WHEN source = 'coaches-landing' THEN 'coach_lead'
    WHEN source = 'stryvr-landing' THEN 'client_beta'
    ELSE 'other'
  END,
  lead_status = CASE
    WHEN source = 'coaches-demo-request' THEN 'demo_requested'
    ELSE lead_status
  END
WHERE lead_kind = 'other' OR lead_status = 'new';

CREATE INDEX IF NOT EXISTS beta_waitlist_lead_status_idx
  ON public.beta_waitlist (lead_status, created_at DESC);

CREATE INDEX IF NOT EXISTS beta_waitlist_lead_kind_idx
  ON public.beta_waitlist (lead_kind, created_at DESC);

CREATE INDEX IF NOT EXISTS beta_waitlist_next_follow_up_idx
  ON public.beta_waitlist (next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;
