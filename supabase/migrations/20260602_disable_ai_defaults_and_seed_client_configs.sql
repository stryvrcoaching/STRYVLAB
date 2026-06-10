ALTER TABLE public.coach_ai_settings_per_client
  ALTER COLUMN ai_morning_routine_enabled SET DEFAULT false,
  ALTER COLUMN ai_evening_routine_enabled SET DEFAULT false;

INSERT INTO public.coach_ai_settings_per_client (
  coach_id,
  client_id,
  ai_llm_enabled,
  ai_morning_routine_enabled,
  ai_evening_routine_enabled,
  coaching_freedom
)
SELECT
  c.coach_id,
  c.id,
  false,
  false,
  false,
  'none'
FROM public.coach_clients c
LEFT JOIN public.coach_ai_settings_per_client s
  ON s.coach_id = c.coach_id
 AND s.client_id = c.id
WHERE s.id IS NULL;

INSERT INTO public.daily_checkin_configs (
  coach_id,
  client_id,
  is_active,
  days_of_week,
  moments
)
SELECT
  c.coach_id,
  c.id,
  false,
  ARRAY[]::integer[],
  '[]'::jsonb
FROM public.coach_clients c
LEFT JOIN public.daily_checkin_configs cfg
  ON cfg.coach_id = c.coach_id
 AND cfg.client_id = c.id
WHERE cfg.id IS NULL;
