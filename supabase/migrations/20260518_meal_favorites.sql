-- ============================================================
-- Migration: client_meal_favorites
-- Meal favorites + quick-log for STRYVR client app
-- 2026-05-18
-- ============================================================

CREATE TABLE IF NOT EXISTS client_meal_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entries JSONB NOT NULL DEFAULT '[]',
  -- Structure: [{food_item_id, name_fr, quantity_g, calories_kcal, protein_g, carbs_g, fat_g}]
  total_calories DECIMAL(8,1),
  total_protein_g DECIMAL(6,1),
  total_carbs_g DECIMAL(6,1),
  total_fat_g DECIMAL(6,1),
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_meal_favorites_client
  ON client_meal_favorites(client_id, last_used_at DESC);

ALTER TABLE client_meal_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_meal_favorites_client" ON client_meal_favorites;
CREATE POLICY "client_meal_favorites_client" ON client_meal_favorites
  FOR ALL
  USING (client_id IN (
    SELECT id FROM coach_clients WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_client_meal_favorites_updated_at ON client_meal_favorites;
CREATE TRIGGER set_client_meal_favorites_updated_at
  BEFORE UPDATE ON client_meal_favorites
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
