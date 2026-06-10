-- Garantit que la contrainte unique pour l'upsert live des sets est bien en place
-- Idempotent : sans erreur si déjà appliqué

-- 1. Backfill : side NULL → 'bilateral' (PostgreSQL traite NULL != NULL dans UNIQUE)
UPDATE client_set_logs SET side = 'bilateral' WHERE side IS NULL;

-- 2. side NOT NULL avec default (idempotent via DO block)
DO $$
BEGIN
  BEGIN
    ALTER TABLE client_set_logs
      ALTER COLUMN side SET DEFAULT 'bilateral',
      ALTER COLUMN side SET NOT NULL;
  EXCEPTION WHEN others THEN
    NULL; -- déjà NOT NULL, on continue
  END;
END $$;

-- 3. Recréer la contrainte unique (DROP IF EXISTS + ADD)
ALTER TABLE client_set_logs
  DROP CONSTRAINT IF EXISTS client_set_logs_session_exercise_set_side_unique;

ALTER TABLE client_set_logs
  ADD CONSTRAINT client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_name, set_number, side);
