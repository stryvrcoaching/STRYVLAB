ALTER TABLE public.coach_ai_settings_per_client
  ADD COLUMN IF NOT EXISTS ai_morning_routine_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_evening_routine_enabled boolean NOT NULL DEFAULT true;

UPDATE public.coach_ai_settings_per_client
SET
  ai_morning_routine_enabled = COALESCE(ai_morning_routine_enabled, true),
  ai_evening_routine_enabled = COALESCE(ai_evening_routine_enabled, true);
