-- Add primary_muscles and secondary_muscles to client_set_logs
-- These are persisted at log time so the recap can show accurate body map
-- without needing to re-join program_exercises

ALTER TABLE client_set_logs
  ADD COLUMN IF NOT EXISTS primary_muscles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_muscles text[] DEFAULT '{}';
