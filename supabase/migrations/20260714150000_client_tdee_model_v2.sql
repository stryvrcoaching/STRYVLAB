alter table public.client_tdee_state
  add column if not exists current_tdee_lower integer,
  add column if not exists current_tdee_upper integer,
  add column if not exists latest_observed_lower integer,
  add column if not exists latest_observed_upper integer,
  add column if not exists actionable_streak integer not null default 0,
  add column if not exists context_changed_at timestamptz;

alter table public.nutrition_tdee_history
  add column if not exists tdee_lower integer,
  add column if not exists tdee_upper integer,
  add column if not exists complete_days integer,
  add column if not exists context_changed boolean not null default false;
