ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS set_prescriptions jsonb;

ALTER TABLE public.coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS set_prescriptions jsonb;

COMMENT ON COLUMN public.program_exercises.set_prescriptions IS
  'Prescription détaillée par série: reps, repos, RIR, tempo et type de série.';

COMMENT ON COLUMN public.coach_program_template_exercises.set_prescriptions IS
  'Prescription détaillée par série: reps, repos, RIR, tempo et type de série.';
