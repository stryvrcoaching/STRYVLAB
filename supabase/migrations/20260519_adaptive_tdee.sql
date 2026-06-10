-- supabase/migrations/20260519_adaptive_tdee.sql

-- 1. Add adaptive TDEE columns to nutrition_protocols
ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS tdee_adaptive integer,
  ADD COLUMN IF NOT EXISTS tdee_adaptive_at timestamptz,
  ADD COLUMN IF NOT EXISTS tdee_data_source text CHECK (tdee_data_source IN ('weight_delta', 'formula_proxy'));

-- 2. Create nutrition_tdee_history table
CREATE TABLE IF NOT EXISTS nutrition_tdee_history (
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid not null references nutrition_protocols(id) on delete cascade,
  client_id         uuid not null references coach_clients(id) on delete cascade,
  calculated_at     timestamptz not null default now(),
  tdee_formula      integer not null,
  tdee_adaptive     integer not null,
  delta_kcal        integer not null,
  weight_samples    integer not null,
  calories_source   text not null check (calories_source in ('logs', 'protocol')),
  avg_intake_kcal   integer not null,
  weight_delta_kg   numeric(5,2) not null,
  protocol_updated  boolean not null default false
);

CREATE INDEX IF NOT EXISTS idx_tdee_history_protocol
  ON nutrition_tdee_history (protocol_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdee_history_client
  ON nutrition_tdee_history (client_id, calculated_at DESC);

-- 3. RLS for nutrition_tdee_history
ALTER TABLE nutrition_tdee_history ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their clients' history
CREATE POLICY "coach_manage_tdee_history"
  ON nutrition_tdee_history
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client: read only their own history
CREATE POLICY "client_read_tdee_history"
  ON nutrition_tdee_history
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );
