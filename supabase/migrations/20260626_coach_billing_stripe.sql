ALTER TABLE public.coach_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_current_period_end timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_profiles_stripe_customer_id_key'
  ) THEN
    ALTER TABLE public.coach_profiles
      ADD CONSTRAINT coach_profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coach_profiles_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.coach_profiles
      ADD CONSTRAINT coach_profiles_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coach_profiles_stripe_price_id
  ON public.coach_profiles (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;
