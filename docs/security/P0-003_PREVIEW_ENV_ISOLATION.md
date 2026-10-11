# P0-003 — Isolate STRYV Lab Vercel previews from production Supabase

## Confirmed configuration (read-only, 2026-10-11)
- Vercel team `stryvlabs-projects`, project `stryvlab` owns verified domains `www.stryvlab.com` and `stryvlab.com`.
- Production `NEXT_PUBLIC_SUPABASE_URL` resolves to `gdwboxpscwdvfrnxlnvb`, the connected Supabase production project.
- The **same Vercel environment-variable entry** for `NEXT_PUBLIC_SUPABASE_URL` applies to `development`, `preview`, and `production`.
- The single `SUPABASE_SERVICE_ROLE_KEY` entry applies to `preview` and `production`.
- This means preview builds are configured with a production backend and elevated credentials. Actual data writes from previews were **not tested** and must not be attempted.

## Draft PR behavior
- `pnpm build` runs `scripts/security/check-preview-db.mjs` before `next build`.
- When `VERCEL_ENV=preview`, the build rejects the known production Supabase REST endpoint, a production database DSN, missing preview Supabase URL or insecure/malformed URL.
- The build check does **not** read, print or compare secret key values. It does **not** prevent runtime access through newly introduced alternative database clients, nor does it protect previews built from old commits.
- Production builds (`VERCEL_ENV=production`) are not blocked by this check.
- Local offline tests: `node --test scripts/security/check-preview-db.test.mjs` (no database/network/secrets required).

## Before approving / merging
1. **Do not use current preview URLs for destructive tests.** Existing preview builds may still point at production.
2. Create a dedicated **empty** Supabase development branch or isolated QA project with no customer data, **after approval of any costs**.
3. Configure separate `preview` entries on Vercel for at least:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`, if the application needs direct Postgres connections.
   Use credentials generated for the isolated project. Do not paste credentials into GitHub, PR comments, logs, or chats.
4. Restrict the old production values to the `production` target only. Review any other environment keys with production side effects: Stripe, email, WhatsApp, webhooks, cron, OpenAI and storage.
5. Keep cron or scheduled jobs disabled in preview and use only fictional users and records.
6. Confirm build gate refuses the production ref in preview and succeeds with the isolated ref; execute functional tests there.
7. Check all application database clients and serverless jobs use the correct environment (a pre-build check is just one defensive layer).
8. After an approved merge and preview environment migration, recheck Vercel preview deployments and the Supabase branch.

## Limits
- The check only applies to new builds containing this code. Do not assume it protects existing deployed previews.
- It guards the configured `NEXT_PUBLIC_SUPABASE_URL` and recognized direct/pooler `DATABASE_URL` formats; additional provider-specific clients may need equivalent checks.
- No Vercel environment variable was changed, no Supabase branch was created, and no production data was accessed or modified.
