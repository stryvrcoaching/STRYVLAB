import { addLocalDays, localIsoDate } from '@/lib/payments/due-date'

export type BillingCycle = 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

const MONTH_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

/** Advance a YYYY-MM-DD by one billing cycle. one_time → null. */
export function advanceBillingDate(
  isoDate: string,
  cycle: BillingCycle,
): string | null {
  if (cycle === 'one_time') return null
  if (cycle === 'weekly') return addLocalDays(isoDate, 7)

  const y = Number(isoDate.slice(0, 4))
  const m = Number(isoDate.slice(5, 7)) - 1
  const d = Number(isoDate.slice(8, 10))
  const date = new Date(y, m, d)

  const months =
    cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : 0
  if (!months) return null

  // Keep day-of-month when possible (e.g. 31 → last day of shorter months)
  const targetMonth = date.getMonth() + months
  const target = new Date(date.getFullYear(), targetMonth, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return localIsoDate(target)
}

/** Human period label for a due date, e.g. "Mars 2026". */
export function billingPeriodLabel(isoDate: string): string {
  const m = Number(isoDate.slice(5, 7)) - 1
  const y = isoDate.slice(0, 4)
  return `${MONTH_FR[m] ?? isoDate.slice(5, 7)} ${y}`
}

/**
 * Resolve the next billing date when the subscription has none yet.
 * - Prefer start_date if still upcoming
 * - Else today (catch-up)
 */
export function resolveInitialBillingDate(
  startDate: string | null | undefined,
  today: string = localIsoDate(),
): string {
  if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && startDate >= today) {
    return startDate
  }
  return today
}

/**
 * Whether we should generate a due for this billing date given a lead window.
 * Generates when due is already past (catch-up) or within [today, today+leadDays].
 */
export function isBillingDateDue(
  billingDate: string,
  today: string,
  leadDays: number,
): boolean {
  if (!billingDate) return false
  const horizon = addLocalDays(today, leadDays)
  return billingDate <= horizon
}
