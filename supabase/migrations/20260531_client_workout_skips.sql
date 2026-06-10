CREATE TABLE IF NOT EXISTS client_workout_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  program_session_id uuid NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'skipped' CHECK (status IN ('skipped')),
  skip_reason_key text NOT NULL,
  skip_note text,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, program_session_id, scheduled_date)
);

CREATE INDEX IF NOT EXISTS client_workout_skips_client_date_idx
  ON client_workout_skips (client_id, scheduled_date DESC);

CREATE TABLE IF NOT EXISTS client_day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('off')),
  source text NOT NULL CHECK (source IN ('session_skip')),
  linked_program_session_id uuid REFERENCES program_sessions(id) ON DELETE SET NULL,
  linked_skip_id uuid REFERENCES client_workout_skips(id) ON DELETE SET NULL,
  UNIQUE (client_id, date, source)
);

CREATE INDEX IF NOT EXISTS client_day_overrides_client_date_idx
  ON client_day_overrides (client_id, date DESC);

ALTER TABLE coach_notifications
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

ALTER TABLE client_workout_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_day_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_workout_skips_client_select_own" ON client_workout_skips;
CREATE POLICY "client_workout_skips_client_select_own"
  ON client_workout_skips
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_workout_skips_client_insert_own" ON client_workout_skips;
CREATE POLICY "client_workout_skips_client_insert_own"
  ON client_workout_skips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_workout_skips_coach_select_owned" ON client_workout_skips;
CREATE POLICY "client_workout_skips_coach_select_owned"
  ON client_workout_skips
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_day_overrides_client_select_own" ON client_day_overrides;
CREATE POLICY "client_day_overrides_client_select_own"
  ON client_day_overrides
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_day_overrides_client_insert_own" ON client_day_overrides;
CREATE POLICY "client_day_overrides_client_insert_own"
  ON client_day_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_day_overrides_coach_select_owned" ON client_day_overrides;
CREATE POLICY "client_day_overrides_coach_select_owned"
  ON client_day_overrides
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );
