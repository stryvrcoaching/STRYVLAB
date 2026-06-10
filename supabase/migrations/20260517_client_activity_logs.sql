-- supabase/migrations/20260517_client_activity_logs.sql
CREATE TABLE IF NOT EXISTS client_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('running','cycling','swimming','walking','team_sport','other')),
  custom_label text,
  started_at timestamptz NOT NULL,
  duration_min int NOT NULL CHECK (duration_min BETWEEN 1 AND 360),
  intensity int NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_client_date
  ON client_activity_logs (client_id, started_at DESC);

ALTER TABLE client_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_client_all ON client_activity_logs;
CREATE POLICY activity_client_all ON client_activity_logs
  FOR ALL USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS activity_coach_select ON client_activity_logs;
CREATE POLICY activity_coach_select ON client_activity_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
