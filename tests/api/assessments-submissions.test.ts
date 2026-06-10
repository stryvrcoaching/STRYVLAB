import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/email/mailer', () => ({ sendBilanEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications/insert-client-notification', () => ({
  insertClientNotification: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/assessments/submissions/route'
import { NextRequest } from '../mocks/next-server'

beforeEach(() => mocks.resetMocks())

function makeGet(clientId?: string): NextRequest {
  const url = clientId
    ? `http://localhost:3000/api/assessments/submissions?client_id=${clientId}`
    : 'http://localhost:3000/api/assessments/submissions'
  return new NextRequest(url, { method: 'GET' })
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/assessments/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function json(res: Response) { return res.json() }

// ─── GET /api/assessments/submissions ────────────────────────

describe('GET /api/assessments/submissions', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await GET(makeGet())
    expect(res.status).toBe(401)
  })

  it('returns all submissions for the coach', async () => {
    const submissions = [
      { id: 'sub-1', status: 'completed', template: { name: 'Bilan Entrée' }, client: { first_name: 'Jean' } },
      { id: 'sub-2', status: 'pending',   template: { name: 'Check-in Hebdo' }, client: { first_name: 'Marie' } },
    ]
    mocks.setServiceResult(submissions)
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.submissions).toHaveLength(2)
  })

  it('filters submissions by client_id when provided', async () => {
    const submissions = [
      { id: 'sub-1', status: 'completed', client_id: 'client-1', template: { name: 'Bilan' }, client: {} },
    ]
    mocks.setServiceResult(submissions)
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.submissions).toHaveLength(1)
  })

  it('excludes __csv_import__ system submissions', async () => {
    const submissions = [
      { id: 'sub-1', status: 'completed', template: { name: 'Bilan Entrée' }, client: {} },
      { id: 'sub-sys', status: 'completed', template: { name: '__csv_import__' }, client: {} },
    ]
    mocks.setServiceResult(submissions)
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await json(res)
    // __csv_import__ is filtered out
    expect(body.submissions).toHaveLength(1)
    expect(body.submissions[0].id).toBe('sub-1')
  })

  it('returns empty array when no submissions', async () => {
    mocks.setServiceResult([])
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.submissions).toHaveLength(0)
  })

  it('returns 500 on DB error', async () => {
    mocks.setServiceResult(null, { message: 'Query failed' })
    const res = await GET(makeGet())
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/assessments/submissions ───────────────────────

describe('POST /api/assessments/submissions', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(makePost({ client_id: 'c-1', template_id: 't-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when client_id is missing', async () => {
    const res = await POST(makePost({ template_id: 't-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when template_id is missing', async () => {
    const res = await POST(makePost({ client_id: 'c-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when client does not belong to coach', async () => {
    // client lookup → null
    mocks.setServiceResults([{ data: null }])
    const res = await POST(makePost({ client_id: 'c-other', template_id: 't-1' }))
    expect(res.status).toBe(404)
    const body = await json(res)
    expect(body.error).toMatch(/client/i)
  })

  it('returns 404 when template does not belong to coach', async () => {
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.com' } },
      { data: null },  // template lookup → null
    ])
    const res = await POST(makePost({ client_id: 'c-1', template_id: 't-other' }))
    expect(res.status).toBe(404)
    const body = await json(res)
    expect(body.error).toMatch(/template/i)
  })

  it('creates submission and returns 201 with bilan_url', async () => {
    const submission = {
      id: 'sub-new',
      status: 'pending',
      token: 'abc123',
      client_id: 'c-1',
      template_id: 't-1',
    }
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.com' } },
      { data: { id: 't-1', name: 'Bilan Entrée', blocks: [] } },
      { data: submission },
    ])
    const res = await POST(makePost({ client_id: 'c-1', template_id: 't-1' }))
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.submission.id).toBe('sub-new')
    expect(body.bilan_url).toContain('/bilan/')
  })

  it('creates submission with bilan_date when provided', async () => {
    const submission = { id: 'sub-new', status: 'pending', token: 'xyz', client_id: 'c-1' }
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: null } },
      { data: { id: 't-1', name: 'Check-in', blocks: [] } },
      { data: submission },
    ])
    const res = await POST(makePost({ client_id: 'c-1', template_id: 't-1', bilan_date: '2026-04-05' }))
    expect(res.status).toBe(201)
  })

  it('does not throw when send_email is false (no email sent)', async () => {
    const { sendBilanEmail } = await import('@/lib/email/mailer')
    const submission = { id: 'sub-new', status: 'pending', token: 'tok' }
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.com' } },
      { data: { id: 't-1', name: 'Bilan', blocks: [] } },
      { data: submission },
    ])
    await POST(makePost({ client_id: 'c-1', template_id: 't-1', send_email: false }))
    expect(sendBilanEmail).not.toHaveBeenCalled()
  })

  it('sends email when send_email is true and client has email', async () => {
    const { sendBilanEmail } = await import('@/lib/email/mailer')
    const submission = { id: 'sub-new', status: 'pending', token: 'tok123' }
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.com' } },
      { data: { id: 't-1', name: 'Bilan Entrée', blocks: [] } },
      { data: submission },
    ])
    await POST(makePost({ client_id: 'c-1', template_id: 't-1', send_email: true }))
    expect(sendBilanEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'jean@test.com', templateName: 'Bilan Entrée' })
    )
  })

  it('does not send email when client has no email', async () => {
    const { sendBilanEmail } = await import('@/lib/email/mailer')
    const submission = { id: 'sub-new', status: 'pending', token: 'tok' }
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: null } },
      { data: { id: 't-1', name: 'Bilan', blocks: [] } },
      { data: submission },
    ])
    await POST(makePost({ client_id: 'c-1', template_id: 't-1', send_email: true }))
    expect(sendBilanEmail).not.toHaveBeenCalled()
  })

  it('returns 500 on DB insert error', async () => {
    mocks.setServiceResults([
      { data: { id: 'c-1', first_name: 'Jean', last_name: 'Dupont', email: null } },
      { data: { id: 't-1', name: 'Bilan', blocks: [] } },
      { data: null, error: { message: 'Insert failed' } },
    ])
    const res = await POST(makePost({ client_id: 'c-1', template_id: 't-1' }))
    expect(res.status).toBe(500)
  })
})
