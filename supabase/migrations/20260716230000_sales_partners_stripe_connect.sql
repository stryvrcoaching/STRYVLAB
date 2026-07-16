-- Add Stripe Connect integration columns to sales_partners table
ALTER TABLE public.sales_partners
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_account_status text NOT NULL DEFAULT 'not_connected';
