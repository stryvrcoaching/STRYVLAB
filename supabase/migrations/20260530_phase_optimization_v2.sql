-- Phase Optimization Engine v2 — history trail + coach override + prefs

create table if not exists public.phase_optimization_history (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.coach_clients(id) on delete cascade,
  coach_id         uuid not null references auth.users(id) on delete cascade,
  recorded_on      date not null,
  direction_score  double precision not null,
  adaptive_score   double precision not null,
  direction        text not null,
  adaptive_state   text not null,
  data_quality     text not null check (data_quality in ('minimal', 'limited', 'good', 'high')),
  engine_version   text not null default 'v1',
  created_at       timestamptz not null default now(),
  unique (client_id, recorded_on)
);

create index if not exists phase_optimization_history_client_date_idx
  on public.phase_optimization_history (client_id, recorded_on desc);

alter table public.coach_clients
  add column if not exists phase_override jsonb default null,
  add column if not exists phase_preferences jsonb default null;

comment on column public.coach_clients.phase_override is
  'Coach manual phase override. Shape: {"active":true,"direction":"maintenance","adaptiveState":"stable","reason":"...","setAt":"ISO"}';

comment on column public.coach_clients.phase_preferences is
  'Coach phase engine prefs override. Shape: {"prioritizePerformance":true,"aggressiveCutTolerance":0.5,"preferredBulkAggressiveness":0.5}. NULL = derive from training_goal only.';

alter table public.phase_optimization_history enable row level security;

create policy "coach_sees_own_phase_history" on public.phase_optimization_history
  for all using (auth.uid() = coach_id);
