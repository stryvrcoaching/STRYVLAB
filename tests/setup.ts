import { vi } from 'vitest'

// ─── Env vars ────────────────────────────────────────────────
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.INTERNAL_API_SECRET = 'test-internal-secret'

// ─── next/server stub ────────────────────────────────────────
// NextResponse is a standard Response wrapper — use the real one
vi.mock('next/server', async () => {
  const { NextRequest, NextResponse } = await import('./mocks/next-server')
  return { NextRequest, NextResponse }
})

// ─── next/headers stub ───────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], setAll: () => {} }),
}))
