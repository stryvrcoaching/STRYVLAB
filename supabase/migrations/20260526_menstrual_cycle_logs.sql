-- menstrual_cycle_logs — Cycle Sync v2
-- client_id references coach_clients (the internal client profile table)

CREATE TABLE menstrual_cycle_logs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  period_start_date           date NOT NULL,
  period_end_date             date NULL,
  computed_cycle_length_days  int NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_start UNIQUE (client_id, period_start_date)
);

CREATE INDEX idx_cycle_logs_client_date
  ON menstrual_cycle_logs(client_id, period_start_date DESC);

ALTER TABLE menstrual_cycle_logs ENABLE ROW LEVEL SECURITY;

-- Client: full access to own rows
CREATE POLICY "cycle_logs_client_own"
  ON menstrual_cycle_logs FOR ALL
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Coach: read-only access to their clients' rows
CREATE POLICY "cycle_logs_coach_read"
  ON menstrual_cycle_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );
