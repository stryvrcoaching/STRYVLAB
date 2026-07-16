ALTER TABLE public.coach_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.coach_formulas FROM anon;
REVOKE ALL ON TABLE public.client_subscriptions FROM anon;
REVOKE ALL ON TABLE public.subscription_payments FROM anon;
REVOKE ALL ON TABLE public.coach_invoices FROM anon;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.coach_formulas,
           public.client_subscriptions,
           public.subscription_payments,
           public.coach_invoices
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.coach_formulas,
           public.client_subscriptions,
           public.subscription_payments,
           public.coach_invoices
  TO authenticated;

DROP POLICY IF EXISTS "coach_formulas_coach_crud" ON public.coach_formulas;
DROP POLICY IF EXISTS "coach_owns_formulas" ON public.coach_formulas;
CREATE POLICY "coach_owns_formulas"
  ON public.coach_formulas
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "client_subscriptions_coach_crud" ON public.client_subscriptions;
DROP POLICY IF EXISTS "coach_owns_subscriptions" ON public.client_subscriptions;
CREATE POLICY "coach_owns_subscriptions"
  ON public.client_subscriptions
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = client_subscriptions.client_id
        AND client.coach_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.coach_formulas formula
      WHERE formula.id = client_subscriptions.formula_id
        AND formula.coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "subscription_payments_coach_crud" ON public.subscription_payments;
DROP POLICY IF EXISTS "coach_owns_subscription_payments" ON public.subscription_payments;
CREATE POLICY "coach_owns_subscription_payments"
  ON public.subscription_payments
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.coach_clients client
      WHERE client.id = subscription_payments.client_id
        AND client.coach_id = auth.uid()
    )
    AND (
      subscription_payments.subscription_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.client_subscriptions subscription
        WHERE subscription.id = subscription_payments.subscription_id
          AND subscription.coach_id = auth.uid()
          AND subscription.client_id = subscription_payments.client_id
      )
    )
  );

DROP POLICY IF EXISTS "coach owns invoices" ON public.coach_invoices;
DROP POLICY IF EXISTS "coach_owns_invoices" ON public.coach_invoices;
CREATE POLICY "coach_owns_invoices"
  ON public.coach_invoices
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
