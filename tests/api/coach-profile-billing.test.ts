import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { PATCH } from '@/app/api/coach/profile/route'

beforeEach(() => mocks.resetMocks())

describe('PATCH /api/coach/profile', () => {
  it('persists the legal billing profile fields', async () => {
    mocks.setServiceResult({
      coach_id: 'coach-123',
      company_name: 'STRYV Coaching SRL',
      billing_country: 'BE',
      business_registration_number: '0123.456.789',
      vat_number: 'BE0123456789',
      address: 'Rue Exemple 12\n1000 Bruxelles\nBelgique',
    })

    const res = await PATCH(new NextRequest('http://localhost:3000/api/coach/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        company_name: 'STRYV Coaching SRL',
        billing_country: 'BE',
        business_registration_number: '0123.456.789',
        vat_number: 'BE0123456789',
        address: 'Rue Exemple 12\n1000 Bruxelles\nBelgique',
      }),
    }))

    expect(res.status).toBe(200)
    const builder = mocks.serviceMock.from.mock.results[0].value
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        coach_id: 'coach-123',
        company_name: 'STRYV Coaching SRL',
        billing_country: 'BE',
        business_registration_number: '0123.456.789',
        vat_number: 'BE0123456789',
      }),
      { onConflict: 'coach_id' },
    )
  })

  it('rejects an invalid country code', async () => {
    const res = await PATCH(new NextRequest('http://localhost:3000/api/coach/profile', {
      method: 'PATCH',
      body: JSON.stringify({ billing_country: 'Belgique' }),
    }))

    expect(res.status).toBe(400)
  })
})
