-- supabase/migrations/20260514_beta_waitlist.sql

CREATE TABLE IF NOT EXISTS beta_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'stryvr-landing'
);

CREATE UNIQUE INDEX IF NOT EXISTS beta_waitlist_email_idx ON beta_waitlist (lower(email));

ALTER TABLE beta_waitlist ENABLE ROW LEVEL SECURITY;

-- Insert public (anon peut s'inscrire)
CREATE POLICY "beta_waitlist_insert_anon"
  ON beta_waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- Select uniquement authenticated (coaches/admin)
CREATE POLICY "beta_waitlist_select_authenticated"
  ON beta_waitlist FOR SELECT
  TO authenticated
  USING (true);
