ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS client_limit integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS team_seats integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_profiles_plan_check'
  ) THEN
    ALTER TABLE public.coach_profiles
      ADD CONSTRAINT coach_profiles_plan_check
      CHECK (plan IN ('solo', 'pro', 'studio'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_profiles_billing_status_check'
  ) THEN
    ALTER TABLE public.coach_profiles
      ADD CONSTRAINT coach_profiles_billing_status_check
      CHECK (billing_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled'));
  END IF;
END $$;
