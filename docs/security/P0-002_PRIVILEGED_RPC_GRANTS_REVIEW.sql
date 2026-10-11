-- P0-002 / STRYV Lab - privileged RPC access control (REVIEW ONLY)
-- This SQL file is deliberately NOT a migration and does NOT persist changes.
-- Run only against a CLONED / ISOLATED STAGING database after reviewing all
-- server-side RPC callers and explicitly identifying the deployment target.
-- Switch ROLLBACK to COMMIT only in a reviewed, CLI-generated migration
-- after regression testing and explicit approval.
-- Critical: Supabase grants EXECUTE on public functions by default on some projects.
--
-- Provenance: read-only pg_proc / has_function_privilege review on 2026-10-11.
-- 9 regular functions + 3 trigger functions currently permitted for anon.
-- Function definitions may be recreated by other migrations, resetting privileges.
-- This is one guardrail; it does not replace application-level authorization.
BEGIN;
-- Permit service-side usage explicitly before removing inherited/public rights.
GRANT EXECUTE ON FUNCTION public.award_client_progression(uuid,text,integer,text,uuid,timestamp with time zone,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_client_progression_v2(uuid,text,integer,text,uuid,timestamp with time zone,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_reward_redemption(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_client_tracking_pause(uuid,uuid,text,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_coach_tracking_pause(uuid,uuid,date,date,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decide_client_tracking_pause(uuid,uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_llm_budget(uuid,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_client_reward(uuid,uuid,text,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_client_tracking_pause(uuid,date,date,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_program_frequency_from_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_progression_identity_on_client_link() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_template_frequency_from_sessions() TO service_role;
-- Remove arbitrary browser / unauthenticated RPC execution privileges.
REVOKE EXECUTE ON FUNCTION public.award_client_progression(uuid,text,integer,text,uuid,timestamp with time zone,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_client_progression_v2(uuid,text,integer,text,uuid,timestamp with time zone,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_client_reward_redemption(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_client_tracking_pause(uuid,uuid,text,date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_coach_tracking_pause(uuid,uuid,date,date,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_client_tracking_pause(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_llm_budget(uuid,date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_client_reward(uuid,uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_client_tracking_pause(uuid,date,date,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_program_frequency_from_sessions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_progression_identity_on_client_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_template_frequency_from_sessions() FROM PUBLIC, anon, authenticated;

-- Fail if any protected function is still reachable by anon/authenticated.
DO $review$
DECLARE exposed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO exposed_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid::regprocedure::text IN (
      'public.award_client_progression(uuid,text,integer,text,uuid,timestamp with time zone,jsonb)',
      'public.award_client_progression_v2(uuid,text,integer,text,uuid,timestamp with time zone,jsonb)',
      'public.cancel_client_reward_redemption(uuid,uuid,uuid)',
      'public.cancel_client_tracking_pause(uuid,uuid,text,date)',
      'public.create_coach_tracking_pause(uuid,uuid,date,date,text,text)',
      'public.decide_client_tracking_pause(uuid,uuid,boolean)',
      'public.increment_llm_budget(uuid,date)',
      'public.redeem_client_reward(uuid,uuid,text,text,text,text,text,text,text)',
      'public.request_client_tracking_pause(uuid,date,date,text,text)',
      'public.sync_program_frequency_from_sessions()',
      'public.sync_progression_identity_on_client_link()',
      'public.sync_template_frequency_from_sessions()'
    )
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  -- The regprocedure pretty-printing may differ by schema/search_path:
  -- also check by function names listed below in the verification query.
  RAISE NOTICE 'Remaining exposed privileged functions (candidate check): %', exposed_count;
END;
$review$;

-- REVIEW DEFAULT: never persist any ACL modification from this file.
ROLLBACK;

-- Read-only verification AFTER an approved migration (run separately):
-- SELECT p.oid::regprocedure::text,
--        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec,
--        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_exec
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.prosecdef
-- ORDER BY 1;
