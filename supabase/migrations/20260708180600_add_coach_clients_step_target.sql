-- Migration: add step_target to coach_clients
-- Allows coaches to set custom daily step targets for their clients.

alter table public.coach_clients
  add column if not exists step_target integer;

comment on column public.coach_clients.step_target is 'Custom daily steps target set by the coach';
