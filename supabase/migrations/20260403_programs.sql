-- ============================================================
-- PROGRAMS — Programme d'entraînement coach manuel
-- ============================================================

-- 1. programs — un programme par client (actif ou archivé)
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  client_id   uuid not null references public.coach_clients(id) on delete cascade,
  name        text not null,
  description text,
  weeks       int not null default 4 check (weeks >= 1 and weeks <= 52),
  status      text not null default 'active'
              check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists programs_coach_id_idx on public.programs(coach_id);
create index if not exists programs_client_id_idx on public.programs(client_id);

drop trigger if exists programs_updated_at on public.programs;
create trigger programs_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

alter table public.programs enable row level security;

create policy "coach_own_programs"
  on public.programs for all
  using (auth.uid() = coach_id);

create policy "client_sees_own_programs"
  on public.programs for select
  using (
    exists (
      select 1 from public.coach_clients c
      where c.id = programs.client_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. program_sessions — séances d'un programme (ex: Lundi, Mercredi)
-- ============================================================
create table if not exists public.program_sessions (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  name        text not null,               -- ex: "Séance A — Push", "Full Body"
  day_of_week int check (day_of_week between 1 and 7),  -- 1=Lundi…7=Dimanche, null=non planifié
  position    int not null default 0,      -- ordre d'affichage
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists program_sessions_program_id_idx on public.program_sessions(program_id);

alter table public.program_sessions enable row level security;

create policy "coach_own_sessions"
  on public.program_sessions for all
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_sessions.program_id and p.coach_id = auth.uid()
    )
  );

create policy "client_sees_own_sessions"
  on public.program_sessions for select
  using (
    exists (
      select 1 from public.programs p
      join public.coach_clients c on c.id = p.client_id
      where p.id = program_sessions.program_id and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. program_exercises — exercices d'une séance
-- ============================================================
create table if not exists public.program_exercises (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.program_sessions(id) on delete cascade,
  name        text not null,               -- nom libre (pas lié au catalogue pour l'instant)
  sets        int not null default 3 check (sets >= 1),
  reps        text not null default '8-12', -- texte libre : "8-12", "10", "AMRAP"
  rest_sec    int default 90,
  tempo       text,                        -- ex: "3-1-2-0"
  rir         int check (rir between 0 and 5),
  notes       text,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists program_exercises_session_id_idx on public.program_exercises(session_id);

alter table public.program_exercises enable row level security;

create policy "coach_own_exercises"
  on public.program_exercises for all
  using (
    exists (
      select 1 from public.program_sessions s
      join public.programs p on p.id = s.program_id
      where s.id = program_exercises.session_id and p.coach_id = auth.uid()
    )
  );

create policy "client_sees_own_exercises"
  on public.program_exercises for select
  using (
    exists (
      select 1 from public.program_sessions s
      join public.programs p on p.id = s.program_id
      join public.coach_clients c on c.id = p.client_id
      where s.id = program_exercises.session_id and c.user_id = auth.uid()
    )
  );
