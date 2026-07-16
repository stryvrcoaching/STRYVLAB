-- Extend manual nutrition data so the parameter sheet can persist
-- training and lifestyle overrides per client / per bilan.

alter table public.coach_client_nutrition_manual_data
  add column if not exists weekly_frequency integer;

alter table public.coach_client_nutrition_manual_data
  add column if not exists session_duration_min integer;

alter table public.coach_client_nutrition_manual_data
  add column if not exists training_calories_weekly numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists cardio_frequency numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists cardio_duration_min numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists sleep_duration_h numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists sleep_quality numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists stress_level numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists caffeine_daily_mg numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists alcohol_weekly numeric;

alter table public.coach_client_nutrition_manual_data
  add column if not exists work_hours_per_week numeric;
