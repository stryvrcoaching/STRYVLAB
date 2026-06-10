-- Add is_unilateral to coach_program_template_exercises
-- Aligns with program_exercises.is_unilateral (added 2026-04-14)
-- The existing 'unilateral' column is a biomech catalog flag — is_unilateral is the client UX flag

ALTER TABLE public.coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS is_unilateral boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.coach_program_template_exercises.is_unilateral IS
  'True = exercice unilatéral → SessionLogger affiche deux sous-sets G et D par série';
