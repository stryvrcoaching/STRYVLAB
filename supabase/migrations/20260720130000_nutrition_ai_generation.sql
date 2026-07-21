-- Nutrition AI V1: coach-controlled generation settings and auditable runs.

alter table public.coach_ai_settings_per_client
  add column if not exists nutrition_generation_enabled boolean not null default false,
  add column if not exists nutrition_publication_mode text not null default 'coach_review'
    check (nutrition_publication_mode in ('coach_review', 'coach_auto')),
  add column if not exists nutrition_allow_phase_adjustment boolean not null default false;

create table if not exists public.nutrition_ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid references public.nutrition_protocols(id) on delete set null,
  trigger_type text not null default 'coach_manual'
    check (trigger_type in ('coach_manual', 'scheduled', 'checkin_adjustment')),
  publication_mode text not null
    check (publication_mode in ('coach_review', 'coach_auto', 'autonomous_auto')),
  status text not null default 'generating'
    check (status in ('generating', 'needs_review', 'ready', 'published', 'blocked', 'failed')),
  model text,
  input_snapshot jsonb not null,
  output_snapshot jsonb,
  safety_issues jsonb not null default '[]'::jsonb,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists nutrition_ai_runs_client_created_idx
  on public.nutrition_ai_generation_runs(client_id, created_at desc);

alter table public.nutrition_ai_generation_runs enable row level security;

drop policy if exists "coach_reads_own_nutrition_ai_runs" on public.nutrition_ai_generation_runs;

create policy "coach_reads_own_nutrition_ai_runs"
  on public.nutrition_ai_generation_runs for select
  using (coach_id = auth.uid());
