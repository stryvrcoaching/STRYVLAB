import { PHYSIOLOGICAL_DAY_CUTOFF_HOUR, PHYSIOLOGICAL_DAY_CUTOFF_MINUTE } from '@/lib/nutrition/physiological-date'
/** Check-in time windows (client local time). Evening spans midnight. */

export const EVENING_START_MIN = 21 * 60 // 21:00
export const EVENING_END_MIN = 4 * 60 + 30 // 04:30
export const MORNING_START_MIN = 5 * 60 // 05:00 — aligns with physiological day cutoff
export const MORNING_END_MIN = 17 * 60 // 17:00

export type CheckinFlowType = 'morning' | 'evening'

export function getLocalTimeParts(date: Date, timezone: string): {
  hour: number
  minute: number
  minutesSinceMidnight: number
  dateKey: string
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const pick = (type: string) =>
    Number(parts.find(p => p.type === type)?.value ?? 0)

  const hour = pick('hour')
  const minute = pick('minute')
  const year = parts.find(p => p.type === 'year')?.value ?? '1970'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  const day = parts.find(p => p.type === 'day')?.value ?? '01'

  return {
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
    dateKey: `${year}-${month}-${day}`,
  }
}

function parseDateKeyUtc(dateKey: string, hour = 12, minute = 0): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, hour, minute, 0, 0))
}

export function getLocalWeekday(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).format(date)

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return map[weekday] ?? 0
}

/** Physiological day cutoff in client timezone. */
export function computePhysiologicalDateInTimezone(input: Date, timezone: string): string {
  const { hour, minute, dateKey } = getLocalTimeParts(input, timezone)
  const minutesSinceMidnight = hour * 60 + minute
  const cutoffMinutes = PHYSIOLOGICAL_DAY_CUTOFF_HOUR * 60 + PHYSIOLOGICAL_DAY_CUTOFF_MINUTE
  if (minutesSinceMidnight < cutoffMinutes) return addDaysToDateKey(dateKey, -1)
  return dateKey
}

export function addDaysToDateKey(dateKey: string, delta: number): string {
  const d = parseDateKeyUtc(dateKey)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function findUtcForLocalTime(
  dateKey: string,
  hour: number,
  minute: number,
  timezone: string,
): Date | null {
  const start = new Date(parseDateKeyUtc(dateKey).getTime() - 36 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + 72 * 60 * 60 * 1000)

  for (let ts = start.getTime(); ts <= end.getTime(); ts += 5 * 60 * 1000) {
    const candidate = new Date(ts)
    const p = getLocalTimeParts(candidate, timezone)
    if (p.dateKey === dateKey && p.hour === hour && p.minute === minute) {
      return candidate
    }
  }

  return null
}

export function utcRangeForLocalDate(
  dateKey: string,
  timezone: string,
): { start: Date; end: Date } {
  const start = findUtcForLocalTime(dateKey, 0, 0, timezone) ?? parseDateKeyUtc(dateKey, 0, 0)
  const nextDateKey = addDaysToDateKey(dateKey, 1)
  const nextStart =
    findUtcForLocalTime(nextDateKey, 0, 0, timezone)
    ?? new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return {
    start,
    end: new Date(nextStart.getTime() - 1),
  }
}

export function utcRangeForPhysiologicalDate(
  dateKey: string,
  timezone: string,
  cutoffHour = PHYSIOLOGICAL_DAY_CUTOFF_HOUR,
  cutoffMinute = PHYSIOLOGICAL_DAY_CUTOFF_MINUTE,
): { start: Date; end: Date } {
  const start =
    findUtcForLocalTime(dateKey, cutoffHour, cutoffMinute, timezone)
    ?? parseDateKeyUtc(dateKey, cutoffHour, cutoffMinute)
  const nextDateKey = addDaysToDateKey(dateKey, 1)
  const nextStart =
    findUtcForLocalTime(nextDateKey, cutoffHour, cutoffMinute, timezone)
    ?? new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return {
    start,
    end: new Date(nextStart.getTime() - 1),
  }
}

export function isInEveningWindow(date: Date, timezone: string): boolean {
  const { minutesSinceMidnight: m } = getLocalTimeParts(date, timezone)
  return m >= EVENING_START_MIN || m <= EVENING_END_MIN
}

export function isInMorningWindow(date: Date, timezone: string): boolean {
  const { minutesSinceMidnight: m } = getLocalTimeParts(date, timezone)
  return m >= MORNING_START_MIN && m <= MORNING_END_MIN
}

export function activeWindowAt(date: Date, timezone: string): CheckinFlowType | null {
  if (isInEveningWindow(date, timezone)) return 'evening'
  if (isInMorningWindow(date, timezone)) return 'morning'
  return null
}

/** When a slot becomes available (local), for 24h backlog cutoff. */
export function slotOpensAt(dateKey: string, flowType: CheckinFlowType, timezone: string): Date {
  const targetHour = flowType === 'evening' ? 21 : 5
  const targetMinute = 0
  const start = new Date(`${dateKey}T00:00:00.000Z`)
  for (let i = 0; i < 24 * 60; i++) {
    const candidate = new Date(start.getTime() + i * 60_000)
    const p = getLocalTimeParts(candidate, timezone)
    if (p.dateKey !== dateKey) continue
    if (p.hour === targetHour && p.minute === targetMinute) return candidate
  }
  return new Date(`${dateKey}T12:00:00.000Z`)
}

export function hasSlotStarted(
  now: Date,
  dateKey: string,
  flowType: CheckinFlowType,
  timezone: string,
): boolean {
  const todayKey = computePhysiologicalDateInTimezone(now, timezone)
  const yesterdayKey = addDaysToDateKey(todayKey, -1)

  if (dateKey !== todayKey && dateKey !== yesterdayKey) return false
  if (dateKey === yesterdayKey) return true

  const { minutesSinceMidnight: m } = getLocalTimeParts(now, timezone)
  if (flowType === 'morning') return m >= MORNING_START_MIN
  return m >= EVENING_START_MIN || m <= EVENING_END_MIN
}

export function isWithinBacklogWindow(
  now: Date,
  dateKey: string,
  flowType: CheckinFlowType,
  timezone: string,
): boolean {
  if (!hasSlotStarted(now, dateKey, flowType, timezone)) return false
  const opened = slotOpensAt(dateKey, flowType, timezone)
  const ageMs = now.getTime() - opened.getTime()
  return ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000
}
