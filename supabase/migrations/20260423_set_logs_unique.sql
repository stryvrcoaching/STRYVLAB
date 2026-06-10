-- Contrainte unique pour permettre l'upsert live des sets en séance
ALTER TABLE client_set_logs
  ADD CONSTRAINT IF NOT EXISTS client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_name, set_number, side);
