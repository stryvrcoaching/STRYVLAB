create extension if not exists pgcrypto;

create table if not exists public.client_nutrition_protocol_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid not null,
  protocol_id uuid not null references public.nutrition_protocols(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  started_reason text not null check (started_reason in ('share', 'manual_switch', 'replace')),
  ended_reason text null check (ended_reason in ('unshare', 'replace', 'delete')),
  started_by uuid not null,
  ended_by uuid null,
  source_annotation_id uuid null references public.metric_annotations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_client_nutrition_protocol_assignments_client_id
  on public.client_nutrition_protocol_assignments(client_id);

create index if not exists idx_client_nutrition_protocol_assignments_protocol_id
  on public.client_nutrition_protocol_assignments(protocol_id);

create unique index if not exists uq_client_nutrition_protocol_assignments_active
  on public.client_nutrition_protocol_assignments(client_id)
  where ended_at is null;

create table if not exists public.client_workout_program_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  coach_id uuid not null,
  program_id uuid not null references public.programs(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  started_reason text not null check (started_reason in ('publish', 'manual_switch', 'replace')),
  ended_reason text null check (ended_reason in ('unpublish', 'replace', 'delete')),
  started_by uuid not null,
  ended_by uuid null,
  source_annotation_id uuid null references public.metric_annotations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_client_workout_program_assignments_client_id
  on public.client_workout_program_assignments(client_id);

create index if not exists idx_client_workout_program_assignments_program_id
  on public.client_workout_program_assignments(program_id);

create unique index if not exists uq_client_workout_program_assignments_active
  on public.client_workout_program_assignments(client_id)
  where ended_at is null;
