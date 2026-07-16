-- Migration: Add target_hr_zone to exercises and template exercises

ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS target_hr_zone text;
ALTER TABLE public.coach_program_template_exercises ADD COLUMN IF NOT EXISTS target_hr_zone text;

COMMENT ON COLUMN public.program_exercises.target_hr_zone IS 'Recommended Heart Rate zone for the cardio exercise (e.g. Zone 2)';
COMMENT ON COLUMN public.coach_program_template_exercises.target_hr_zone IS 'Recommended Heart Rate zone for the cardio exercise (e.g. Zone 2)';
