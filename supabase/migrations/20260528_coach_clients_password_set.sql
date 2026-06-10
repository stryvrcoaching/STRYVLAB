-- ============================================================
-- Add password_set flag to track onboarding completion
-- ============================================================
-- Problem: last_sign_in_at is set when user clicks recovery link,
-- not when they actually set their password. This causes a second
-- invite to send a magiclink instead of recovery link.
--
-- Solution: Track password completion explicitly with password_set flag.
-- Set to TRUE only when client completes /api/client/welcome after password creation.
-- ============================================================

alter table public.coach_clients
  add column if not exists password_set boolean not null default false;

-- Index for invitation logic
create index if not exists coach_clients_password_set_idx
  on public.coach_clients(password_set)
  where password_set = false;
