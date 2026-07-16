import {
  type CheckinFlowType,
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  findUtcForLocalTime,
  isWithinBacklogWindow,
} from '@/lib/client/checkin/timeWindows'

export type CompletedSession = { flow_type: string; completed_at: string | null; date?: string }

export type PendingSlot = {
  date: string
  flow_type: CheckinFlowType
}

export type CheckinSchedule = {
  flow_type: CheckinFlowType
  scheduled_time: string
}

export type CheckinAvailability = {
  active: boolean
  daysOfWeek: number[]
  schedules: CheckinSchedule[]
}

export function createCheckinAvailability(
  config: { is_active?: boolean | null; days_of_week?: number[] | null } | null | undefined,
  schedules: Array<{ moment: string; scheduled_time: string }> | null | undefined,
): CheckinAvailability {
  return {
    active: Boolean(config?.is_active),
    daysOfWeek: Array.isArray(config?.days_of_week) ? config.days_of_week : [],
    schedules: (schedules ?? [])
      .filter((schedule): schedule is { moment: CheckinFlowType; scheduled_time: string } =>
        schedule.moment === 'morning' || schedule.moment === 'evening',
      )
      .map((schedule) => ({
        flow_type: schedule.moment,
        scheduled_time: String(schedule.scheduled_time).slice(0, 5),
      })),
  }
}

const DEFAULT_SCHEDULED_TIME: Record<CheckinFlowType, string> = {
  morning: '05:00',
  evening: '21:00',
}

function scheduledMinutes(schedule: string | undefined, flowType: CheckinFlowType): number {
  const [hour, minute] = (schedule ?? DEFAULT_SCHEDULED_TIME[flowType]).slice(0, 5).split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return flowType === 'morning' ? 5 * 60 : 21 * 60
  }
  return Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute))
}

function mondayBasedWeekday(dateKey: string): number {
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()
  return weekday === 0 ? 6 : weekday - 1
}

function isScheduledForDate(
  dateKey: string,
  flowType: CheckinFlowType,
  availability?: CheckinAvailability,
): boolean {
  if (!availability) return true
  if (!availability.active || !availability.daysOfWeek.includes(mondayBasedWeekday(dateKey))) return false
  return availability.schedules.some((schedule) => schedule.flow_type === flowType)
}

function slotOpensAtConfiguredTime(
  dateKey: string,
  flowType: CheckinFlowType,
  timezone: string,
  availability?: CheckinAvailability,
): Date {
  const schedule = availability?.schedules.find((item) => item.flow_type === flowType)?.scheduled_time
  const minutes = scheduledMinutes(schedule, flowType)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  return findUtcForLocalTime(dateKey, hour, minute, timezone)
    ?? new Date(`${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`)
}

function isCompleted(
  date: string,
  flowType: CheckinFlowType,
  sessions: CompletedSession[],
): boolean {
  return sessions.some(
    s => s.flow_type === flowType && s.completed_at != null && (s.date == null || s.date === date),
  )
}

function slotSortKey(slot: PendingSlot): string {
  return `${slot.date}:${slot.flow_type === 'morning' ? '0' : '1'}`
}

/** Up to 2 incomplete check-ins within the last 24h per slot open time. */
export function getPendingSlots(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
  availability?: CheckinAvailability,
): PendingSlot[] {
  const todayKey = computePhysiologicalDateInTimezone(now, timezone)
  const yesterdayKey = addDaysToDateKey(todayKey, -1)

  const candidates: PendingSlot[] = []
  for (const date of [yesterdayKey, todayKey]) {
    for (const flow_type of ['morning', 'evening'] as const) {
      if (!isScheduledForDate(date, flow_type, availability)) continue
      if (isCompleted(date, flow_type, sessions)) continue
      const openedAt = availability
        ? slotOpensAtConfiguredTime(date, flow_type, timezone, availability)
        : null
      const ageMs = openedAt ? now.getTime() - openedAt.getTime() : null
      if (openedAt ? ageMs == null || ageMs < 0 || ageMs > 24 * 60 * 60 * 1000 : !isWithinBacklogWindow(now, date, flow_type, timezone)) continue
      candidates.push({ date, flow_type })
    }
  }

  candidates.sort((a, b) => slotSortKey(a).localeCompare(slotSortKey(b)))
  return candidates.slice(-2)
}

export function countPendingSlots(
  now: Date,
  timezone: string,
  sessions: CompletedSession[],
  availability?: CheckinAvailability,
): number {
  return getPendingSlots(now, timezone, sessions, availability).length
}
