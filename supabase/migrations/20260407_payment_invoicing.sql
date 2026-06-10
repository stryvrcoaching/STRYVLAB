-- ─── Payment Invoicing & Reminders ────────────────────────────────────────────
-- Adds invoice tracking, reminder tracking, and next billing date to
-- support the payment stepper modal, PDF receipts, and automated reminders.

-- subscription_payments: 3 new columns
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS invoice_number    text,
  ADD COLUMN IF NOT EXISTS invoice_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at  timestamptz;

-- Unique constraint on invoice_number (scoped to non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_invoice_number_key
  ON public.subscription_payments (invoice_number)
  WHERE invoice_number IS NOT NULL;

-- client_subscriptions: next_billing_date already exists in schema but may
-- not have been added in all envs — safe to re-add with IF NOT EXISTS
ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS next_billing_date date;

-- Index for cron query: pending payments due in the next few days
CREATE INDEX IF NOT EXISTS subscription_payments_pending_due_idx
  ON public.subscription_payments (payment_date)
  WHERE status = 'pending' AND reminder_sent_at IS NULL;
