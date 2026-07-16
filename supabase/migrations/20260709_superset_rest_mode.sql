alter table public.coach_program_template_exercises
  add column if not exists superset_rest_mode text;

alter table public.program_exercises
  add column if not exists superset_rest_mode text;

update public.coach_program_template_exercises
set superset_rest_mode = 'after_round'
where group_id is not null
  and coalesce(rest_sec, 0) > 0
  and superset_rest_mode is null;

update public.program_exercises
set superset_rest_mode = 'after_round'
where group_id is not null
  and coalesce(rest_sec, 0) > 0
  and superset_rest_mode is null;

alter table public.coach_program_template_exercises
  drop constraint if exists coach_program_template_exercises_superset_rest_mode_check;

alter table public.coach_program_template_exercises
  add constraint coach_program_template_exercises_superset_rest_mode_check
  check (superset_rest_mode in ('after_exercise', 'after_round') or superset_rest_mode is null);

alter table public.program_exercises
  drop constraint if exists program_exercises_superset_rest_mode_check;

alter table public.program_exercises
  add constraint program_exercises_superset_rest_mode_check
  check (superset_rest_mode in ('after_exercise', 'after_round') or superset_rest_mode is null);
