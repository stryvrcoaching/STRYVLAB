-- ============================================================
-- Double Progression + Auto-régulation RIR
--
-- Système activable par le coach sur chaque programme.
-- Règle : si le client atteint rep_max sur TOUTES les séries
--         avec le RIR demandé → charge augmente de weight_increment_kg.
--         Sinon → même charge, chercher plus de reps.
--
-- Tables modifiées :
--   1. programs          — toggle progressive_overload_enabled
--   2. program_exercises — rep_min/max, target_rir, weight_increment_kg,
--                          current_weight_kg (suggestion courante)
--   3. client_set_logs   — rir_actual (RIR réellement ressenti)
--
-- Table créée :
--   4. progression_events — audit des déclenchements algorithmiques
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. programs — toggle double progression
-- ────────────────────────────────────────────────────────────
alter table public.programs
  add column if not exists progressive_overload_enabled boolean not null default false;

comment on column public.programs.progressive_overload_enabled is
  'Activé par le coach — déclenche l''algorithme double progression après chaque séance complétée';

-- ────────────────────────────────────────────────────────────
-- 2. program_exercises — colonnes double progression
-- ────────────────────────────────────────────────────────────

-- Bornes de la plage de répétitions (parsées depuis reps text)
alter table public.program_exercises
  add column if not exists rep_min int check (rep_min >= 1),
  add column if not exists rep_max int check (rep_max >= 1);

comment on column public.program_exercises.rep_min is
  'Borne basse de la plage (ex: 8 pour "8-12"). NULL = pas de double progression sur cet exercice.';
comment on column public.program_exercises.rep_max is
  'Borne haute de la plage. Atteindre rep_max sur toutes les séries = trigger surcharge.';

-- RIR cible prescrit par le coach
alter table public.program_exercises
  add column if not exists target_rir int check (target_rir between 0 and 5);

comment on column public.program_exercises.target_rir is
  'RIR cible pour cet exercice (0=échec, 1=quasi-échec, 2=conservateur, 3=confort). Remplace progressivement rir.';

-- Incrément de charge lors du déclenchement
alter table public.program_exercises
  add column if not exists weight_increment_kg numeric(4,2) not null default 2.5
  check (weight_increment_kg > 0);

comment on column public.program_exercises.weight_increment_kg is
  'Augmentation de charge en kg lors du trigger (défaut 2.5kg). Coach peut passer à 5kg pour les gros muscles.';

-- Charge courante suggérée (mise à jour par l''algorithme)
alter table public.program_exercises
  add column if not exists current_weight_kg numeric(6,2);

comment on column public.program_exercises.current_weight_kg is
  'Charge suggérée pour la prochaine séance. NULL = pas encore de donnée (semaine 1).';

-- ────────────────────────────────────────────────────────────
-- 3. client_set_logs — RIR réellement ressenti par le client
-- ────────────────────────────────────────────────────────────
alter table public.client_set_logs
  add column if not exists rir_actual int check (rir_actual between 0 and 10);

comment on column public.client_set_logs.rir_actual is
  'RIR réellement ressenti par le client (0=échec, 1=1 rep en réserve…). Entrée dans le SessionLogger.';

-- ────────────────────────────────────────────────────────────
-- 4. progression_events — audit des déclenchements
-- ────────────────────────────────────────────────────────────
create table if not exists public.progression_events (
  id                  uuid primary key default gen_random_uuid(),
  exercise_id         uuid not null references public.program_exercises(id) on delete cascade,
  client_id           uuid not null references public.coach_clients(id) on delete cascade,
  session_log_id      uuid not null references public.client_session_logs(id) on delete cascade,

  -- Contexte de la séance déclencheuse
  sets_completed      int not null,        -- nombre de séries validées
  reps_per_set        int[] not null,      -- reps par série [12,12,12]
  weight_kg           numeric(6,2) not null, -- charge utilisée
  rir_values          int[] not null,      -- RIR réel par série

  -- Résultat de l''évaluation
  trigger_type        text not null
                      check (trigger_type in ('overload', 'maintain')),
                      -- overload = charge augmentée / maintain = même charge, cherche +reps

  previous_weight_kg  numeric(6,2),        -- charge avant l''événement
  new_weight_kg       numeric(6,2),        -- charge après l''événement (null si maintain)
  increment_applied   numeric(4,2),        -- delta appliqué (null si maintain)

  created_at          timestamptz not null default now()
);

create index if not exists progression_events_exercise_idx on public.progression_events(exercise_id);
create index if not exists progression_events_client_idx   on public.progression_events(client_id);
create index if not exists progression_events_session_idx  on public.progression_events(session_log_id);

alter table public.progression_events enable row level security;

-- Le client voit ses propres événements
create policy "client_sees_own_progression_events"
  on public.progression_events for select
  using (
    exists (
      select 1 from public.coach_clients c
      where c.id = public.progression_events.client_id
        and c.user_id = auth.uid()
    )
  );

-- Le coach voit les événements de ses clients
create policy "coach_sees_client_progression_events"
  on public.progression_events for select
  using (
    exists (
      select 1 from public.coach_clients c
      where c.id = public.progression_events.client_id
        and c.coach_id = auth.uid()
    )
  );

-- Seul le service role peut insérer (algorithme côté serveur uniquement)
-- Aucune policy INSERT/UPDATE/DELETE pour les rôles authenticated → service role only
