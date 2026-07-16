-- Les rappels doivent reposer sur l'échéance, jamais sur la date de création du paiement.
UPDATE public.subscription_payments
SET due_date = payment_date
WHERE status = 'pending'
  AND due_date IS NULL
  AND payment_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_payments_pending_reminder_due_idx
  ON public.subscription_payments (due_date)
  WHERE status = 'pending' AND reminder_sent_at IS NULL;
