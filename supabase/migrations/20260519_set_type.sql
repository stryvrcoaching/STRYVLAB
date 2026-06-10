-- 20260519_set_type.sql
ALTER TABLE client_set_logs
  ADD COLUMN IF NOT EXISTS set_type text DEFAULT 'working'
  CHECK (set_type IN ('warmup', 'working', 'cooldown', 'dropset'));
