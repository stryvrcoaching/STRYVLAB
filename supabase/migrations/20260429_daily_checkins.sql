-- Daily Check-ins Phase 2
-- 6 new tables + push_token on coach_clients

-- push_token for Web Push notifications
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS push_token TEXT NULL;

-- Coach config per client
CREATE TABLE IF NOT EXISTS daily_checkin_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  days_of_week    INT[] NOT NULL DEFAULT '{}',
  moments         JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, client_id)
);

CREATE INDEX IF NOT EXISTS daily_checkin_configs_client_id_idx ON daily_checkin_configs(client_id);
CREATE INDEX IF NOT EXISTS daily_checkin_configs_coach_id_idx ON daily_checkin_configs(coach_id);

-- Client-configured schedules (morning / evening times)
CREATE TABLE IF NOT EXISTS daily_checkin_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  moment          TEXT NOT NULL CHECK (moment IN ('morning', 'evening')),
  scheduled_time  TIME NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'Europe/Paris',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, moment)
);

CREATE INDEX IF NOT EXISTS daily_checkin_schedules_client_id_idx ON daily_checkin_schedules(client_id);

-- Check-in responses (morning / evening)
CREATE TABLE IF NOT EXISTS daily_checkin_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  config_id       UUID NOT NULL REFERENCES daily_checkin_configs(id) ON DELETE CASCADE,
  moment          TEXT NOT NULL CHECK (moment IN ('morning', 'evening')),
  responses       JSONB NOT NULL DEFAULT '{}',
  responded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS daily_checkin_responses_client_id_idx ON daily_checkin_responses(client_id);
CREATE INDEX IF NOT EXISTS daily_checkin_responses_config_id_idx ON daily_checkin_responses(config_id);
CREATE INDEX IF NOT EXISTS daily_checkin_responses_responded_at_idx ON daily_checkin_responses(client_id, responded_at DESC);

-- Meal logs (food journal)
CREATE TABLE IF NOT EXISTS meal_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  name             TEXT NOT NULL,
  photo_url        TEXT NULL,
  quality_rating   INT NULL CHECK (quality_rating BETWEEN 1 AND 5),
  notes            TEXT NULL,
  estimated_macros JSONB NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_logs_client_id_idx ON meal_logs(client_id);
CREATE INDEX IF NOT EXISTS meal_logs_logged_at_idx ON meal_logs(client_id, logged_at DESC);

-- Points history
CREATE TABLE IF NOT EXISTS client_points (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL CHECK (action_type IN ('checkin', 'checkin_late', 'session', 'bilan', 'meal')),
  points       INT NOT NULL,
  reference_id UUID NULL,
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_points_client_id_idx ON client_points(client_id);
CREATE INDEX IF NOT EXISTS client_points_earned_at_idx ON client_points(client_id, earned_at DESC);

-- Streak + level state (one row per client)
CREATE TABLE IF NOT EXISTS client_streaks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE UNIQUE,
  current_streak    INT NOT NULL DEFAULT 0,
  longest_streak    INT NOT NULL DEFAULT 0,
  last_checkin_date DATE NULL,
  level             TEXT NOT NULL CHECK (level IN ('bronze', 'silver', 'gold', 'platinum')) DEFAULT 'bronze',
  total_points      INT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_streaks_client_id_idx ON client_streaks(client_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_daily_checkin_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_checkin_configs_updated_at ON daily_checkin_configs;
CREATE TRIGGER trg_daily_checkin_configs_updated_at
  BEFORE UPDATE ON daily_checkin_configs
  FOR EACH ROW EXECUTE FUNCTION set_daily_checkin_configs_updated_at();

CREATE OR REPLACE FUNCTION set_client_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_streaks_updated_at ON client_streaks;
CREATE TRIGGER trg_client_streaks_updated_at
  BEFORE UPDATE ON client_streaks
  FOR EACH ROW EXECUTE FUNCTION set_client_streaks_updated_at();

-- RLS
ALTER TABLE daily_checkin_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkin_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkin_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_streaks ENABLE ROW LEVEL SECURITY;

-- daily_checkin_configs
CREATE POLICY "coach_manage_checkin_configs" ON daily_checkin_configs
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "client_read_checkin_configs" ON daily_checkin_configs
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

-- daily_checkin_schedules
CREATE POLICY "client_manage_checkin_schedules" ON daily_checkin_schedules
  FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_checkin_schedules" ON daily_checkin_schedules
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));

-- daily_checkin_responses
CREATE POLICY "client_manage_checkin_responses" ON daily_checkin_responses
  FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_checkin_responses" ON daily_checkin_responses
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));

-- meal_logs
CREATE POLICY "client_manage_meal_logs" ON meal_logs
  FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_meal_logs" ON meal_logs
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));

-- client_points
CREATE POLICY "client_read_points" ON client_points
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_points" ON client_points
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));

-- client_streaks
CREATE POLICY "client_read_streaks" ON client_streaks
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

CREATE POLICY "coach_read_streaks" ON client_streaks
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE coach_id = auth.uid()
  ));
