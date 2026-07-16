ALTER TABLE public.nutrition_protocol_days
ADD COLUMN IF NOT EXISTS meal_plan jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.nutrition_protocol_days
DROP CONSTRAINT IF EXISTS nutrition_protocol_days_meal_plan_is_array;

ALTER TABLE public.nutrition_protocol_days
ADD CONSTRAINT nutrition_protocol_days_meal_plan_is_array
CHECK (jsonb_typeof(meal_plan) = 'array');
