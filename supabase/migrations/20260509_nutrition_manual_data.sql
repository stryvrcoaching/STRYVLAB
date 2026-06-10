-- Table: coach_client_nutrition_manual_data
-- Stocke les données nutritionnelles saisies manuellement ou calculées par le coach
-- via le Nutrition Studio (alertes données manquantes)

create table if not exists public.coach_client_nutrition_manual_data (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.coach_clients(id) on delete cascade,
  coach_id        uuid not null references auth.users(id) on delete cascade,

  -- Biometrics
  weight_kg       numeric,
  height_cm       numeric,
  body_fat_pct    numeric,
  lean_mass_kg    numeric,
  muscle_mass_kg  numeric,
  bmr_kcal_measured numeric,
  bmr_source      text check (bmr_source in ('measured', 'estimated', 'calculated')),
  visceral_fat_level numeric,

  -- Training
  daily_steps     integer,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Unique constraint: only one manual data entry per (client_id, coach_id) pair
alter table public.coach_client_nutrition_manual_data
  add constraint coach_client_nutrition_manual_data_client_coach_unique
  unique (client_id, coach_id);

-- Index pour les requêtes rapides par client
create index if not exists coach_client_nutrition_manual_data_client_id_idx
  on public.coach_client_nutrition_manual_data(client_id);

-- RLS
alter table public.coach_client_nutrition_manual_data enable row level security;

-- Coach can see/update only their own clients' data
create policy "coach_sees_own_client_nutrition" on public.coach_client_nutrition_manual_data
  for all using (auth.uid() = coach_id);

-- Trigger for updated_at
drop trigger if exists coach_client_nutrition_manual_data_updated_at
  on public.coach_client_nutrition_manual_data;
create trigger coach_client_nutrition_manual_data_updated_at
  before update on public.coach_client_nutrition_manual_data
  for each row execute function public.set_updated_at();
