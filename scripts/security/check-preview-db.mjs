import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Public, non-secret Supabase project reference used by STRYV Lab production.
export const PRODUCTION_SUPABASE_REF = 'gdwboxpscwdvfrnxlnvb'

function productionReferenceInDatabaseUrl(rawValue) {
  if (!rawValue) return false
  try {
    const databaseUrl = new URL(rawValue)
    // Supabase supports direct db.<ref>.supabase.co and pooler URLs with
    // usernames such as postgres.<ref>; check both without printing secrets.
    return (
      databaseUrl.hostname === `db.${PRODUCTION_SUPABASE_REF}.supabase.co` ||
      databaseUrl.username.endsWith(`.${PRODUCTION_SUPABASE_REF}`)
    )
  } catch {
    // A malformed DSN must not be allowed to pass an isolation gate.
    throw new Error('P0-003: invalid DATABASE_URL configured for preview')
  }
}

export function verifyPreviewDatabaseIsolation(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return

  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('P0-003: preview requires its own NEXT_PUBLIC_SUPABASE_URL')
  }

  let supabaseUrl
  try {
    supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
  } catch {
    throw new Error('P0-003: invalid NEXT_PUBLIC_SUPABASE_URL for preview')
  }

  if (supabaseUrl.protocol !== 'https:') {
    throw new Error('P0-003: preview Supabase API URL must use HTTPS')
  }

  if (supabaseUrl.hostname === `${PRODUCTION_SUPABASE_REF}.supabase.co`) {
    throw new Error('P0-003: preview deployment blocked: production Supabase project is configured')
  }

  if (productionReferenceInDatabaseUrl(env.DATABASE_URL)) {
    throw new Error('P0-003: preview deployment blocked: production Postgres database is configured')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    verifyPreviewDatabaseIsolation()
  } catch (error) {
    // Never print URL values, connection strings, passwords or keys.
    console.error(error instanceof Error ? error.message : 'P0-003: preview isolation check failed')
    process.exitCode = 1
  }
}
