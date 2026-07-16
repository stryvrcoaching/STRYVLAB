CREATE TABLE IF NOT EXISTS public.client_photo_meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  physiological_date DATE NOT NULL,
  meal_id UUID NULL REFERENCES public.nutrition_meals(id) ON DELETE SET NULL,
  meal_type TEXT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  source_context TEXT NOT NULL DEFAULT 'plate_home_v1',
  status TEXT NOT NULL DEFAULT 'capturing'
    CHECK (status IN ('capturing', 'analyzing', 'clarifying', 'ready_to_log', 'logged', 'refined', 'failed')),
  manual_weight_g NUMERIC NULL,
  scale_weight_g NUMERIC NULL,
  scale_weight_confidence NUMERIC NULL,
  analysis_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  clarification_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  leftovers_weight_g NUMERIC NULL,
  leftovers_applied_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_photo_meal_log_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_meal_log_id UUID NOT NULL REFERENCES public.client_photo_meal_logs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('context', 'top', 'side', 'scale_zoom', 'leftovers')),
  storage_path TEXT NOT NULL,
  signed_url TEXT NULL,
  vision_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_meals
  DROP CONSTRAINT IF EXISTS nutrition_meals_meal_source_check;

ALTER TABLE public.nutrition_meals
  ADD CONSTRAINT nutrition_meals_meal_source_check
  CHECK (meal_source IN ('manual', 'voice', 'text', 'composer', 'auto_adjusted', 'flash_estimate', 'photo_guided'));

ALTER TABLE public.nutrition_entries
  DROP CONSTRAINT IF EXISTS nutrition_entries_input_mode_check;

ALTER TABLE public.nutrition_entries
  ADD CONSTRAINT nutrition_entries_input_mode_check
  CHECK (input_mode IN ('composer', 'portion', 'photo_ai', 'voice', 'photo_guided'));
