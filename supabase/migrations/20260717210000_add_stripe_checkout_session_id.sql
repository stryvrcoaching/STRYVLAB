-- supabase/migrations/20260717210000_add_stripe_checkout_session_id.sql
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
