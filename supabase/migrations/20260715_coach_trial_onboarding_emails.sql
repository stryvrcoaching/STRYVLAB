-- Coach onboarding during the 14-day STRYV lab trial.
-- A delivery row is created only after Resend accepts the email, which makes the
-- daily scheduler safe to retry without duplicating a completed step.

ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS notif_onboarding_emails boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.coach_trial_onboarding_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_key text NOT NULL CHECK (sequence_key IN ('setup', 'workflow', 'progress', 'trial_ending')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, sequence_key)
);

CREATE INDEX IF NOT EXISTS coach_trial_onboarding_deliveries_coach_idx
  ON public.coach_trial_onboarding_email_deliveries (coach_id, sent_at DESC);

ALTER TABLE public.coach_trial_onboarding_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach views own onboarding email history"
  ON public.coach_trial_onboarding_email_deliveries FOR SELECT
  USING (coach_id = auth.uid());
