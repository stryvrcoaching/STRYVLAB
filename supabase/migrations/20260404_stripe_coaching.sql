-- ============================================================
-- Stripe Coaching Integration
-- 2026-04-04
-- Champs Stripe sur les tables CRM existantes
-- ============================================================

-- stripe_customer_id sur coach_clients
-- Un Stripe Customer est créé la première fois qu'un client est facturé
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

-- Stripe Product + Price sur coach_formulas
-- Créés automatiquement à la première utilisation de la formule
ALTER TABLE coach_formulas
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id    text;

-- Stripe Subscription + Session sur client_subscriptions
ALTER TABLE client_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- Index pour lookup rapide par stripe IDs (webhook handler)
CREATE INDEX IF NOT EXISTS idx_coach_clients_stripe_customer
  ON coach_clients(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_subscriptions_stripe_sub
  ON client_subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coach_formulas_stripe_product
  ON coach_formulas(stripe_product_id)
  WHERE stripe_product_id IS NOT NULL;
