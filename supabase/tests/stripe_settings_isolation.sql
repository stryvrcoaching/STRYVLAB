-- Run in a test database with ON_ERROR_STOP enabled. All fixtures are rolled back.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000011', 'security-stripe-a@example.invalid'),
  ('a0000000-0000-4000-8000-000000000012', 'security-stripe-b@example.invalid');
INSERT INTO public.coach_payment_settings (coach_id, stripe_account_id)
VALUES ('a0000000-0000-4000-8000-000000000011', 'acct_security_fixture');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000011"}', true);
INSERT INTO public.coach_payment_settings (coach_id, receipts_auto_send)
VALUES ('a0000000-0000-4000-8000-000000000011', false)
ON CONFLICT (coach_id) DO UPDATE SET coach_id = excluded.coach_id, receipts_auto_send = excluded.receipts_auto_send;
DO $$ BEGIN
  ASSERT (SELECT stripe_account_id FROM public.coach_payment_settings WHERE coach_id = auth.uid()) = 'acct_security_fixture',
    'Coach must retain read access to their own settings';
  ASSERT (SELECT receipts_auto_send FROM public.coach_payment_settings WHERE coach_id = auth.uid()) = false,
    'Existing clients must retain preference upserts';
  BEGIN
    UPDATE public.coach_payment_settings SET coach_id = 'a0000000-0000-4000-8000-000000000012' WHERE coach_id = auth.uid();
    RAISE EXCEPTION 'A coach must not transfer settings to another account';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.coach_payment_settings SET stripe_account_id = 'acct_security_changed' WHERE coach_id = auth.uid();
    RAISE EXCEPTION 'Browser roles must not change the connected account';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.coach_payment_settings SET stripe_charges_enabled = true WHERE coach_id = auth.uid();
    RAISE EXCEPTION 'Browser roles must not forge Stripe status';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.coach_payment_settings WHERE coach_id = auth.uid();
    RAISE EXCEPTION 'Browser roles must not delete and recreate a connected account association';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"a0000000-0000-4000-8000-000000000012"}', true);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.coach_payment_settings WHERE coach_id = 'a0000000-0000-4000-8000-000000000011') = 0,
    'Another account must not read coach A payment settings';
  BEGIN
    INSERT INTO public.coach_payment_settings (coach_id, stripe_account_id) VALUES (auth.uid(), 'acct_security_injected');
    RAISE EXCEPTION 'Browser roles must not create an account association';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
UPDATE public.coach_payment_settings SET receipts_auto_send = false
WHERE coach_id = 'a0000000-0000-4000-8000-000000000011';
DO $$ BEGIN
  ASSERT (SELECT receipts_auto_send FROM public.coach_payment_settings WHERE coach_id = 'a0000000-0000-4000-8000-000000000011') = false,
    'Authenticated server preference updates must remain possible';
  ASSERT (SELECT stripe_account_id FROM public.coach_payment_settings WHERE coach_id = 'a0000000-0000-4000-8000-000000000011') = 'acct_security_fixture',
    'Preference updates must retain the connected account';
END $$;
RESET ROLE;
ROLLBACK;
