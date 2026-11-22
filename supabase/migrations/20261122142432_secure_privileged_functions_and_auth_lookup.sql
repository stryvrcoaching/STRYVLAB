-- These functions are called by trusted server code or database triggers only.
-- The default PUBLIC EXECUTE grant otherwise exposes privileged writes via RPC.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'award_client_progression', 'award_client_progression_v2',
        'cancel_client_reward_redemption', 'cancel_client_tracking_pause',
        'create_coach_tracking_pause', 'decide_client_tracking_pause',
        'increment_llm_budget', 'redeem_client_reward',
        'request_client_tracking_pause', 'sync_program_frequency_from_sessions',
        'sync_progression_identity_on_client_link', 'sync_template_frequency_from_sessions'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END;
$$;

-- Pin the search path on existing public functions flagged by the database advisor.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'set_updated_at', 'update_updated_at_column',
        'sync_task_column_to_event', 'sync_column_rename_to_events',
        'set_daily_checkin_configs_updated_at', 'set_client_streaks_updated_at',
        'sync_custom_exercise_muscles', 'increment_llm_budget',
        'compute_program_sessions_per_week', 'compute_template_sessions_per_week',
        'set_coach_rewards_updated_at', 'gamification_level_for_points',
        'sales_workspace_set_updated_at', 'is_public_demo_session',
        'touch_client_tracking_pause'
      ])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', fn.signature);
  END LOOP;
END;
$$;

-- Resolve an existing Auth account without scanning paginated admin user lists.
CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
  FROM auth.users AS u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_auth_user_id_by_email(text) TO service_role;
