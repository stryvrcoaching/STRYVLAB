-- Upsert des sets : clé unique sur exercise_id (pas exercise_name) pour éviter
-- les collisions quand deux exercices du programme portent le même libellé.

-- Supprimer les doublons exacts sur l'ancienne clé nom (garder la ligne la plus récente)
DELETE FROM public.client_set_logs a
USING public.client_set_logs b
WHERE a.id < b.id
  AND a.session_log_id = b.session_log_id
  AND a.exercise_name = b.exercise_name
  AND a.set_number = b.set_number
  AND COALESCE(a.side, 'bilateral') = COALESCE(b.side, 'bilateral');

-- Supprimer les doublons sur la future clé exercise_id
DELETE FROM public.client_set_logs a
USING public.client_set_logs b
WHERE a.id < b.id
  AND a.session_log_id = b.session_log_id
  AND a.exercise_id IS NOT NULL
  AND a.exercise_id = b.exercise_id
  AND a.set_number = b.set_number
  AND COALESCE(a.side, 'bilateral') = COALESCE(b.side, 'bilateral');

ALTER TABLE public.client_set_logs
  DROP CONSTRAINT IF EXISTS client_set_logs_session_exercise_set_side_unique;

-- Backfill exercise_id manquants : impossible sans jointure fiable — les nouveaux logs
-- enverront toujours exercise_id depuis le client.

ALTER TABLE public.client_set_logs
  ADD CONSTRAINT client_set_logs_session_exercise_set_side_unique
  UNIQUE (session_log_id, exercise_id, set_number, side);
