-- ============================================================
-- Multi-day sessions: day_of_week int -> days_of_week int[]
-- A session can now be scheduled on multiple days of the week
-- (e.g., Pectoraux: Tuesday + Friday)
-- ============================================================

-- program_sessions
alter table public.program_sessions
  add column if not exists days_of_week int[] default '{}';

-- Migrate existing data: wrap single int in array
update public.program_sessions
  set days_of_week = array[day_of_week]
  where day_of_week is not null
    and (days_of_week is null or days_of_week = '{}');

-- coach_program_template_sessions
alter table public.coach_program_template_sessions
  add column if not exists days_of_week int[] default '{}';

update public.coach_program_template_sessions
  set days_of_week = array[day_of_week]
  where day_of_week is not null
    and (days_of_week is null or days_of_week = '{}');

-- Indexes for array containment queries (client home page: which sessions are today)
create index if not exists program_sessions_days_of_week_gin
  on public.program_sessions using gin (days_of_week);

create index if not exists coach_program_template_sessions_days_of_week_gin
  on public.coach_program_template_sessions using gin (days_of_week);
