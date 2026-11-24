-- Connected account references, bank details, and Stripe status are server-owned.
-- The authenticated preferences API writes only its explicit preference allowlist.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_payment_settings FROM PUBLIC, anon, authenticated;
-- Older clients can still save preferences, including the upsert conflict key.
GRANT INSERT (coach_id, enabled_payment_methods, invoices_auto_send, receipts_auto_send, confirmations_auto_send)
  ON TABLE public.coach_payment_settings TO authenticated;
GRANT UPDATE (coach_id, enabled_payment_methods, invoices_auto_send, receipts_auto_send, confirmations_auto_send)
  ON TABLE public.coach_payment_settings TO authenticated;
GRANT SELECT ON TABLE public.coach_payment_settings TO authenticated;
GRANT ALL ON TABLE public.coach_payment_settings TO service_role;
