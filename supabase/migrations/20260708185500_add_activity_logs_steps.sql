-- Migration: add steps to client_activity_logs
-- Allows clients to log specific steps for walking/running activities.

alter table public.client_activity_logs
  add column if not exists steps integer;

comment on column public.client_activity_logs.steps is 'Steps logged for this physical activity (primarily walking/running)';
