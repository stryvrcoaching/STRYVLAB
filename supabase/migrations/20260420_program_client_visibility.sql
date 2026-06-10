-- ============================================================
-- Add is_client_visible flag to programs
-- Allows multiple programs per client, each independently toggled
-- on/off for the client app (distinct from status='active/archived')
-- ============================================================

alter table public.programs
  add column if not exists is_client_visible boolean not null default false;
