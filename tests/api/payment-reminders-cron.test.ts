import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()
const emailMocks = vi.hoisted(() => ({ sendPaymentReminderEmail: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/email/mailer', () => emailMocks)

import { GET } from '@/app/api/cron/payment-reminders/route'

beforeEach(() => {
  mocks.resetMocks()
  emailMocks.sendPaymentReminderEmail.mockReset()
  process.env.CRON_SECRET = 'cron-secret'
})

describe('GET /api/cron/payment-reminders', () => {
  it('accepts the Vercel bearer token and queries payments by due date', async () => {
    mocks.setServiceResults([{ data: [] }, { data: [] }])

    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(res.status).toBe(200)
    const paymentQuery = mocks.serviceMock.from.mock.results[1].value
    expect(paymentQuery.gte).toHaveBeenCalledWith('due_date', expect.any(String))
    expect(paymentQuery.lte).toHaveBeenCalledWith('due_date', expect.any(String))
  })

  it('rejects requests without the cron secret', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders'))

    expect(res.status).toBe(401)
  })

  it('emails and marks a matching pending payment as reminded', async () => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    const date = dueDate.toISOString().slice(0, 10)

    mocks.setServiceResults([
      { data: [{ coach_id: 'coach-1', notif_payment_reminder_days: 3 }] },
      { data: [{ id: 'payment-1', amount_eur: 95, due_date: date, payment_method: 'bank_transfer', coach_id: 'coach-1', client_id: 'client-1', subscription: { formula: { name: 'Coaching mensuel' } } }] },
      { data: { first_name: 'Alex', last_name: 'Martin', email: 'alex@example.com' } },
      { data: null },
    ])
    mocks.serviceMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'coach@example.com', user_metadata: { first_name: 'Sam' } } },
    })

    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 1 })
    expect(emailMocks.sendPaymentReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'alex@example.com',
      coachName: 'Sam',
      dueDate: date,
    }))
    const updateQuery = mocks.serviceMock.from.mock.results[3].value
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ reminder_sent_at: expect.any(String) }))
  })
})
