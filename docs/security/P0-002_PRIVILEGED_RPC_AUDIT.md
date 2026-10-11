# P0-002 — Review of exposed privileged database functions

**Scope:** `stryvrcoaching/STRYVLAB`, branch `main`, and a separately connected Supabase project called `STRYVR`. The running site's actual `NEXT_PUBLIC_SUPABASE_URL` has NOT been independently matched to that project's reference. **Do not deploy before matching the project and target environment.**

## Verified evidence (read-only, 2026-10-11)
- PostgreSQL `has_function_privilege('anon', oid, 'EXECUTE')` returned `true` for **12 `SECURITY DEFINER` functions** (also true for `authenticated`). Nine are ordinary functions and three are trigger functions. A trigger function cannot be invoked as an ordinary RPC; its grant is nevertheless excessive.
- Several ordinary functions write client-specific points, rewards or tracking data, and some lack identity/ownership checks in their definitions. Authorization solely by supplied client/coach IDs is not sufficient.
- Production usage/exploitation has **not** been tested; no user data was accessed and no grants were changed.
- The repository includes `supabase/migrations/20260714_reward_automatic_delivery.sql` with `REVOKE ... FROM PUBLIC` for the reward RPC, but the connected DB still grants `anon` execution. Reasons can include the migration not having been applied there, later re-grants, or this being a different Supabase project. Investigate migration drift first.

## Proposed mitigation
1. Identify the real Supabase project connected to each STRYV Lab environment without revealing any API keys or secrets.
2. Map all client-side `supabase.rpc()` calls and all server-side callers. Existing examined reward API routes use a privileged server-side Supabase client, not direct browser RPC; **this is not proof for every caller**.
3. On an isolated staging database, apply the grants in `P0-002_PRIVILEGED_RPC_GRANTS_REVIEW.sql`, changing its final `ROLLBACK` to `COMMIT` only after approval. Keep server-side `service_role` execution; revoke public and authenticated direct execution on privileged functions.
4. Verify real user journeys: create/complete assessments, earn progression points, redeem/cancel rewards, request/approve/reject tracking pauses, program session updates, AI quota tracking. Check that valid flows continue and unauthorized/direct RPC attempts fail.
5. Add identity and ownership enforcement to each privileged function or route as defense in depth, minimize `SECURITY DEFINER`, and keep internal helpers in non-exposed schemas.
6. Generate an actual migration using `supabase migration new <descriptive-name>`, add reviewed SQL, test the migration up/down procedure, and deploy only after explicit review and database backup.
7. Rerun Supabase Security Advisors and record a before/after diff. Consider default privileges for future functions and `search_path` warnings separately.

## Safety boundaries
- **No migration in this draft PR**: the SQL deliberately ends with `ROLLBACK` and is not in `supabase/migrations/`.
- **No direct database changes**.
- This change plan does not imply STRYV Lab is safe to launch; tenant isolation, public tokens, Auth deletion, storage, dependency updates and GDPR review are separate gates.
- PostgreSQL functions recreated after a grant correction may regain default privileges; enforce this in the deployment pipeline.

## Authoritative references
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
