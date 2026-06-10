-- Add tempo columns to template/program exercises and tempo_used to set_logs
-- tempo: nullable text e.g. "3-1-2-0", "X-0-X-0". NULL = not configured, use auto-default.
-- tempo_used: logged at set time (computed default or coach-set value). Enables historical comparison.

ALTER TABLE public.coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS tempo text;

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS tempo text;

ALTER TABLE public.client_set_logs
  ADD COLUMN IF NOT EXISTS tempo_used text;
