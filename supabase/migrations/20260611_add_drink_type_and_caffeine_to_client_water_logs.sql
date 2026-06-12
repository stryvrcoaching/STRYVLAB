alter table public.client_water_logs
  add column if not exists drink_type text not null default 'water',
  add column if not exists caffeine_mg integer not null default 0;

update public.client_water_logs
set drink_type = coalesce(drink_type, 'water'),
    caffeine_mg = coalesce(caffeine_mg, 0)
where drink_type is null
   or caffeine_mg is null;

create index if not exists client_water_logs_client_logged_drink_idx
  on public.client_water_logs (client_id, logged_at, drink_type);

