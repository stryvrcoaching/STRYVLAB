-- A trial is an acquisition benefit, not a subscription state. Keep its history
-- separate from trial_ends_at so it cannot be granted again after cancellation.
ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_consumed_at timestamptz;

-- Preserve the trial history of coaches who already started one before this
-- migration. trial_ends_at is retained for the UI and access rules.
UPDATE public.coach_profiles
SET trial_consumed_at = COALESCE(trial_consumed_at, trial_ends_at)
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_profiles_trial_consumed_at
  ON public.coach_profiles (trial_consumed_at)
  WHERE trial_consumed_at IS NOT NULL;
