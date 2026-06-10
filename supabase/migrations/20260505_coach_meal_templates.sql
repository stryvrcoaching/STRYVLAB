-- Coach meal templates — repas types pré-configurés par le coach pour un client
-- Le client peut sélectionner un repas type pour auto-remplir les macros

CREATE TABLE IF NOT EXISTS coach_meal_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  calories_kcal integer,
  protein_g   numeric(6,1),
  carbs_g     numeric(6,1),
  fats_g      numeric(6,1),
  fiber_g     numeric(6,1),
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_meal_templates_client ON coach_meal_templates(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_meal_templates_coach  ON coach_meal_templates(coach_id);

-- Trigger updated_at
CREATE TRIGGER set_coach_meal_templates_updated_at
  BEFORE UPDATE ON coach_meal_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE coach_meal_templates ENABLE ROW LEVEL SECURITY;

-- Coach : full access sur ses propres templates
CREATE POLICY "coach_meal_templates_coach_all" ON coach_meal_templates
  FOR ALL
  USING (coach_id = auth.uid());

-- Client : lecture seule sur les templates qui lui sont assignés
CREATE POLICY "coach_meal_templates_client_select" ON coach_meal_templates
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );
