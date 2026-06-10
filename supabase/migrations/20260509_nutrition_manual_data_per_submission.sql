-- Add assessment_submission_id to tie manual data to specific bilan
-- Allows same client to have different manual data per bilan

alter table public.coach_client_nutrition_manual_data
  add column assessment_submission_id uuid references public.assessment_submissions(id) on delete cascade;

-- Update constraint: allow multiple entries per client if submission_id differs
-- Remove old global unique constraint
alter table public.coach_client_nutrition_manual_data
  drop constraint coach_client_nutrition_manual_data_client_coach_unique;

-- New constraint: one entry per (client_id, coach_id, assessment_submission_id) tuple
-- Allows: entry without submission_id (global fallback), entries with submission_id (bilan-specific)
alter table public.coach_client_nutrition_manual_data
  add constraint coach_client_nutrition_manual_data_submission_unique
  unique (client_id, coach_id, assessment_submission_id);

-- Index for per-bilan lookups
create index if not exists coach_client_nutrition_manual_data_submission_idx
  on public.coach_client_nutrition_manual_data(client_id, assessment_submission_id);
