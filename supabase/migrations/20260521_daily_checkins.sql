-- Migration: client_daily_checkins
-- Stores morning/evening check-in data collected via interactive chat flows

CREATE TABLE IF NOT EXISTS client_daily_checkins (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date            date NOT NULL,
  flow_type       text NOT NULL CHECK (flow_type IN ('morning', 'evening')),

  -- Morning + shared fields
  sleep_hours     numeric(4,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  sleep_quality   smallint CHECK (sleep_quality BETWEEN 1 AND 4),
  energy_level    smallint CHECK (energy_level BETWEEN 1 AND 5),
  stress_level    smallint CHECK (stress_level BETWEEN 1 AND 5),
  weight_kg       numeric(5,2) CHECK (weight_kg BETWEEN 20 AND 300),
  notes           text,

  -- Evening only
  hunger_level    smallint CHECK (hunger_level BETWEEN 1 AND 4),
  muscle_soreness smallint CHECK (muscle_soreness BETWEEN 1 AND 4),

  completed_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, flow_type)
);

CREATE INDEX IF NOT EXISTS client_daily_checkins_client_date_idx
  ON client_daily_checkins (client_id, date DESC);

ALTER TABLE client_daily_checkins ENABLE ROW LEVEL SECURITY;

-- Client: read/write own check-ins
CREATE POLICY "client_rw_own_checkins"
  ON client_daily_checkins
  FOR ALL
  USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

-- Coach: read check-ins of their clients
CREATE POLICY "coach_read_client_checkins"
  ON client_daily_checkins
  FOR SELECT
  USING (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
