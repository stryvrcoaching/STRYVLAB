-- Notes personnelles persistantes par exercice et commentaires ponctuels au coach.

create table if not exists public.client_exercise_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  exercise_key text not null,
  exercise_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, exercise_key)
);

create index if not exists client_exercise_notes_client_updated_idx
  on public.client_exercise_notes (client_id, updated_at desc);

create table if not exists public.client_session_exercise_comments (
  id uuid primary key default gen_random_uuid(),
  session_log_id uuid not null references public.client_session_logs(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  program_exercise_id uuid references public.program_exercises(id) on delete set null,
  exercise_key text not null,
  exercise_name text not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_log_id, exercise_key)
);

create index if not exists client_session_exercise_comments_log_idx
  on public.client_session_exercise_comments (session_log_id, created_at);

alter table public.client_exercise_notes enable row level security;
alter table public.client_session_exercise_comments enable row level security;

create policy "client_manages_own_exercise_notes"
  on public.client_exercise_notes for all to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = client_exercise_notes.client_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.coach_clients c
    where c.id = client_exercise_notes.client_id and c.user_id = auth.uid()
  ));

create policy "coach_reads_client_exercise_notes"
  on public.client_exercise_notes for select to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = client_exercise_notes.client_id and c.coach_id = auth.uid()
  ));

create policy "client_manages_own_session_exercise_comments"
  on public.client_session_exercise_comments for all to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = client_session_exercise_comments.client_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.coach_clients c
    where c.id = client_session_exercise_comments.client_id and c.user_id = auth.uid()
  ));

create policy "coach_reads_client_session_exercise_comments"
  on public.client_session_exercise_comments for select to authenticated
  using (exists (
    select 1 from public.coach_clients c
    where c.id = client_session_exercise_comments.client_id and c.coach_id = auth.uid()
  ));

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column')
    and not exists (select 1 from pg_trigger where tgname = 'client_exercise_notes_updated_at') then
    create trigger client_exercise_notes_updated_at
      before update on public.client_exercise_notes
      for each row execute function update_updated_at_column();
  end if;
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column')
    and not exists (select 1 from pg_trigger where tgname = 'client_session_exercise_comments_updated_at') then
    create trigger client_session_exercise_comments_updated_at
      before update on public.client_session_exercise_comments
      for each row execute function update_updated_at_column();
  end if;
end $$;
