ALTER TABLE public.client_nutrition_preps
  ADD COLUMN IF NOT EXISTS scenario_key TEXT,
  ADD COLUMN IF NOT EXISTS scenario_label TEXT;

UPDATE public.client_nutrition_preps
SET
  scenario_key = COALESCE(NULLIF(TRIM(scenario_key), ''), 'default'),
  scenario_label = COALESCE(NULLIF(TRIM(scenario_label), ''), 'Aujourd''hui')
WHERE scenario_key IS NULL
   OR TRIM(scenario_key) = ''
   OR scenario_label IS NULL
   OR TRIM(scenario_label) = '';

ALTER TABLE public.client_nutrition_preps
  ALTER COLUMN scenario_key SET DEFAULT 'default',
  ALTER COLUMN scenario_label SET DEFAULT 'Aujourd''hui';

ALTER TABLE public.client_nutrition_preps
  ALTER COLUMN scenario_key SET NOT NULL,
  ALTER COLUMN scenario_label SET NOT NULL;

CREATE INDEX IF NOT EXISTS client_nutrition_preps_scenario_idx
  ON public.client_nutrition_preps(client_id, physiological_date, status, scenario_key, meal_slot, variant_group_id, created_at DESC);
