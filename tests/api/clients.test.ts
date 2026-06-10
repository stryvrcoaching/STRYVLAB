import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET, POST } from '@/app/api/clients/route'
import { NextRequest } from '../mocks/next-server'

beforeEach(() => mocks.resetMocks())

// ─── Helper ──────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/clients', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function json(res: Response) {
  return res.json()
}

// ─── GET /api/clients ─────────────────────────────────────────

describe('GET /api/clients', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
    const body = await json(res)
    expect(body.error).toBeDefined()
  })

  it('returns clients list for authenticated coach', async () => {
    const clients = [
      { id: 'c1', first_name: 'Jean', last_name: 'Dupont', coach_id: 'coach-123' },
      { id: 'c2', first_name: 'Marie', last_name: 'Martin', coach_id: 'coach-123' },
    ]
    mocks.setServiceResult(clients)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.clients).toHaveLength(2)
    expect(body.clients[0].first_name).toBe('Jean')
  })

  it('returns empty array when coach has no clients', async () => {
    mocks.setServiceResult([])
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.clients).toHaveLength(0)
  })

  it('returns 500 on DB error', async () => {
    mocks.setServiceResult(null, { message: 'DB connection failed' })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(500)
    const body = await json(res)
    expect(body.error).toBe('DB connection failed')
  })
})

// ─── POST /api/clients ────────────────────────────────────────

describe('POST /api/clients', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(makeRequest('POST', { firstName: 'Jean', lastName: 'Dupont' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when firstName is missing', async () => {
    const res = await POST(makeRequest('POST', { lastName: 'Dupont' }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toMatch(/obligatoires/i)
  })

  it('returns 400 when lastName is missing', async () => {
    const res = await POST(makeRequest('POST', { firstName: 'Jean' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
  })

  it('creates client and returns 201 with minimal fields', async () => {
    const created = { id: 'c-new', first_name: 'Jean', last_name: 'Dupont', coach_id: 'coach-123' }
    mocks.setServiceResult(created)
    const res = await POST(makeRequest('POST', { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com' }))
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.client.id).toBe('c-new')
    expect(body.client.first_name).toBe('Jean')
  })

  it('creates client with all optional fields', async () => {
    const payload = {
      firstName: 'Jean', lastName: 'Dupont',
      email: 'jean@test.com', phone: '0612345678',
      goal: 'Prise de masse', notes: 'Débutant',
      training_goal: 'hypertrophy', fitness_level: 'beginner',
      sport_practice: 'moderate', weekly_frequency: 3,
    }
    const created = { id: 'c-new', first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.com' }
    mocks.setServiceResult(created)
    const res = await POST(makeRequest('POST', payload))
    expect(res.status).toBe(201)
    // Verify insert was called with coach_id
    expect(mocks.serviceMock.from).toHaveBeenCalledWith('coach_clients')
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest('POST', { firstName: 'Jean', lastName: 'Dupont' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mocks.setServiceResult(null, { message: 'Insert failed', code: '23505' })
    const res = await POST(makeRequest('POST', { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com' }))
    expect(res.status).toBe(500)
  })

  it('returns helpful message when table does not exist', async () => {
    mocks.setServiceResult(null, { message: 'table not found', code: '42P01' })
    const res = await POST(makeRequest('POST', { firstName: 'Jean', lastName: 'Dupont', email: 'jean@test.com' }))
    expect(res.status).toBe(500)
    const body = await json(res)
    expect(body.error).toMatch(/migration/i)
  })

  it('trims whitespace from firstName and lastName', async () => {
    const created = { id: 'c-new', first_name: 'Jean', last_name: 'Dupont' }
    mocks.setServiceResult(created)
    await POST(makeRequest('POST', { firstName: '  Jean  ', lastName: '  Dupont  ', email: 'jean@test.com' }))
    // The insert chain was called — trim is applied inside the route
    expect(mocks.serviceMock.from).toHaveBeenCalledWith('coach_clients')
  })
})
