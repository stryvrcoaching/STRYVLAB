alter table public.flex_workout_exercises
  add column if not exists movement_pattern text,
  add column if not exists equipment text[] not null default '{}',
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists is_compound boolean,
  add column if not exists unilateral boolean not null default false,
  add column if not exists image_url text;

alter table public.flex_workout_sets
  add column if not exists side text not null default 'bilateral',
  add column if not exists set_type text not null default 'working';

alter table public.flex_workout_sets
  drop constraint if exists flex_workout_sets_unique_per_exercise;

alter table public.flex_workout_sets
  add constraint flex_workout_sets_unique_per_exercise_side
    unique (exercise_log_id, set_number, side);

alter table public.flex_workout_sets
  add constraint flex_workout_sets_side_check
    check (side in ('left', 'right', 'bilateral'));

alter table public.flex_workout_sets
  add constraint flex_workout_sets_set_type_check
    check (set_type in ('warmup', 'working', 'cooldown', 'dropset'));
