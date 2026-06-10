DO $$
BEGIN
  ALTER TABLE public.client_nutrition_preps
    ADD COLUMN IF NOT EXISTS meal_slot TEXT;

  ALTER TABLE public.client_nutrition_preps
    ADD COLUMN IF NOT EXISTS variant_group_id TEXT;

  ALTER TABLE public.client_nutrition_preps
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

  ALTER TABLE public.client_nutrition_preps
    DROP CONSTRAINT IF EXISTS client_nutrition_preps_meal_slot_check;

  ALTER TABLE public.client_nutrition_preps
    ADD CONSTRAINT client_nutrition_preps_meal_slot_check
    CHECK (meal_slot IS NULL OR meal_slot IN ('breakfast', 'lunch', 'dinner', 'snack'));

  UPDATE public.client_nutrition_preps
  SET meal_slot = COALESCE(meal_slot, meal_type, 'snack')
  WHERE meal_slot IS NULL;

  UPDATE public.client_nutrition_preps
  SET variant_group_id = COALESCE(variant_group_id, meal_slot, meal_type, 'snack')
  WHERE variant_group_id IS NULL;

  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id, physiological_date, COALESCE(variant_group_id, meal_slot, meal_type, 'snack')
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.client_nutrition_preps
    WHERE status = 'planned'
  )
  UPDATE public.client_nutrition_preps p
  SET is_active = CASE WHEN ranked.rn = 1 THEN true ELSE false END
  FROM ranked
  WHERE ranked.id = p.id
    AND p.is_active IS NULL;

  UPDATE public.client_nutrition_preps
  SET is_active = false
  WHERE is_active IS NULL;

  ALTER TABLE public.client_nutrition_preps
    ALTER COLUMN meal_slot SET NOT NULL;

  ALTER TABLE public.client_nutrition_preps
    ALTER COLUMN variant_group_id SET NOT NULL;

  ALTER TABLE public.client_nutrition_preps
    ALTER COLUMN is_active SET DEFAULT false;

  ALTER TABLE public.client_nutrition_preps
    ALTER COLUMN is_active SET NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_client_nutrition_preps_simulation
    ON public.client_nutrition_preps(client_id, physiological_date, status, meal_slot, variant_group_id, is_active, created_at DESC);
END $$;
