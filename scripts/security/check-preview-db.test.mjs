import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyPreviewDatabaseIsolation } from './check-preview-db.mjs'

const productionUrl = 'https://gdwboxpscwdvfrnxlnvb.supabase.co'
const stagingUrl = 'https://abcdefghijklmnopqrst.supabase.co'

// Only fictional account names / fake passwords in this test suite.
test('preview must not use STRYV Lab production Supabase', () => {
  assert.throws(
    () => verifyPreviewDatabaseIsolation({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: productionUrl }),
    /preview deployment blocked/,
  )
})

test('preview must not use production Postgres via DATABASE_URL', () => {
  assert.throws(
    () => verifyPreviewDatabaseIsolation({
      VERCEL_ENV: 'preview',
      NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
      DATABASE_URL: 'postgresql://postgres.gdwboxpscwdvfrnxlnvb:fictional@pooler.supabase.com:5432/postgres',
    }),
    /production Postgres database/,
  )
})

test('preview may use an isolated test project', () => {
  assert.doesNotThrow(() => verifyPreviewDatabaseIsolation({
    VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: stagingUrl,
    DATABASE_URL: 'postgresql://postgres.abcdefghijklmnopqrst:fictional@pooler.supabase.com:5432/postgres',
  }))
})

test('preview fails closed on missing or invalid URL', () => {
  assert.throws(() => verifyPreviewDatabaseIsolation({ VERCEL_ENV: 'preview' }), /requires its own/)
  assert.throws(() => verifyPreviewDatabaseIsolation({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }), /invalid/)
  assert.throws(() => verifyPreviewDatabaseIsolation({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost' }), /HTTPS/)
})

test('production build is not blocked by preview-only gate', () => {
  assert.doesNotThrow(() => verifyPreviewDatabaseIsolation({ VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: productionUrl }))
})
