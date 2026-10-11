-- P0-002 — READ ONLY diagnostic of privileged SQL functions.
-- Safe to run on the identified Supabase project; does NOT modify data or ACLs.
-- Take a snapshot BEFORE and AFTER any authorized grant change.
--
-- Detects SECURITY DEFINER functions executable by anon or authenticated.
-- Trigger functions are included in the output for auditing but are not
-- directly callable through ordinary PostgREST RPC endpoints.
SELECT
  p.proname AS function_name,
  p.oid::regprocedure::text AS signature,
  pg_get_userbyid(p.proowner) AS owner_role,
  (p.prorettype = 'pg_catalog.trigger'::regtype) AS is_trigger_function,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY is_trigger_function, p.proname, signature;
