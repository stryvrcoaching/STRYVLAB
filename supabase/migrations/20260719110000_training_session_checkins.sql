create table if not exists public.training_session_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  session_log_id uuid references public.client_session_logs(id) on delete cascade,
  flex_session_id uuid references public.flex_workout_sessions(id) on delete cascade,
  phase text not null check (phase in ('pre', 'post')),
  readiness smallint check (readiness between 1 and 10),
  exertion smallint check (exertion between 1 and 10),
  discomfort_level smallint not null default 0 check (discomfort_level between 0 and 3),
  discomfort_area text,
  created_at timestamptz not null default now(),
  check (
    (phase = 'pre' and readiness is not null and exertion is null)
    or (phase = 'post' and exertion is not null and readiness is null)
  ),
  check (num_nonnulls(session_log_id, flex_session_id) = 1)
);

create unique index if not exists training_session_checkins_planned_phase_idx
  on public.training_session_checkins (session_log_id, phase) where session_log_id is not null;
create unique index if not exists training_session_checkins_flex_phase_idx
  on public.training_session_checkins (flex_session_id, phase) where flex_session_id is not null;

alter table public.training_session_checkins enable row level security;

create policy "client_manages_own_training_checkins"
  on public.training_session_checkins for all to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = training_session_checkins.client_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.coach_clients c
    where c.id = training_session_checkins.client_id and c.user_id = auth.uid()
  ));

create policy "coach_reads_client_training_checkins"
  on public.training_session_checkins for select to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = training_session_checkins.client_id and c.coach_id = auth.uid()
  ));
