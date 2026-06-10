ALTER TABLE public.nutrition_meals
  ADD COLUMN IF NOT EXISTS meal_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'nutrition_meals_meal_source_check'
  ) THEN
    ALTER TABLE public.nutrition_meals
      ADD CONSTRAINT nutrition_meals_meal_source_check
      CHECK (meal_source IN ('manual', 'voice', 'text', 'composer', 'auto_adjusted', 'flash_estimate'));
  END IF;
END
$$;

UPDATE public.nutrition_meals
SET meal_source = COALESCE(meal_source, 'composer')
WHERE meal_source IS NULL;
