CREATE TABLE IF NOT EXISTS nutrition_smoothing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_date date NOT NULL,
  source_target_kcal integer NOT NULL,
  source_consumed_kcal integer NOT NULL,
  threshold_kcal integer NOT NULL DEFAULT 50 CHECK (threshold_kcal >= 0),
  raw_delta_kcal integer NOT NULL,
  smoothable_delta_kcal integer NOT NULL,
  direction text NOT NULL CHECK (direction IN ('surplus', 'deficit')),
  duration_days integer NOT NULL CHECK (duration_days > 0),
  strategy text NOT NULL CHECK (strategy IN ('recommended', 'manual')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'replaced')),
  created_by text NOT NULL DEFAULT 'client'
    CHECK (created_by IN ('client', 'coach')),
  client_decision text
    CHECK (client_decision IN ('confirmed', 'modified', 'ignored')),
  replaced_by_plan_id uuid REFERENCES nutrition_smoothing_plans(id) ON DELETE SET NULL,
  coach_note text,
  coach_note_updated_at timestamptz,
  coach_last_action text
    CHECK (coach_last_action IN ('modified', 'cancelled', 'noted'))
);

CREATE TABLE IF NOT EXISTS nutrition_smoothing_plan_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  plan_id uuid NOT NULL REFERENCES nutrition_smoothing_plans(id) ON DELETE CASCADE,
  date date NOT NULL,
  sequence_index integer NOT NULL CHECK (sequence_index >= 0),
  resolved_bucket text NOT NULL CHECK (resolved_bucket IN ('protected_day', 'neutral_day', 'absorbent_day')),
  source_day_label text,
  day_weight numeric(8,4) NOT NULL CHECK (day_weight > 0),
  base_target_kcal integer NOT NULL,
  cycle_synced_target_kcal integer NOT NULL,
  kcal_delta integer NOT NULL,
  protein_delta_g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_delta_g numeric(8,2) NOT NULL DEFAULT 0,
  fat_delta_g numeric(8,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'skipped', 'overridden')),
  UNIQUE (plan_id, date)
);

CREATE INDEX IF NOT EXISTS nutrition_smoothing_plans_client_status_idx
  ON nutrition_smoothing_plans (client_id, status, source_date DESC);

CREATE INDEX IF NOT EXISTS nutrition_smoothing_plans_coach_status_idx
  ON nutrition_smoothing_plans (coach_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS nutrition_smoothing_plan_days_date_idx
  ON nutrition_smoothing_plan_days (date DESC);

CREATE INDEX IF NOT EXISTS nutrition_smoothing_plan_days_plan_date_idx
  ON nutrition_smoothing_plan_days (plan_id, date);

CREATE OR REPLACE TRIGGER set_nutrition_smoothing_plans_updated_at
  BEFORE UPDATE ON nutrition_smoothing_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER set_nutrition_smoothing_plan_days_updated_at
  BEFORE UPDATE ON nutrition_smoothing_plan_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE nutrition_smoothing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_smoothing_plan_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutrition_smoothing_plans_client_select_own" ON nutrition_smoothing_plans;
CREATE POLICY "nutrition_smoothing_plans_client_select_own"
  ON nutrition_smoothing_plans
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plans_client_insert_own" ON nutrition_smoothing_plans;
CREATE POLICY "nutrition_smoothing_plans_client_insert_own"
  ON nutrition_smoothing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plans_client_update_own" ON nutrition_smoothing_plans;
CREATE POLICY "nutrition_smoothing_plans_client_update_own"
  ON nutrition_smoothing_plans
  FOR UPDATE
  TO authenticated
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

DROP POLICY IF EXISTS "nutrition_smoothing_plans_coach_crud_owned" ON nutrition_smoothing_plans;
CREATE POLICY "nutrition_smoothing_plans_coach_crud_owned"
  ON nutrition_smoothing_plans
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plan_days_client_select_own" ON nutrition_smoothing_plan_days;
CREATE POLICY "nutrition_smoothing_plan_days_client_select_own"
  ON nutrition_smoothing_plan_days
  FOR SELECT
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plan_days_client_insert_own" ON nutrition_smoothing_plan_days;
CREATE POLICY "nutrition_smoothing_plan_days_client_insert_own"
  ON nutrition_smoothing_plan_days
  FOR INSERT
  TO authenticated
  WITH CHECK (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plan_days_client_update_own" ON nutrition_smoothing_plan_days;
CREATE POLICY "nutrition_smoothing_plan_days_client_update_own"
  ON nutrition_smoothing_plan_days
  FOR UPDATE
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "nutrition_smoothing_plan_days_coach_crud_owned" ON nutrition_smoothing_plan_days;
CREATE POLICY "nutrition_smoothing_plan_days_coach_crud_owned"
  ON nutrition_smoothing_plan_days
  FOR ALL
  TO authenticated
  USING (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE coach_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT id FROM nutrition_smoothing_plans
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE coach_id = auth.uid()
      )
    )
  );
