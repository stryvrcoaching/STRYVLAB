-- Table coach_clients
-- Représente les clients gérés par un coach VIRTUS
-- coach_id = auth.uid() du coach connecté

create table if not exists public.coach_clients (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references auth.users(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  goal        text,
  notes       text,
  status      text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index pour les requêtes coach → clients
create index if not exists coach_clients_coach_id_idx on public.coach_clients(coach_id);

-- Trigger updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_clients_updated_at on public.coach_clients;
create trigger coach_clients_updated_at
  before update on public.coach_clients
  for each row execute function public.set_updated_at();

-- RLS
alter table public.coach_clients enable row level security;

-- Un coach ne voit que ses propres clients
create policy "coach_sees_own_clients" on public.coach_clients
  for all using (auth.uid() = coach_id);
