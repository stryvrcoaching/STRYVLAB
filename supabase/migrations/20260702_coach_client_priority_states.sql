create table if not exists public.coach_client_priority_states (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null,
  client_id uuid not null,
  priority_key text not null,
  kind text not null,
  state text not null check (state in ('open', 'planned', 'treated')),
  action_taken text null,
  agenda_event_id uuid null,
  kanban_task_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  treated_at timestamptz null,
  planned_at timestamptz null
);

create unique index if not exists coach_client_priority_states_coach_priority_key_idx
  on public.coach_client_priority_states (coach_id, priority_key);

create index if not exists coach_client_priority_states_client_idx
  on public.coach_client_priority_states (client_id, state);
