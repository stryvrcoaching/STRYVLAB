-- Client-level adaptive TDEE truth layer

create table if not exists public.client_tdee_state (
  client_id uuid primary key references public.coach_clients(id) on delete cascade,
  current_tdee integer,
  current_tdee_at timestamptz,
  latest_observed_tdee integer,
  latest_observed_at timestamptz,
  confidence text check (confidence in ('high', 'medium', 'low')),
  confidence_score integer check (confidence_score between 0 and 100),
  confidence_reasons jsonb not null default '[]'::jsonb,
  source text check (source in ('weight_delta', 'formula_proxy')),
  method_version text not null default 'adaptive_tdee_v3',
  stability_status text not null default 'stable' check (stability_status in ('stable', 'watch', 'action')),
  pending_direction text check (pending_direction in ('up', 'down')),
  pending_delta_kcal integer,
  pending_streak integer not null default 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_skip_at timestamptz,
  last_skip_reason text,
  last_error_at timestamptz,
  last_error text,
  window_days integer,
  tracked_days integer,
  weight_samples integer,
  excluded_current_day boolean not null default true,
  anchored_to_protocol boolean not null default false,
  smoothed_weight_used boolean not null default false,
  applied_luteal_correction boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_tdee_state_status
  on public.client_tdee_state (stability_status, current_tdee_at desc);

alter table public.client_tdee_state enable row level security;

drop policy if exists "coach_manage_client_tdee_state" on public.client_tdee_state;
create policy "coach_manage_client_tdee_state"
  on public.client_tdee_state
  for all
  to authenticated
  using (
    client_id in (
      select id from public.coach_clients where coach_id = auth.uid()
    )
  );

drop policy if exists "client_read_client_tdee_state" on public.client_tdee_state;
create policy "client_read_client_tdee_state"
  on public.client_tdee_state
  for select
  to authenticated
  using (
    client_id in (
      select id from public.coach_clients where user_id = auth.uid()
    )
  );

alter table public.nutrition_tdee_history
  add column if not exists tracked_days integer,
  add column if not exists excluded_current_day boolean not null default true,
  add column if not exists anchored_to_protocol boolean not null default false,
  add column if not exists smoothed_weight_used boolean not null default false,
  add column if not exists applied_luteal_correction boolean not null default false,
  add column if not exists stable_tdee_after integer,
  add column if not exists stability_status_after text check (stability_status_after in ('stable', 'watch', 'action')),
  add column if not exists update_outcome text check (update_outcome in ('initialized', 'noise', 'watch', 'promoted')),
  add column if not exists method_version text not null default 'adaptive_tdee_v3';

alter table public.nutrition_protocols
  add column if not exists tdee_snapshot_source text check (tdee_snapshot_source in ('client_state', 'manual', 'formula')),
  add column if not exists tdee_snapshot_used_at timestamptz;

insert into public.client_tdee_state (
  client_id,
  current_tdee,
  current_tdee_at,
  latest_observed_tdee,
  latest_observed_at,
  source,
  method_version,
  stability_status,
  last_attempt_at,
  last_success_at
)
select distinct on (np.client_id)
  np.client_id,
  np.tdee_adaptive,
  coalesce(np.tdee_adaptive_at, np.updated_at),
  np.tdee_adaptive,
  coalesce(np.tdee_adaptive_at, np.updated_at),
  np.tdee_data_source,
  'backfill_protocol_snapshot',
  'stable',
  coalesce(np.tdee_adaptive_at, np.updated_at),
  coalesce(np.tdee_adaptive_at, np.updated_at)
from public.nutrition_protocols np
where np.tdee_adaptive is not null
order by np.client_id, coalesce(np.tdee_adaptive_at, np.updated_at) desc
on conflict (client_id) do nothing;
