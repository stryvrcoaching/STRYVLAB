import type { getLocalTimeParts } from '@/lib/client/checkin/timeWindows'

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const FIVE_MINUTES = 5

export const REMINDER_DEFAULTS = {
  trainingReminderTimes: ['08:00', '18:00'],
  hydrationFirstTime: '09:00',
  hydrationCount: 3,
  breakfastTime: '10:30',
  lunchTime: '14:30',
  proteinTime: '20:00',
} as const

type LocalTime = ReturnType<typeof getLocalTimeParts>

export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function reminderTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function normalizeReminderTime(value: unknown, fallback: string): string {
  return isReminderTime(value) ? value : fallback
}

export function normalizeTrainingReminderTimes(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value.filter(isReminderTime)
    : []
  const unique = Array.from(new Set(values))
    .sort((left, right) => reminderTimeToMinutes(left) - reminderTimeToMinutes(right))
    .slice(0, 2)

  return unique.length > 0 ? unique : [...REMINDER_DEFAULTS.trainingReminderTimes]
}

export function normalizeHydrationReminderCount(value: unknown): number {
  const count = Number(value)
  if (!Number.isInteger(count)) return REMINDER_DEFAULTS.hydrationCount
  return Math.min(10, Math.max(1, count))
}

function roundToFiveMinutes(minutes: number): number {
  return Math.round(minutes / FIVE_MINUTES) * FIVE_MINUTES
}

/**
 * Distributes hydration reminders evenly from the selected first reminder to
 * 21:00, which is the end of the default active physiological day.
 */
export function buildHydrationReminderTimes(
  firstTime: unknown,
  count: unknown,
): string[] {
  const start = reminderTimeToMinutes(
    normalizeReminderTime(firstTime, REMINDER_DEFAULTS.hydrationFirstTime),
  )
  const reminderCount = normalizeHydrationReminderCount(count)
  const dayEnd = 21 * 60

  if (reminderCount === 1 || start >= dayEnd) {
    return [formatReminderTime(start)]
  }

  const interval = (dayEnd - start) / (reminderCount - 1)
  return Array.from({ length: reminderCount }, (_, index) =>
    formatReminderTime(Math.min(dayEnd, roundToFiveMinutes(start + interval * index))),
  ).filter((time, index, all) => index === 0 || all[index - 1] !== time)
}

export function isReminderDue(local: LocalTime, scheduledTime: string): boolean {
  const scheduledMinutes = reminderTimeToMinutes(scheduledTime)
  return local.minutesSinceMidnight >= scheduledMinutes
    && local.minutesSinceMidnight < scheduledMinutes + FIVE_MINUTES
}

export function reminderEventSuffix(time: string): string {
  return time.replace(':', '')
}

function formatReminderTime(minutes: number): string {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes))
  const hour = Math.floor(safeMinutes / 60)
  const minute = safeMinutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
