-- Persist explicit provenance for coach-entered body composition data
-- so estimated values remain distinct from measured values across reloads.

alter table public.coach_client_nutrition_manual_data
  add column if not exists body_fat_source text
    check (body_fat_source in ('measured', 'estimated'));

alter table public.coach_client_nutrition_manual_data
  add column if not exists body_fat_source_method text;

alter table public.coach_client_nutrition_manual_data
  add column if not exists lean_mass_source text
    check (lean_mass_source in ('measured', 'estimated'));

alter table public.coach_client_nutrition_manual_data
  add column if not exists lean_mass_source_method text;

alter table public.coach_client_nutrition_manual_data
  add column if not exists muscle_mass_source text
    check (muscle_mass_source in ('measured', 'estimated'));

alter table public.coach_client_nutrition_manual_data
  add column if not exists muscle_mass_source_method text;
