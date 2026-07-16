export type ProgramCompletionBehavior = 'repeat' | 'hold_last' | 'stop'

export interface ProgramCycleScheduleInput {
  dateIso: string
  startDateIso: string
  explicitWeekCount: number
  durationWeeks?: number | null
  completionBehavior?: ProgramCompletionBehavior
}

export interface ProgramCycleSchedule {
  elapsedWeekIndex: number
  activeWeekPosition: number | null
  cycleIteration: number
  isBeforeStart: boolean
  isComplete: boolean
}

export interface ExplicitProgramWeek {
  id: string
  position: number
}

export interface WeekScopedSession {
  program_week_id?: string | null
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

function parseIsoDate(value: string): number {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  const parsed = new Date(timestamp)
  if (
    !Number.isFinite(timestamp) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  return timestamp
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : null
}

export function resolveProgramCycleSchedule({
  dateIso,
  startDateIso,
  explicitWeekCount,
  durationWeeks,
  completionBehavior = 'repeat',
}: ProgramCycleScheduleInput): ProgramCycleSchedule {
  const dateTimestamp = parseIsoDate(dateIso)
  const startTimestamp = parseIsoDate(startDateIso)
  const elapsedDays = Math.floor((dateTimestamp - startTimestamp) / DAY_MS)
  const isBeforeStart = elapsedDays < 0
  const elapsedWeekIndex = isBeforeStart ? -1 : Math.floor(elapsedDays / 7)
  const normalizedWeekCount = normalizePositiveInteger(explicitWeekCount) ?? 0
  const normalizedDuration = normalizePositiveInteger(durationWeeks)
  const isComplete = normalizedDuration != null && elapsedWeekIndex >= normalizedDuration

  if (isBeforeStart || normalizedWeekCount === 0) {
    return {
      elapsedWeekIndex,
      activeWeekPosition: null,
      cycleIteration: 0,
      isBeforeStart,
      isComplete: false,
    }
  }

  if (isComplete && completionBehavior === 'stop') {
    return {
      elapsedWeekIndex,
      activeWeekPosition: null,
      cycleIteration: Math.floor(elapsedWeekIndex / normalizedWeekCount),
      isBeforeStart: false,
      isComplete: true,
    }
  }

  if (isComplete && completionBehavior === 'hold_last') {
    return {
      elapsedWeekIndex,
      activeWeekPosition: normalizedWeekCount - 1,
      cycleIteration: Math.max(0, Math.floor((normalizedDuration! - 1) / normalizedWeekCount)),
      isBeforeStart: false,
      isComplete: true,
    }
  }

  return {
    elapsedWeekIndex,
    activeWeekPosition: elapsedWeekIndex % normalizedWeekCount,
    cycleIteration: Math.floor(elapsedWeekIndex / normalizedWeekCount),
    isBeforeStart: false,
    isComplete,
  }
}

export function selectSessionsForProgramWeek<T extends WeekScopedSession>(
  sessions: T[],
  weeks: ExplicitProgramWeek[],
  activeWeekPosition: number | null,
): T[] {
  if (weeks.length === 0) return sessions
  if (activeWeekPosition == null) return []

  const activeWeek = weeks.find((week) => week.position === activeWeekPosition)
  if (!activeWeek) return []
  return sessions.filter((session) => session.program_week_id === activeWeek.id)
}
