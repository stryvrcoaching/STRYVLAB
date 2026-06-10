-- ============================================================
-- PROGRAM TEMPLATES — Catalogue de templates d'entraînement
-- ============================================================

create table public.coach_program_templates (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,

  -- Classification
  goal          text not null default 'hypertrophy'
                check (goal in ('hypertrophy', 'strength', 'endurance', 'fat_loss', 'recomp', 'maintenance', 'athletic')),
  level         text not null default 'intermediate'
                check (level in ('beginner', 'intermediate', 'advanced', 'elite')),
  frequency     int not null default 3 check (frequency between 1 and 7),  -- jours/semaine
  weeks         int not null default 8 check (weeks between 1 and 52),

  -- Tags musculaires (ex: ["Jambes","Dos","Pectoraux"])
  muscle_tags   text[] not null default '{}',

  -- Méta
  is_public     boolean not null default false,  -- partage entre coachs (futur)
  notes         text,                            -- notes internes coach
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists coach_program_templates_coach_id_idx on public.coach_program_templates(coach_id);
create index if not exists coach_program_templates_goal_idx on public.coach_program_templates(goal);
create index if not exists coach_program_templates_level_idx on public.coach_program_templates(level);

alter table public.coach_program_templates enable row level security;

create policy "coach_own_program_templates"
  on public.coach_program_templates for all
  using (auth.uid() = public.coach_program_templates.coach_id);

-- ============================================================
-- Template sessions
-- ============================================================
create table public.coach_program_template_sessions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.coach_program_templates(id) on delete cascade,
  name         text not null,
  day_of_week  int check (day_of_week between 1 and 7),
  position     int not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists coach_program_template_sessions_template_id_idx
  on public.coach_program_template_sessions(template_id);

alter table public.coach_program_template_sessions enable row level security;

create policy "coach_own_template_sessions"
  on public.coach_program_template_sessions for all
  using (
    exists (
      select 1 from public.coach_program_templates t
      where t.id = public.coach_program_template_sessions.template_id
        and t.coach_id = auth.uid()
    )
  );

-- ============================================================
-- Template exercises
-- ============================================================
create table public.coach_program_template_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.coach_program_template_sessions(id) on delete cascade,
  name         text not null,
  sets         int not null default 3 check (sets >= 1),
  reps         text not null default '8-12',
  rest_sec     int default 90,
  rir          int check (rir between 0 and 5),
  notes        text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists coach_program_template_exercises_session_id_idx
  on public.coach_program_template_exercises(session_id);

alter table public.coach_program_template_exercises enable row level security;

create policy "coach_own_template_exercises"
  on public.coach_program_template_exercises for all
  using (
    exists (
      select 1 from public.coach_program_template_sessions s
      join public.coach_program_templates t on t.id = s.template_id
      where s.id = public.coach_program_template_exercises.session_id
        and t.coach_id = auth.uid()
    )
  );
