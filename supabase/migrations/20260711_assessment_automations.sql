-- Recurring assessment deliveries for a coach/client pair.
create table if not exists public.assessment_automations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.coach_clients(id) on delete cascade,
  template_id uuid not null references public.assessment_templates(id) on delete restrict,
  frequency text not null default 'weekly' check (frequency in ('weekly')),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  send_time time not null,
  timezone text not null default 'Europe/Brussels',
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'paused')),
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_automations_dates_check check (ends_on is null or ends_on >= starts_on)
);

create index if not exists assessment_automations_due_idx
  on public.assessment_automations(status, next_run_at);
create index if not exists assessment_automations_client_idx
  on public.assessment_automations(client_id);
create unique index if not exists assessment_automations_one_active_idx
  on public.assessment_automations(client_id, template_id)
  where status = 'active';

drop trigger if exists assessment_automations_updated_at on public.assessment_automations;
create trigger assessment_automations_updated_at
  before update on public.assessment_automations
  for each row execute function public.set_updated_at();

alter table public.assessment_automations enable row level security;

drop policy if exists "coach_own_assessment_automations" on public.assessment_automations;
create policy "coach_own_assessment_automations"
  on public.assessment_automations
  for all using (auth.uid() = coach_id) with check (auth.uid() = coach_id);
