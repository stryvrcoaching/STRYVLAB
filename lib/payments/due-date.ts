/**
 * Payment due-date helpers — local calendar dates (YYYY-MM-DD), never UTC midnight.
 */

/** Today as YYYY-MM-DD in the runtime's local timezone. */
export function localIsoDate(from: Date = new Date()): string {
  const y = from.getFullYear()
  const m = String(from.getMonth() + 1).padStart(2, '0')
  const d = String(from.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Add calendar days to a YYYY-MM-DD (or Date) and return YYYY-MM-DD. */
export function addLocalDays(base: string | Date, days: number): string {
  const date =
    typeof base === 'string'
      ? new Date(
          Number(base.slice(0, 4)),
          Number(base.slice(5, 7)) - 1,
          Number(base.slice(8, 10)),
        )
      : new Date(base.getFullYear(), base.getMonth(), base.getDate())
  date.setDate(date.getDate() + days)
  return localIsoDate(date)
}

/**
 * Default due date when creating a pending payment without an explicit échéance.
 * +7 days gives the coach's J-1 / J-3 / J-7 auto-reminder a real window.
 */
export function defaultPendingDueDate(
  paymentDate?: string | null,
  from: Date = new Date(),
): string {
  const base =
    paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
      ? paymentDate
      : localIsoDate(from)
  // Prefer "from today" so past payment_date doesn't make due already overdue
  const today = localIsoDate(from)
  const start = base < today ? today : base
  return addLocalDays(start, 7)
}

/**
 * Resolve due_date for insert/update:
 * - pending / failed → keep explicit value, else default
 * - paid / refunded → allow null
 */
export function resolvePaymentDueDate(input: {
  status: string
  due_date?: string | null
  payment_date?: string | null
}): string | null {
  if (input.due_date && /^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    return input.due_date
  }
  if (input.status === 'pending' || input.status === 'failed') {
    return defaultPendingDueDate(input.payment_date)
  }
  return input.due_date ?? null
}
