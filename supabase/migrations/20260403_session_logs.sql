-- ============================================================
-- SESSION LOGS — Logs de séances réalisées par le client
-- ============================================================

-- 1. client_session_logs — une séance réalisée
create table public.client_session_logs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.coach_clients(id) on delete cascade,
  program_session_id uuid references public.program_sessions(id) on delete set null,
  session_name    text not null,          -- copie du nom au moment du log
  logged_at       date not null default current_date,
  completed_at    timestamptz,            -- null = en cours
  duration_min    int,                    -- durée totale en minutes
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists client_session_logs_client_id_idx on public.client_session_logs(client_id);
create index if not exists client_session_logs_session_id_idx on public.client_session_logs(program_session_id);

alter table public.client_session_logs enable row level security;

create policy "client_own_session_logs"
  on public.client_session_logs for all
  using (
    exists (
      select 1 from public.coach_clients c
      where c.id = public.client_session_logs.client_id and c.user_id = auth.uid()
    )
  );

create policy "coach_sees_client_session_logs"
  on public.client_session_logs for select
  using (
    exists (
      select 1 from public.coach_clients c
      where c.id = public.client_session_logs.client_id and c.coach_id = auth.uid()
    )
  );

-- 2. client_set_logs — un set réalisé
create table public.client_set_logs (
  id              uuid primary key default gen_random_uuid(),
  session_log_id  uuid not null references public.client_session_logs(id) on delete cascade,
  exercise_id     uuid references public.program_exercises(id) on delete set null,
  exercise_name   text not null,          -- copie du nom
  set_number      int not null,
  planned_reps    text,                   -- copie de la prescription
  actual_reps     int,
  actual_weight_kg numeric(6,2),
  completed       boolean not null default false,
  rpe             int check (rpe between 1 and 10),
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists client_set_logs_session_log_id_idx on public.client_set_logs(session_log_id);

alter table public.client_set_logs enable row level security;

create policy "client_own_set_logs"
  on public.client_set_logs for all
  using (
    exists (
      select 1 from public.client_session_logs sl
      join public.coach_clients c on c.id = sl.client_id
      where sl.id = public.client_set_logs.session_log_id and c.user_id = auth.uid()
    )
  );

create policy "coach_sees_client_set_logs"
  on public.client_set_logs for select
  using (
    exists (
      select 1 from public.client_session_logs sl
      join public.coach_clients c on c.id = sl.client_id
      where sl.id = public.client_set_logs.session_log_id and c.coach_id = auth.uid()
    )
  );
