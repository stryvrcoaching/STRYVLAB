-- Add push_token to sales_partners table for Web Push notifications
ALTER TABLE public.sales_partners
  ADD COLUMN IF NOT EXISTS push_token text;
