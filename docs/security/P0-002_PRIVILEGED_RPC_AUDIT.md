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


## Follow-up verification — 2026-10-11

### Confirmed PostgreSQL privilege snapshot
A read-only query against the connected `STRYVR` database returned:
- **12 SECURITY DEFINER functions** executable by **both `anon` and `authenticated`**.
- **9 ordinary functions** potentially exposed as RPCs, plus **3 trigger functions** (not callable as ordinary RPC endpoints).
- All **12 owned by `postgres`**; the definer role is privileged.
- The `service_role` can execute these functions too.

This is a **confirmed grant configuration**, not a claim that the public website has been successfully exploited. No mutation or attack test was performed.

Run [`P0-002_RPC_PERMISSIONS_READONLY.sql`](P0-002_RPC_PERMISSIONS_READONLY.sql) to reproduce the permission snapshot on the correct project (read-only). The remediation proposal remains separate and deliberately rolls back its privilege changes.

### Deployment identity still UNCONFIRMED
The connected Vercel account currently lists only `orora` and `tradmentor`. **It does not expose a STRYV Lab project**, so the running deployment's configured `NEXT_PUBLIC_SUPABASE_URL` could not be verified against the connected Supabase project ref. The GitHub tree alone cannot establish the live environment's database identity.

The reviewed repository's `main` branch was last pushed on 2026-07-23. The connected `STRYVR` database migration history includes migrations later than that date (e.g. 2026-10-02). This is a **strong reason to reconcile deploy/source/database drift**, not proof that either one is wrong.

Before turning a review script into a deployable migration:
1. Connect the Vercel account/team that actually owns `stryvlab.com` to ChatGPT, or inspect its project in the official Vercel dashboard with an authorized administrator.
2. Read only the **hostname/ref** part of the `NEXT_PUBLIC_SUPABASE_URL` production environment variable; never send/print the anonymous key, service-role key, tokens, or full env dumps.
3. Compare that project ref to connected Supabase projects and verify production and preview separately.
4. Determine whether the correct canonical Git branch matches the currently deployed commit.
5. Reconcile migration history against this environment and run a dry-run regression suite on an isolated staging clone.
6. Only then prepare an approved migration, backup, and deploy plan.

### Known server-side call sites reviewed
- `lib/rewards/progression.ts` calls `award_client_progression` on its supplied database client. Verify every caller uses a server-authorized client.
- `app/api/client/rewards/redeem/route.ts` and `app/api/coach/rewards/redemptions/route.ts` call `redeem_client_reward` / `cancel_client_reward_redemption` through a service-role database client after their application-side authorization checks.
- These samples **do not constitute exhaustive verification of all RPC callers**.

### Review gates
- No changes to production or the connected Supabase database have been made.
- No claim of passed integration tests, resolved warnings, or regulatory compliance.
- PR remains **draft** and **must not be merged** as a security fix while deployment identity and callers remain unverified.

## Production project identity confirmed — 2026-10-11

The Vercel account owning STRYV Lab has now been connected and inspected:
- Team: `stryvlabs-projects`; Vercel project: `stryvlab`.
- Verified production domains: `www.stryvlab.com` and `stryvlab.com` (redirect).
- Production-target Vercel deployment records point to `stryvrcoaching/STRYVLAB`, commit `caa901055bcb4687b4dcdbb9465f8e1a49aaf302`.
- The configured `NEXT_PUBLIC_SUPABASE_URL` for the production-targeted environment resolves to project ref **`gdwboxpscwdvfrnxlnvb`**, the same connected Supabase project where privileged function grants were independently inspected.
- No API keys, service-role credentials, or other secrets were accessed for this identification.

**Updated conclusion:** the 12 flagged `SECURITY DEFINER` grants are present in STRYV Lab's configured production database. They are not merely a potentially unrelated project. Their operational impact still requires safe staging tests; no exploitation or DDL writes have been attempted.

**Note:** Vercel's `latestDeployment` property currently shows a preview generated from this review branch; do not mistake preview status `READY` for production release. The PR is draft, no migration is applied, and the original audit's open questions about RPC call sites and staging remain.
