ALTER TABLE public.client_nutrition_preps
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'client_planned',
  ADD COLUMN IF NOT EXISTS source_protocol_id UUID REFERENCES public.nutrition_protocols(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_day_position INTEGER,
  ADD COLUMN IF NOT EXISTS source_meal_id TEXT,
  ADD COLUMN IF NOT EXISTS source_snapshot JSONB;

ALTER TABLE public.client_nutrition_preps
  DROP CONSTRAINT IF EXISTS client_nutrition_preps_source_type_check;

ALTER TABLE public.client_nutrition_preps
  ADD CONSTRAINT client_nutrition_preps_source_type_check
  CHECK (source_type IN ('client_planned', 'coach_plan'));

CREATE UNIQUE INDEX IF NOT EXISTS client_nutrition_preps_coach_plan_source_unique
  ON public.client_nutrition_preps(
    client_id,
    physiological_date,
    source_protocol_id,
    source_day_position,
    source_meal_id
  )
  WHERE source_type = 'coach_plan'
    AND status <> 'cancelled'
    AND source_protocol_id IS NOT NULL
    AND source_day_position IS NOT NULL
    AND source_meal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_nutrition_preps_coach_plan_lookup
  ON public.client_nutrition_preps(
    client_id,
    physiological_date,
    source_type,
    source_protocol_id,
    source_day_position,
    source_meal_id,
    status
  );
