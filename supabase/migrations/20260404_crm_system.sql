-- ============================================================
-- CRM System — Formules, Abonnements, Paiements, Tags
-- 2026-04-04
-- ============================================================

-- ------------------------------------------------------------
-- 1. coach_formulas — Formules créées par le coach
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_eur numeric(10,2) NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('one_time', 'weekly', 'monthly', 'quarterly', 'yearly')),
  duration_months int, -- NULL = sans engagement
  features text[] NOT NULL DEFAULT '{}', -- liste de features incluses
  color text NOT NULL DEFAULT '#6366f1', -- couleur badge UI
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_formulas_coach_crud"
  ON coach_formulas
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ------------------------------------------------------------
-- 2. client_subscriptions — Abonnement client → formule(s)
-- Multi-formules par client supporté
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  formula_id uuid NOT NULL REFERENCES coach_formulas(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'trial')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date, -- NULL = sans fin définie
  next_billing_date date,
  price_override_eur numeric(10,2), -- si prix différent de la formule
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_subscriptions_coach_crud"
  ON client_subscriptions
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Index pour lookup rapide par client
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client_id
  ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_status
  ON client_subscriptions(status);

-- ------------------------------------------------------------
-- 3. subscription_payments — Historique paiements (manuel)
-- Stripe integration-ready (stripe_payment_intent_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES client_subscriptions(id) ON DELETE SET NULL,
  amount_eur numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  payment_method text NOT NULL DEFAULT 'manual'
    CHECK (payment_method IN ('manual', 'bank_transfer', 'card', 'cash', 'stripe', 'other')),
  payment_date date NOT NULL DEFAULT current_date,
  due_date date,
  description text,
  reference text, -- numéro de facture, référence virement, etc.
  stripe_payment_intent_id text, -- pour future intégration Stripe
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_payments_coach_crud"
  ON subscription_payments
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_subscription_payments_client_id
  ON subscription_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_payment_date
  ON subscription_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
  ON subscription_payments(status);

-- ------------------------------------------------------------
-- 4. coach_tags — Tags personnalisés du coach
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, name)
);

ALTER TABLE coach_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_tags_coach_crud"
  ON coach_tags
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ------------------------------------------------------------
-- 5. client_tags — Relation client ↔ tags (N:N)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_tags (
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES coach_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, tag_id)
);

ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_tags_coach_crud"
  ON client_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients cc
      WHERE cc.id = client_tags.client_id
        AND cc.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_clients cc
      WHERE cc.id = client_tags.client_id
        AND cc.coach_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 6. Champs CRM supplémentaires sur coach_clients
-- ------------------------------------------------------------
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS internal_notes text, -- notes privées coach (non visibles du client)
  ADD COLUMN IF NOT EXISTS acquisition_source text -- comment le client a été acquis
    CHECK (acquisition_source IN ('referral', 'social_media', 'website', 'word_of_mouth', 'other', NULL));

-- ------------------------------------------------------------
-- 7. Triggers updated_at
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coach_formulas_updated_at') THEN
    CREATE TRIGGER coach_formulas_updated_at
      BEFORE UPDATE ON coach_formulas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'client_subscriptions_updated_at') THEN
    CREATE TRIGGER client_subscriptions_updated_at
      BEFORE UPDATE ON client_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscription_payments_updated_at') THEN
    CREATE TRIGGER subscription_payments_updated_at
      BEFORE UPDATE ON subscription_payments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
