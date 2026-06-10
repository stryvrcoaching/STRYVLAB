-- nutrition_protocols
CREATE TABLE IF NOT EXISTS nutrition_protocols (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Protocole sans titre',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- nutrition_protocol_days
CREATE TABLE IF NOT EXISTS nutrition_protocol_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id      UUID NOT NULL REFERENCES nutrition_protocols(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Jour',
  position         INT  NOT NULL DEFAULT 0,
  calories         NUMERIC,
  protein_g        NUMERIC,
  carbs_g          NUMERIC,
  fat_g            NUMERIC,
  hydration_ml     INT,
  carb_cycle_type  TEXT CHECK (carb_cycle_type IN ('high', 'medium', 'low')),
  cycle_sync_phase TEXT CHECK (cycle_sync_phase IN ('follicular', 'ovulatory', 'luteal', 'menstrual')),
  recommendations  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_nutrition_protocols_updated_at
  BEFORE UPDATE ON nutrition_protocols
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nutrition_protocols_client_id ON nutrition_protocols(client_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_protocols_status ON nutrition_protocols(client_id, status);
CREATE INDEX IF NOT EXISTS idx_nutrition_protocol_days_protocol_id ON nutrition_protocol_days(protocol_id, position);

-- RLS
ALTER TABLE nutrition_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_protocol_days ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their own clients' protocols
CREATE POLICY "coach_nutrition_protocols" ON nutrition_protocols
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client: SELECT only on shared protocols
CREATE POLICY "client_nutrition_protocols_read" ON nutrition_protocols
  FOR SELECT USING (
    status = 'shared' AND
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Coach: full access to days (via protocol ownership)
CREATE POLICY "coach_nutrition_protocol_days" ON nutrition_protocol_days
  FOR ALL USING (
    protocol_id IN (
      SELECT id FROM nutrition_protocols
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE coach_id = auth.uid()
      )
    )
  );

-- Client: SELECT only on shared protocol days
CREATE POLICY "client_nutrition_protocol_days_read" ON nutrition_protocol_days
  FOR SELECT USING (
    protocol_id IN (
      SELECT id FROM nutrition_protocols
      WHERE status = 'shared' AND
        client_id IN (
          SELECT id FROM coach_clients WHERE user_id = auth.uid()
        )
    )
  );
