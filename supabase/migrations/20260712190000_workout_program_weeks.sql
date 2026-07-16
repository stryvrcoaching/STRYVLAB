-- Explicit multi-week workout structures.
-- Existing programmes remain legacy single-week schedules until an intentional
-- conversion attaches their sessions to program_weeks rows.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.programs
  add column if not exists completion_behavior text not null default 'repeat'
    check (completion_behavior in ('repeat', 'hold_last', 'stop'));

alter table public.coach_program_templates
  add column if not exists completion_behavior text not null default 'repeat'
    check (completion_behavior in ('repeat', 'hold_last', 'stop'));

create table if not exists public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  position int not null check (position between 0 and 51),
  label text not null,
  week_type text not null default 'base'
    check (week_type in ('base', 'build', 'overload', 'deload', 'peak', 'custom')),
  source_week_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, position),
  unique (id, program_id),
  constraint program_weeks_source_fk
    foreign key (source_week_id)
    references public.program_weeks(id)
    on delete set null
);

create index if not exists program_weeks_program_id_idx
  on public.program_weeks(program_id, position);

drop trigger if exists program_weeks_updated_at on public.program_weeks;
create trigger program_weeks_updated_at
  before update on public.program_weeks
  for each row execute function public.set_updated_at();

alter table public.program_weeks enable row level security;

drop policy if exists "coach_manages_program_weeks" on public.program_weeks;
create policy "coach_manages_program_weeks"
  on public.program_weeks for all
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_weeks.program_id
        and p.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.programs p
      where p.id = program_weeks.program_id
        and p.coach_id = auth.uid()
    )
  );

drop policy if exists "client_reads_own_program_weeks" on public.program_weeks;
create policy "client_reads_own_program_weeks"
  on public.program_weeks for select
  using (
    exists (
      select 1
      from public.programs p
      join public.coach_clients c on c.id = p.client_id
      where p.id = program_weeks.program_id
        and c.user_id = auth.uid()
    )
  );

create table if not exists public.coach_program_template_weeks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.coach_program_templates(id) on delete cascade,
  position int not null check (position between 0 and 51),
  label text not null,
  week_type text not null default 'base'
    check (week_type in ('base', 'build', 'overload', 'deload', 'peak', 'custom')),
  source_week_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, position),
  unique (id, template_id),
  constraint coach_program_template_weeks_source_fk
    foreign key (source_week_id)
    references public.coach_program_template_weeks(id)
    on delete set null
);

create index if not exists coach_program_template_weeks_template_id_idx
  on public.coach_program_template_weeks(template_id, position);

drop trigger if exists coach_program_template_weeks_updated_at on public.coach_program_template_weeks;
create trigger coach_program_template_weeks_updated_at
  before update on public.coach_program_template_weeks
  for each row execute function public.set_updated_at();

alter table public.coach_program_template_weeks enable row level security;

drop policy if exists "coach_manages_template_weeks" on public.coach_program_template_weeks;
create policy "coach_manages_template_weeks"
  on public.coach_program_template_weeks for all
  using (
    exists (
      select 1
      from public.coach_program_templates t
      where t.id = coach_program_template_weeks.template_id
        and t.coach_id = auth.uid()
        and t.is_system = false
    )
  )
  with check (
    exists (
      select 1
      from public.coach_program_templates t
      where t.id = coach_program_template_weeks.template_id
        and t.coach_id = auth.uid()
        and t.is_system = false
    )
  );

alter table public.program_sessions
  add column if not exists program_week_id uuid,
  add column if not exists lineage_id uuid not null default gen_random_uuid();

alter table public.program_sessions
  drop constraint if exists program_sessions_week_program_fk;

alter table public.program_sessions
  add constraint program_sessions_week_program_fk
  foreign key (program_week_id, program_id)
  references public.program_weeks(id, program_id)
  on delete cascade;

create index if not exists program_sessions_program_week_id_idx
  on public.program_sessions(program_week_id, position);

create index if not exists program_sessions_lineage_id_idx
  on public.program_sessions(lineage_id);

alter table public.program_exercises
  add column if not exists lineage_id uuid not null default gen_random_uuid();

create index if not exists program_exercises_lineage_id_idx
  on public.program_exercises(lineage_id);

alter table public.coach_program_template_sessions
  add column if not exists template_week_id uuid,
  add column if not exists lineage_id uuid not null default gen_random_uuid();

alter table public.coach_program_template_sessions
  drop constraint if exists coach_program_template_sessions_week_template_fk;

alter table public.coach_program_template_sessions
  add constraint coach_program_template_sessions_week_template_fk
  foreign key (template_week_id, template_id)
  references public.coach_program_template_weeks(id, template_id)
  on delete cascade;

create index if not exists coach_program_template_sessions_template_week_id_idx
  on public.coach_program_template_sessions(template_week_id, position);

create index if not exists coach_program_template_sessions_lineage_id_idx
  on public.coach_program_template_sessions(lineage_id);

alter table public.coach_program_template_exercises
  add column if not exists lineage_id uuid not null default gen_random_uuid();

create index if not exists coach_program_template_exercises_lineage_id_idx
  on public.coach_program_template_exercises(lineage_id);

alter table public.client_workout_program_assignments
  add column if not exists schedule_start_date date;

comment on column public.client_workout_program_assignments.schedule_start_date is
  'Client-local first day of programme week 1. Null falls back to started_at converted with the client timezone.';

alter table public.client_session_logs
  add column if not exists workout_assignment_id uuid
    references public.client_workout_program_assignments(id) on delete set null,
  add column if not exists program_week_id uuid
    references public.program_weeks(id) on delete set null,
  add column if not exists program_week_position int
    check (program_week_position is null or program_week_position between 0 and 51),
  add column if not exists program_cycle_iteration int
    check (program_cycle_iteration is null or program_cycle_iteration >= 0),
  add column if not exists prescription_snapshot jsonb;

create index if not exists client_session_logs_workout_assignment_id_idx
  on public.client_session_logs(workout_assignment_id);

create index if not exists client_session_logs_program_week_id_idx
  on public.client_session_logs(program_week_id);

comment on column public.programs.weeks is
  'Planned programme duration. Explicit editable microcycles are stored in program_weeks.';

comment on column public.program_sessions.program_week_id is
  'Null identifies a legacy repeated base-week session. Non-null identifies an explicit microcycle.';

comment on column public.client_session_logs.prescription_snapshot is
  'Immutable planned session and exercise prescription captured when execution starts.';

notify pgrst, 'reload schema';

commit;
