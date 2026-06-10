-- Fix upsert live sets : side NOT NULL + contrainte unique
-- Problème : side était nullable, PostgreSQL traite NULL != NULL dans UNIQUE
-- ce qui empêche l'upsert onConflict de fonctionner.

-- 1. Backfill : mettre 'bilateral' sur les sets sans side
UPDATE client_set_logs SET side = 'bilateral' WHERE side IS NULL;

-- 2. Rendre side NOT NULL avec default
ALTER TABLE client_set_logs
  ALTER COLUMN side SET DEFAULT 'bilateral',
  ALTER COLUMN side SET NOT NULL;

-- 3. Supprimer l'ancienne contrainte si elle existe
ALTER TABLE client_set_logs
  DROP CONSTRAINT IF EXISTS client_set_logs_session_exercise_set_side_unique;

-- 4. Créer la contrainte unique (requise pour upsert onConflict)
ALTER TABLE client_set_logs
  ADD CONSTRAINT client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_name, set_number, side);
