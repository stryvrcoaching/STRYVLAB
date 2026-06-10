-- supabase/migrations/20260521_ai_coach_daily_usage.sql

CREATE TABLE IF NOT EXISTS ai_coach_daily_usage (
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, date)
);

-- RLS: client can read their own row; no direct writes (service role only)
ALTER TABLE ai_coach_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_read_own_usage"
  ON ai_coach_daily_usage
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );
