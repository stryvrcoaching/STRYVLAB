-- ============================================================
-- ASSESSMENT SYSTEM — Tables, RLS, Triggers
-- Dépend de : coach_clients (20260402_coach_clients.sql)
-- Fonction set_updated_at() déjà créée dans la migration précédente
-- ============================================================

-- ============================================================
-- 1. assessment_templates
-- Modèles de bilans configurés par le coach (drag & drop)
-- ============================================================
create table if not exists public.assessment_templates (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  template_type text not null default 'intake'
                check (template_type in ('intake', 'weekly', 'monthly', 'custom')),
  blocks        jsonb not null default '[]',  -- BlockConfig[] sérialisé
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists assessment_templates_coach_id_idx
  on public.assessment_templates(coach_id);

drop trigger if exists assessment_templates_updated_at on public.assessment_templates;
create trigger assessment_templates_updated_at
  before update on public.assessment_templates
  for each row execute function public.set_updated_at();

alter table public.assessment_templates enable row level security;

create policy "coach_own_templates"
  on public.assessment_templates
  for all using (auth.uid() = coach_id);

-- ============================================================
-- 2. assessment_submissions
-- Instance d'un bilan envoyé ou rempli pour un client
-- ============================================================
create table if not exists public.assessment_submissions (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null references auth.users(id) on delete cascade,
  client_id          uuid not null references public.coach_clients(id) on delete cascade,
  template_id        uuid not null references public.assessment_templates(id) on delete restrict,
  template_snapshot  jsonb not null,             -- copie immuable des blocks au moment de l'envoi
  status             text not null default 'pending'
                     check (status in ('pending', 'in_progress', 'completed', 'expired')),
  filled_by          text not null default 'client'
                     check (filled_by in ('client', 'coach')),
  token              text unique,                -- 32-char hex pour lien public client
  token_expires_at   timestamptz,               -- now() + interval '7 days'
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists assessment_submissions_coach_id_idx
  on public.assessment_submissions(coach_id);
create index if not exists assessment_submissions_client_id_idx
  on public.assessment_submissions(client_id);
create index if not exists assessment_submissions_token_idx
  on public.assessment_submissions(token)
  where token is not null;

drop trigger if exists assessment_submissions_updated_at on public.assessment_submissions;
create trigger assessment_submissions_updated_at
  before update on public.assessment_submissions
  for each row execute function public.set_updated_at();

alter table public.assessment_submissions enable row level security;

-- Le coach voit et gère ses propres soumissions
create policy "coach_own_submissions"
  on public.assessment_submissions
  for all using (auth.uid() = coach_id);

-- ============================================================
-- 3. assessment_responses
-- Réponses champ par champ d'une soumission
-- ============================================================
create table if not exists public.assessment_responses (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references public.assessment_submissions(id) on delete cascade,
  block_id       text not null,   -- BlockConfig.id
  field_key      text not null,   -- FieldConfig.key
  value_text     text,            -- texte libre, choix unique
  value_number   numeric,         -- numérique, échelle 1-10
  value_json     jsonb,           -- choix multiple, données complexes
  storage_path   text,            -- Supabase Storage path pour photos
  created_at     timestamptz not null default now(),
  -- Contrainte d'unicité : une seule réponse par (submission, block, field)
  unique (submission_id, block_id, field_key)
);

create index if not exists assessment_responses_submission_id_idx
  on public.assessment_responses(submission_id);

alter table public.assessment_responses enable row level security;

-- Le coach accède aux réponses de ses soumissions
create policy "coach_sees_own_responses"
  on public.assessment_responses
  for select using (
    exists (
      select 1 from public.assessment_submissions s
      where s.id = assessment_responses.submission_id
        and s.coach_id = auth.uid()
    )
  );

create policy "coach_inserts_responses"
  on public.assessment_responses
  for insert with check (
    exists (
      select 1 from public.assessment_submissions s
      where s.id = assessment_responses.submission_id
        and s.coach_id = auth.uid()
    )
  );

create policy "coach_updates_responses"
  on public.assessment_responses
  for update using (
    exists (
      select 1 from public.assessment_submissions s
      where s.id = assessment_responses.submission_id
        and s.coach_id = auth.uid()
    )
  );

-- Note : les réponses client via token public passent par service role key (bypass RLS)

-- ============================================================
-- 4. client_notifications
-- Badge dashboard coach + historique notifications
-- ============================================================
create table if not exists public.client_notifications (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references auth.users(id) on delete cascade,
  client_id      uuid references public.coach_clients(id) on delete cascade,
  submission_id  uuid references public.assessment_submissions(id) on delete cascade,
  type           text not null
                 check (type in ('assessment_completed', 'assessment_sent', 'program_updated')),
  message        text not null,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists client_notifications_coach_id_idx
  on public.client_notifications(coach_id);
create index if not exists client_notifications_unread_idx
  on public.client_notifications(coach_id, read)
  where read = false;

alter table public.client_notifications enable row level security;

create policy "coach_own_notifications"
  on public.client_notifications
  for all using (auth.uid() = coach_id);
