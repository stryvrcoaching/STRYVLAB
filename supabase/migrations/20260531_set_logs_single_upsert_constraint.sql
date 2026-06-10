-- Une seule contrainte d'upsert sur exercise_id ; supprimer les contraintes legacy sur exercise_name.
-- (DROP CONSTRAINT supprime aussi l'index associé — ne pas DROP INDEX avant.)

ALTER TABLE public.client_set_logs
  DROP CONSTRAINT IF EXISTS client_set_logs_upsert_key;

ALTER TABLE public.client_set_logs
  DROP CONSTRAINT IF EXISTS client_set_logs_session_exercise_set_side_unique;

-- Supprimer les lignes fantômes (exercise_id NULL) quand une ligne identifiée existe déjà
DELETE FROM public.client_set_logs a
WHERE a.exercise_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.client_set_logs b
    WHERE b.session_log_id = a.session_log_id
      AND b.exercise_name = a.exercise_name
      AND b.set_number = a.set_number
      AND COALESCE(b.side, 'bilateral') = COALESCE(a.side, 'bilateral')
      AND b.exercise_id IS NOT NULL
  );

-- Doublons sur la clé exercise_id (garder la plus récente)
DELETE FROM public.client_set_logs a
USING public.client_set_logs b
WHERE a.id < b.id
  AND a.session_log_id = b.session_log_id
  AND a.exercise_id IS NOT NULL
  AND a.exercise_id = b.exercise_id
  AND a.set_number = b.set_number
  AND COALESCE(a.side, 'bilateral') = COALESCE(b.side, 'bilateral');

ALTER TABLE public.client_set_logs
  ADD CONSTRAINT client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_id, set_number, side);
