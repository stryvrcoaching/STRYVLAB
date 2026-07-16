-- Migration: Add execution_type to exercises and relax RIR constraints for RPE (cardio/HIIT)
-- Support time/distance and target RPE up to 10.

ALTER TABLE public.program_exercises DROP CONSTRAINT IF EXISTS program_exercises_rir_check;
ALTER TABLE public.program_exercises DROP CONSTRAINT IF EXISTS program_exercises_target_rir_check;
ALTER TABLE public.coach_program_template_exercises DROP CONSTRAINT IF EXISTS coach_program_template_exercises_rir_check;
ALTER TABLE public.coach_program_template_exercises DROP CONSTRAINT IF EXISTS coach_program_template_exercises_target_rir_check;

ALTER TABLE public.program_exercises ADD CONSTRAINT program_exercises_rir_check CHECK (rir BETWEEN 0 AND 10);
ALTER TABLE public.program_exercises ADD CONSTRAINT program_exercises_target_rir_check CHECK (target_rir BETWEEN 0 AND 10);
ALTER TABLE public.coach_program_template_exercises ADD CONSTRAINT coach_program_template_exercises_target_rir_check CHECK (target_rir BETWEEN 0 AND 10);

ALTER TABLE public.program_exercises ADD COLUMN IF NOT EXISTS execution_type text NOT NULL DEFAULT 'reps_rir' CHECK (execution_type IN ('reps_rir', 'time_rpe', 'distance_rpe'));
ALTER TABLE public.coach_program_template_exercises ADD COLUMN IF NOT EXISTS execution_type text NOT NULL DEFAULT 'reps_rir' CHECK (execution_type IN ('reps_rir', 'time_rpe', 'distance_rpe'));
