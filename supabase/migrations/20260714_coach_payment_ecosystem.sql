-- ============================================================
-- Coach payment ecosystem — Connect, invoices and audit trail
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One payment configuration per coach. Bank-transfer values are ciphertext
-- only; clear-text coordinates must never be persisted in this table.
CREATE TABLE IF NOT EXISTS public.coach_payment_settings (
  coach_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE,
  stripe_account_status text NOT NULL DEFAULT 'not_connected'
    CHECK (stripe_account_status IN ('not_connected', 'pending', 'ready', 'restricted', 'disabled')),
  stripe_details_submitted boolean NOT NULL DEFAULT false,
  stripe_charges_enabled boolean NOT NULL DEFAULT false,
  stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  enabled_payment_methods text[] NOT NULL DEFAULT ARRAY['card']::text[]
    CHECK (enabled_payment_methods <@ ARRAY[
      'card', 'apple_pay', 'google_pay', 'sepa_debit',
      'stripe_bank_transfer', 'direct_bank_transfer'
    ]::text[]),
  direct_bank_transfer_enabled boolean NOT NULL DEFAULT false,
  bank_account_holder_ciphertext bytea,
  bank_iban_ciphertext bytea,
  bank_bic_ciphertext bytea,
  bank_iban_last4 text,
  bank_details_updated_at timestamptz,
  invoices_auto_send boolean NOT NULL DEFAULT true,
  receipts_auto_send boolean NOT NULL DEFAULT true,
  confirmations_auto_send boolean NOT NULL DEFAULT true,
  reminder_before_due_days smallint[] NOT NULL DEFAULT ARRAY[3]::smallint[],
  reminder_after_due_days smallint[] NOT NULL DEFAULT ARRAY[1, 7]::smallint[],
  sensitive_actions_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (direct_bank_transfer_enabled = false)
    OR (
      bank_account_holder_ciphertext IS NOT NULL
      AND bank_iban_ciphertext IS NOT NULL
      AND bank_bic_ciphertext IS NOT NULL
      AND bank_iban_last4 IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS public.coach_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.coach_clients(id) ON DELETE RESTRICT,
  subscription_id uuid REFERENCES public.client_subscriptions(id) ON DELETE SET NULL,
  formula_id uuid REFERENCES public.coach_formulas(id) ON DELETE SET NULL,
  invoice_number text,
  description text,
  currency text NOT NULL DEFAULT 'eur' CHECK (currency ~ '^[a-z]{3}$'),
  amount_due numeric(10,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'pending', 'processing', 'paid', 'failed', 'overdue', 'refunded', 'cancelled')),
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  stripe_account_id text,
  stripe_invoice_id text,
  stripe_checkout_session_id text,
  secure_link_token_hash text UNIQUE,
  payment_methods text[] NOT NULL DEFAULT ARRAY['card']::text[],
  communication_preferences jsonb NOT NULL DEFAULT '{"app": true, "email": true}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, invoice_number),
  UNIQUE (stripe_account_id, stripe_invoice_id),
  CHECK (amount_paid <= amount_due OR status IN ('refunded', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.invoice_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.coach_invoices(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.coach_clients(id) ON DELETE RESTRICT,
  payment_method text NOT NULL
    CHECK (payment_method IN ('card', 'apple_pay', 'google_pay', 'sepa_debit', 'stripe_bank_transfer', 'direct_bank_transfer')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_paid')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'eur' CHECK (currency ~ '^[a-z]{3}$'),
  reference text,
  stripe_account_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_payment_method_id text,
  failure_code text,
  failure_message text,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_account_id, stripe_payment_intent_id),
  CHECK (
    (payment_method <> 'direct_bank_transfer')
    OR (reference IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.payment_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.coach_invoices(id) ON DELETE CASCADE,
  notification_type text NOT NULL
    CHECK (notification_type IN ('invoice', 'confirmation', 'receipt', 'reminder_before_due', 'reminder_after_due', 'payment_failed', 'refund')),
  channel text NOT NULL CHECK (channel IN ('email', 'stryvr_app')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  provider_message_id text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, notification_type, channel, scheduled_for)
);

CREATE TABLE IF NOT EXISTS public.payment_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.coach_invoices(id) ON DELETE SET NULL,
  payment_attempt_id uuid REFERENCES public.invoice_payment_attempts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  stripe_account_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stripe_connect_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.coach_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coach_invoices_coach_status_due_idx
  ON public.coach_invoices (coach_id, status, due_date);
CREATE INDEX IF NOT EXISTS coach_invoices_client_idx
  ON public.coach_invoices (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_payment_attempts_invoice_idx
  ON public.invoice_payment_attempts (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_notification_deliveries_due_idx
  ON public.payment_notification_deliveries (status, scheduled_for)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS payment_audit_events_coach_idx
  ON public.payment_audit_events (coach_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
  ON public.stripe_webhook_events (processing_status, created_at);
CREATE INDEX IF NOT EXISTS stripe_connect_oauth_states_lookup_idx
  ON public.stripe_connect_oauth_states (state_hash, expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS subscription_payments_invoice_idx
  ON public.subscription_payments (invoice_id)
  WHERE invoice_id IS NOT NULL;

ALTER TABLE public.coach_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_connect_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach owns payment settings"
  ON public.coach_payment_settings FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach owns invoices"
  ON public.coach_invoices FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach owns invoice payment attempts"
  ON public.invoice_payment_attempts FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach owns notification deliveries"
  ON public.payment_notification_deliveries FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach views payment audit events"
  ON public.payment_audit_events FOR SELECT
  USING (coach_id = auth.uid());

-- Webhook payloads are backend-only. Service role bypasses RLS.

CREATE TRIGGER coach_payment_settings_updated_at
  BEFORE UPDATE ON public.coach_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER coach_invoices_updated_at
  BEFORE UPDATE ON public.coach_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER invoice_payment_attempts_updated_at
  BEFORE UPDATE ON public.invoice_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
