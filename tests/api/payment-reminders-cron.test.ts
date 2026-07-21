import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'
import { addLocalDays, localIsoDate } from '@/lib/payments/due-date'

const mocks = createSupabaseMocks()
const emailMocks = vi.hoisted(() => ({ sendPaymentReminderEmail: vi.fn() }))
const notifMocks = vi.hoisted(() => ({ createClientAppNotification: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/email/mailer', () => emailMocks)
vi.mock('@/lib/notifications/create-client-app-notification', () => notifMocks)

import { GET } from '@/app/api/cron/payment-reminders/route'

beforeEach(() => {
  mocks.resetMocks()
  emailMocks.sendPaymentReminderEmail.mockReset()
  notifMocks.createClientAppNotification.mockReset()
  notifMocks.createClientAppNotification.mockResolvedValue(undefined)
  process.env.CRON_SECRET = 'cron-secret'
})

describe('GET /api/cron/payment-reminders', () => {
  it('accepts the Vercel bearer token and queries payments by due date', async () => {
    mocks.setServiceResults([{ data: [] }])

    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 0 })
  })

  it('rejects requests without the cron secret', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders'))

    expect(res.status).toBe(401)
  })

  it('emails and marks a matching pending payment as reminded (J-N)', async () => {
    const today = localIsoDate()
    const dueDate = addLocalDays(today, 3)

    mocks.setServiceResults([
      { data: [{ coach_id: 'coach-1', notif_payment_reminder_days: 3 }] },
      {
        data: [
          {
            id: 'payment-1',
            amount_eur: 95,
            due_date: dueDate,
            payment_method: 'bank_transfer',
            coach_id: 'coach-1',
            client_id: 'client-1',
            description: null,
            subscription: { formula: { name: 'Coaching mensuel' } },
          },
        ],
      },
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
    expect(emailMocks.sendPaymentReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alex@example.com',
        coachName: 'Sam',
        dueDate,
      }),
    )
    expect(notifMocks.createClientAppNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientId: 'client-1',
        copyKey: 'payment.reminder',
        type: 'system_reminder',
      }),
    )
    // Last from() for subscription_payments update after email + notif
    const fromCalls = mocks.serviceMock.from.mock.results
    const updateCall = fromCalls
      .map((r: { value: { update: ReturnType<typeof vi.fn> } }) => r.value)
      .find((q: { update: { mock?: { calls: unknown[] } } }) => q.update?.mock?.calls?.length)
    expect(updateCall?.update).toHaveBeenCalledWith(
      expect.objectContaining({ reminder_sent_at: expect.any(String) }),
    )
  })

  it('reminds on due day (J0) even when coach delay is J-3', async () => {
    const today = localIsoDate()

    mocks.setServiceResults([
      { data: [{ coach_id: 'coach-1', notif_payment_reminder_days: 3 }] },
      {
        data: [
          {
            id: 'payment-j0',
            amount_eur: 50,
            due_date: today,
            payment_method: 'stripe',
            coach_id: 'coach-1',
            client_id: 'client-1',
            description: 'Séance',
            subscription: null,
          },
        ],
      },
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
  })

  it('does not remind coaches who disabled payment reminders', async () => {
    // profiles query returns empty when notif_payment_reminder=false
    mocks.setServiceResults([{ data: [] }])

    const res = await GET(new NextRequest('http://localhost:3000/api/cron/payment-reminders', {
      headers: { authorization: 'Bearer cron-secret' },
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sent: 0 })
    expect(emailMocks.sendPaymentReminderEmail).not.toHaveBeenCalled()
  })
})
