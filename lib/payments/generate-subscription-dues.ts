import {
  advanceBillingDate,
  billingPeriodLabel,
  isBillingDateDue,
  resolveInitialBillingDate,
  type BillingCycle,
} from '@/lib/payments/billing-cycle'
import { localIsoDate } from '@/lib/payments/due-date'

export type SubscriptionForBilling = {
  id: string
  coach_id: string
  client_id: string
  status: string
  start_date: string
  end_date: string | null
  next_billing_date: string | null
  price_override_eur: number | null
  formula?: {
    id: string
    name: string
    price_eur: number
    billing_cycle: BillingCycle | string
    is_active?: boolean
  } | null
}

export type PlannedDue = {
  subscriptionId: string
  coachId: string
  clientId: string
  amountEur: number
  dueDate: string
  description: string
  formulaName: string
  billingCycle: BillingCycle
}

export type SubBillingUpdate = {
  subscriptionId: string
  nextBillingDate: string | null
}

export type GenerateDuesOptions = {
  /** Create dues this many days before due (so J-N reminders work). Default 7. */
  leadDays?: number
  /** Cap catch-up periods per subscription per run. Default 3. */
  maxPeriodsPerSub?: number
  today?: string
}

/**
 * Pure planner: payments to create + next_billing_date updates.
 */
export function planSubscriptionDues(
  subscriptions: SubscriptionForBilling[],
  existingDueDatesBySub: Record<string, string[]>,
  options: GenerateDuesOptions = {},
): {
  payments: PlannedDue[]
  updates: SubBillingUpdate[]
  skipped: number
} {
  const leadDays = options.leadDays ?? 7
  const maxPeriods = options.maxPeriodsPerSub ?? 3
  const today = options.today ?? localIsoDate()

  const payments: PlannedDue[] = []
  const updates: SubBillingUpdate[] = []
  let skipped = 0

  for (const sub of subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'trial') {
      skipped++
      continue
    }
    const formula = sub.formula
    if (!formula || formula.is_active === false) {
      skipped++
      continue
    }

    const cycle = (formula.billing_cycle || 'monthly') as BillingCycle
    const amount = Number(
      sub.price_override_eur != null && Number(sub.price_override_eur) > 0
        ? sub.price_override_eur
        : formula.price_eur,
    )
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++
      continue
    }

    const existing = new Set(existingDueDatesBySub[sub.id] ?? [])
    let cursor =
      sub.next_billing_date && /^\d{4}-\d{2}-\d{2}$/.test(sub.next_billing_date)
        ? sub.next_billing_date
        : resolveInitialBillingDate(sub.start_date, today)

    // If due is beyond lead window, only seed next_billing when missing
    if (!isBillingDateDue(cursor, today, leadDays)) {
      if (!sub.next_billing_date) {
        updates.push({ subscriptionId: sub.id, nextBillingDate: cursor })
      }
      continue
    }

    let periods = 0
    let finalNext: string | null = cursor

    while (periods < maxPeriods && isBillingDateDue(cursor, today, leadDays)) {
      if (sub.end_date && cursor > sub.end_date) {
        finalNext = null
        break
      }

      if (!existing.has(cursor)) {
        payments.push({
          subscriptionId: sub.id,
          coachId: sub.coach_id,
          clientId: sub.client_id,
          amountEur: amount,
          dueDate: cursor,
          description: `${formula.name} — ${billingPeriodLabel(cursor)}`,
          formulaName: formula.name,
          billingCycle: cycle,
        })
        existing.add(cursor)
      }

      const advanced = advanceBillingDate(cursor, cycle)
      if (advanced && sub.end_date && advanced > sub.end_date) {
        finalNext = null
      } else {
        finalNext = advanced
      }
      periods++
      if (!advanced || cycle === 'one_time' || finalNext === null) break
      cursor = advanced
    }

    if (
      periods > 0 ||
      finalNext !== sub.next_billing_date ||
      !sub.next_billing_date
    ) {
      updates.push({ subscriptionId: sub.id, nextBillingDate: finalNext })
    }
  }

  return { payments, updates, skipped }
}

/**
 * Run generation against Supabase service client.
 */
export async function runGenerateSubscriptionDues(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  options: GenerateDuesOptions & { coachId?: string } = {},
): Promise<{
  created: number
  advanced: number
  skipped: number
  errors: string[]
}> {
  const today = options.today ?? localIsoDate()
  const leadDays = options.leadDays ?? 7

  let query = db
    .from('client_subscriptions')
    .select(
      `
      id, coach_id, client_id, status, start_date, end_date, next_billing_date, price_override_eur,
      formula:coach_formulas(id, name, price_eur, billing_cycle, is_active)
    `,
    )
    .in('status', ['active', 'trial'])

  if (options.coachId) {
    query = query.eq('coach_id', options.coachId)
  }

  const { data: subscriptions, error } = await query
  if (error) throw new Error(error.message)

  const subs = (subscriptions ?? []) as SubscriptionForBilling[]
  if (subs.length === 0) {
    return { created: 0, advanced: 0, skipped: 0, errors: [] }
  }

  const subIds = subs.map((s) => s.id)
  const { data: existingPayments } = await db
    .from('subscription_payments')
    .select('subscription_id, due_date, status')
    .in('subscription_id', subIds)
    .not('due_date', 'is', null)
    .in('status', ['pending', 'paid', 'failed'])

  const existingDueDatesBySub: Record<string, string[]> = {}
  for (const p of existingPayments ?? []) {
    if (!p.subscription_id || !p.due_date) continue
    if (!existingDueDatesBySub[p.subscription_id]) {
      existingDueDatesBySub[p.subscription_id] = []
    }
    existingDueDatesBySub[p.subscription_id].push(p.due_date)
  }

  const { payments, updates, skipped } = planSubscriptionDues(
    subs,
    existingDueDatesBySub,
    {
      leadDays,
      maxPeriodsPerSub: options.maxPeriodsPerSub ?? 3,
      today,
    },
  )

  let created = 0
  let advanced = 0
  const errors: string[] = []

  for (const item of payments) {
    try {
      const { error: insertError } = await db.from('subscription_payments').insert({
        coach_id: item.coachId,
        client_id: item.clientId,
        subscription_id: item.subscriptionId,
        amount_eur: item.amountEur,
        status: 'pending',
        payment_method: 'manual',
        payment_date: today,
        due_date: item.dueDate,
        description: item.description,
        reference: `auto-${item.subscriptionId.slice(0, 8)}-${item.dueDate}`,
      })
      if (insertError) {
        errors.push(`${item.subscriptionId}:${item.dueDate}:${insertError.message}`)
      } else {
        created++
      }
    } catch (err) {
      errors.push(
        `${item.subscriptionId}:${err instanceof Error ? err.message : 'insert failed'}`,
      )
    }
  }

  for (const upd of updates) {
    try {
      const { error: updError } = await db
        .from('client_subscriptions')
        .update({
          next_billing_date: upd.nextBillingDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', upd.subscriptionId)
      if (updError) {
        errors.push(`${upd.subscriptionId}:next:${updError.message}`)
      } else {
        advanced++
      }
    } catch (err) {
      errors.push(
        `${upd.subscriptionId}:next:${err instanceof Error ? err.message : 'update failed'}`,
      )
    }
  }

  return { created, advanced, skipped, errors }
}
