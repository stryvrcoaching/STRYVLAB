-- Keep Stripe objects scoped to the coach's own connected account.
-- A product, price, or customer created for one connected account cannot be
-- reused with another one if the coach reconnects Stripe later.

ALTER TABLE public.coach_formulas
  ADD COLUMN IF NOT EXISTS stripe_connected_account_id text;

ALTER TABLE public.coach_clients
  ADD COLUMN IF NOT EXISTS stripe_connected_account_id text;

CREATE INDEX IF NOT EXISTS coach_formulas_stripe_connected_account_idx
  ON public.coach_formulas (stripe_connected_account_id)
  WHERE stripe_connected_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_clients_stripe_connected_account_idx
  ON public.coach_clients (stripe_connected_account_id)
  WHERE stripe_connected_account_id IS NOT NULL;
