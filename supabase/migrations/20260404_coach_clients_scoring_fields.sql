-- Migration: add structured scoring fields to coach_clients
-- These fields replace the free-text `goal` field for deterministic template compatibility scoring.
-- `goal` (free text) is kept for coach notes — these new fields are the machine-readable signals.

alter table public.coach_clients
  add column if not exists training_goal  text check (training_goal  in ('hypertrophy','strength','fat_loss','endurance','recomp','maintenance','athletic')),
  add column if not exists fitness_level  text check (fitness_level  in ('beginner','intermediate','advanced','elite')),
  add column if not exists sport_practice text check (sport_practice in ('sedentary','light','moderate','active','athlete')),
  add column if not exists weekly_frequency smallint check (weekly_frequency between 1 and 7);

comment on column public.coach_clients.training_goal   is 'Primary training objective — used for template compatibility scoring';
comment on column public.coach_clients.fitness_level   is 'Client fitness level — matches template.level for scoring';
comment on column public.coach_clients.sport_practice  is 'Weekly sport activity level — used to weight programme duration preference';
comment on column public.coach_clients.weekly_frequency is 'Desired training sessions per week — matches template.frequency for scoring';
