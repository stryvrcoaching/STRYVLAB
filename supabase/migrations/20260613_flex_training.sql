-- ============================================================
-- FLEX TRAINING — séances libres côté client
-- ============================================================

-- ------------------------------------------------------------
-- 1. flex_workout_sessions
-- ------------------------------------------------------------
create table if not exists public.flex_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid references auth.users(id) on delete set null,
  "type" text not null default 'free',
  relation_to_planned_workout text,
  source_program_id uuid references public.programs(id) on delete set null,
  source_workout_id uuid references public.program_sessions(id) on delete set null,
  replaced_workout_id uuid references public.program_sessions(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  perceived_difficulty int,
  global_rir int,
  notes text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flex_workout_sessions
  add constraint flex_workout_sessions_type_check
    check ("type" in ('free', 'bonus', 'replacement', 'modified_planned'));

alter table public.flex_workout_sessions
  add constraint flex_workout_sessions_relation_check
    check (relation_to_planned_workout in ('replace', 'bonus', 'unknown'));

alter table public.flex_workout_sessions
  add constraint flex_workout_sessions_perceived_difficulty_check
    check (perceived_difficulty is null or perceived_difficulty between 1 and 10);

alter table public.flex_workout_sessions
  add constraint flex_workout_sessions_global_rir_check
    check (global_rir is null or global_rir between 0 and 10);

alter table public.flex_workout_sessions
  add constraint flex_workout_sessions_status_check
    check (status in ('draft', 'active', 'completed', 'cancelled'));

create index if not exists flex_workout_sessions_client_id_idx
  on public.flex_workout_sessions (client_id, started_at desc);

create index if not exists flex_workout_sessions_coach_id_idx
  on public.flex_workout_sessions (coach_id, started_at desc);

alter table public.flex_workout_sessions enable row level security;

drop policy if exists "flex_workout_sessions_client_own" on public.flex_workout_sessions;
create policy "flex_workout_sessions_client_own"
  on public.flex_workout_sessions for all
  using (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.flex_workout_sessions.client_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.flex_workout_sessions.client_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "flex_workout_sessions_coach_select_owned" on public.flex_workout_sessions;
create policy "flex_workout_sessions_coach_select_owned"
  on public.flex_workout_sessions for select
  using (
    exists (
      select 1
      from public.coach_clients c
      where c.id = public.flex_workout_sessions.client_id
        and c.coach_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2. flex_workout_exercises
-- ------------------------------------------------------------
create table if not exists public.flex_workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.flex_workout_sessions(id) on delete cascade,
  exercise_id text,
  custom_exercise_name text,
  muscle_groups text[] not null default '{}',
  order_index int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.flex_workout_exercises
  add constraint flex_workout_exercises_custom_name_check
    check (exercise_id is not null or custom_exercise_name is not null);

create index if not exists flex_workout_exercises_session_id_idx
  on public.flex_workout_exercises (session_id, order_index asc);

alter table public.flex_workout_exercises enable row level security;

drop policy if exists "flex_workout_exercises_client_own" on public.flex_workout_exercises;
create policy "flex_workout_exercises_client_own"
  on public.flex_workout_exercises for all
  using (
    exists (
      select 1
      from public.flex_workout_sessions s
      join public.coach_clients c on c.id = s.client_id
      where s.id = public.flex_workout_exercises.session_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.flex_workout_sessions s
      join public.coach_clients c on c.id = s.client_id
      where s.id = public.flex_workout_exercises.session_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "flex_workout_exercises_coach_select_owned" on public.flex_workout_exercises;
create policy "flex_workout_exercises_coach_select_owned"
  on public.flex_workout_exercises for select
  using (
    exists (
      select 1
      from public.flex_workout_sessions s
      join public.coach_clients c on c.id = s.client_id
      where s.id = public.flex_workout_exercises.session_id
        and c.coach_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. flex_workout_sets
-- ------------------------------------------------------------
create table if not exists public.flex_workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references public.flex_workout_exercises(id) on delete cascade,
  set_number int not null,
  weight numeric(6,2),
  reps int,
  rir int,
  rpe int,
  rest_seconds int,
  tempo text,
  completed boolean not null default true,
  pain_flag boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flex_workout_sets_unique_per_exercise unique (exercise_log_id, set_number)
);

alter table public.flex_workout_sets
  add constraint flex_workout_sets_rir_check
    check (rir is null or rir between 0 and 10);

alter table public.flex_workout_sets
  add constraint flex_workout_sets_rpe_check
    check (rpe is null or rpe between 1 and 10);

create index if not exists flex_workout_sets_exercise_log_id_idx
  on public.flex_workout_sets (exercise_log_id, set_number asc);

alter table public.flex_workout_sets enable row level security;

drop policy if exists "flex_workout_sets_client_own" on public.flex_workout_sets;
create policy "flex_workout_sets_client_own"
  on public.flex_workout_sets for all
  using (
    exists (
      select 1
      from public.flex_workout_exercises e
      join public.flex_workout_sessions s on s.id = e.session_id
      join public.coach_clients c on c.id = s.client_id
      where e.id = public.flex_workout_sets.exercise_log_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.flex_workout_exercises e
      join public.flex_workout_sessions s on s.id = e.session_id
      join public.coach_clients c on c.id = s.client_id
      where e.id = public.flex_workout_sets.exercise_log_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "flex_workout_sets_coach_select_owned" on public.flex_workout_sets;
create policy "flex_workout_sets_coach_select_owned"
  on public.flex_workout_sets for select
  using (
    exists (
      select 1
      from public.flex_workout_exercises e
      join public.flex_workout_sessions s on s.id = e.session_id
      join public.coach_clients c on c.id = s.client_id
      where e.id = public.flex_workout_sets.exercise_log_id
        and c.coach_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Legacy mirrors for history compatibility
-- ------------------------------------------------------------
alter table public.client_session_logs
  add column if not exists session_kind text not null default 'planned';

alter table public.client_session_logs
  add constraint client_session_logs_session_kind_check
    check (session_kind in ('planned', 'flex'));

alter table public.client_session_logs
  add column if not exists flex_session_id uuid references public.flex_workout_sessions(id) on delete set null;

alter table public.client_session_logs
  add column if not exists relation_to_planned_workout text;

alter table public.client_session_logs
  add constraint client_session_logs_relation_check
    check (relation_to_planned_workout is null or relation_to_planned_workout in ('replace', 'bonus', 'unknown'));

alter table public.client_session_logs
  add column if not exists source_program_id uuid references public.programs(id) on delete set null;

alter table public.client_session_logs
  add column if not exists source_workout_id uuid references public.program_sessions(id) on delete set null;

alter table public.client_session_logs
  add column if not exists replaced_workout_id uuid references public.program_sessions(id) on delete set null;

alter table public.client_session_logs
  add column if not exists coach_id uuid references auth.users(id) on delete set null;

alter table public.client_session_logs
  add column if not exists perceived_difficulty int;

alter table public.client_session_logs
  add constraint client_session_logs_perceived_difficulty_check
    check (perceived_difficulty is null or perceived_difficulty between 1 and 10);

alter table public.client_session_logs
  add column if not exists global_rir int;

alter table public.client_session_logs
  add constraint client_session_logs_global_rir_check
    check (global_rir is null or global_rir between 0 and 10);

alter table public.client_set_logs
  add column if not exists flex_exercise_log_id uuid references public.flex_workout_exercises(id) on delete set null;

alter table public.client_set_logs
  add column if not exists pain_flag boolean not null default false;

drop trigger if exists flex_workout_sessions_updated_at on public.flex_workout_sessions;
create trigger flex_workout_sessions_updated_at
  before update on public.flex_workout_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists flex_workout_exercises_updated_at on public.flex_workout_exercises;
create trigger flex_workout_exercises_updated_at
  before update on public.flex_workout_exercises
  for each row execute function public.set_updated_at();

drop trigger if exists flex_workout_sets_updated_at on public.flex_workout_sets;
create trigger flex_workout_sets_updated_at
  before update on public.flex_workout_sets
  for each row execute function public.set_updated_at();

select 1;
