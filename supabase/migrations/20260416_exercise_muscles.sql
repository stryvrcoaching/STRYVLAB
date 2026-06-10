-- ============================================================
-- EXERCISE MUSCLES — primary_muscles + secondary_muscles
--
-- Ajout sur coach_program_template_exercises (templates coach)
-- et program_exercises (programmes assignés aux clients)
-- ============================================================

-- 1. Templates
alter table public.coach_program_template_exercises
  add column if not exists primary_muscles   text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}';

comment on column public.coach_program_template_exercises.primary_muscles is
  'Muscles principaux sollicités. Valeurs : chest | shoulders | biceps | triceps | abs | quads | hamstrings | glutes | calves | back_upper | back_lower | traps';

comment on column public.coach_program_template_exercises.secondary_muscles is
  'Muscles secondaires sollicités (même enum que primary_muscles)';

-- 2. Programmes assignés
alter table public.program_exercises
  add column if not exists primary_muscles   text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}';

comment on column public.program_exercises.primary_muscles is
  'Copié depuis coach_program_template_exercises à l''assignation. Même enum.';

comment on column public.program_exercises.secondary_muscles is
  'Copié depuis coach_program_template_exercises à l''assignation. Même enum.';
