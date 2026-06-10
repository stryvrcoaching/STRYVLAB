/**
 * Streak evaluation rules:
 * - Streak increments only on days configured in days_of_week (0=Mon … 6=Sun)
 * - Check-in before midnight = +10 pts, streak +1
 * - Check-in 00h00–02h00 next day = is_late=true, +5 pts, streak preserved (not incremented)
 * - Miss a configured day = streak reset to 0
 */

export type StreakState = {
  current_streak: number
  longest_streak: number
  last_checkin_date: string | null // ISO date 'YYYY-MM-DD'
}

/**
 * Determines if a checkin date (YYYY-MM-DD in client's local timezone)
 * is within the grace window (00h–02h of the day after last_checkin_date).
 * This is evaluated before calling evaluateStreak.
 */
export function isLateCheckin(
  respondedAt: Date,
  scheduledDate: string // YYYY-MM-DD — the date the checkin was meant for
): boolean {
  const scheduled = new Date(scheduledDate + 'T23:59:59Z')
  const graceEnd = new Date(scheduledDate + 'T02:00:00Z')
  graceEnd.setDate(graceEnd.getDate() + 1)
  return respondedAt > scheduled && respondedAt <= graceEnd
}

/**
 * Evaluates new streak state after a check-in.
 *
 * @param current  - existing streak state from client_streaks
 * @param checkinDate - YYYY-MM-DD of the day this check-in counts for
 * @param isLate  - true if submitted in grace window (00h–02h next day)
 * @param daysOfWeek - configured active days [0=Mon…6=Sun]
 */
export function evaluateStreak(
  current: StreakState,
  checkinDate: string,
  isLate: boolean,
  daysOfWeek: number[]
): StreakState {
  const today = new Date(checkinDate)
  const last = current.last_checkin_date ? new Date(current.last_checkin_date) : null

  // If already checked in today (or late for today), no change
  if (last && formatDate(last) === checkinDate) {
    return current
  }

  let newStreak = current.current_streak

  if (last === null) {
    // First ever check-in
    newStreak = isLate ? current.current_streak : 1
  } else {
    const daysBetween = daysDiff(last, today)

    if (daysBetween === 1) {
      // Consecutive day — increment only if on-time
      newStreak = isLate ? current.current_streak : current.current_streak + 1
    } else {
      // Check if all days between last and today were non-configured days
      const skippedConfigured = hasSkippedConfiguredDay(last, today, daysOfWeek)
      if (skippedConfigured) {
        // Break streak
        newStreak = isLate ? 0 : 1
      } else {
        // All gaps were off-days — treat as consecutive
        newStreak = isLate ? current.current_streak : current.current_streak + 1
      }
    }
  }

  return {
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, current.longest_streak),
    last_checkin_date: checkinDate,
  }
}

/**
 * Called by cron at 02h00 UTC — resets streak for clients who missed a configured day.
 * Returns true if streak should be reset (caller updates DB).
 */
export function shouldResetStreak(
  current: StreakState,
  todayDate: string, // YYYY-MM-DD UTC
  daysOfWeek: number[]
): boolean {
  if (!current.last_checkin_date) return false
  if (current.current_streak === 0) return false

  const last = new Date(current.last_checkin_date)
  const today = new Date(todayDate)
  const daysBetween = daysDiff(last, today)

  if (daysBetween <= 1) return false

  return hasSkippedConfiguredDay(last, today, daysOfWeek)
}

// --- helpers ---

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysDiff(from: Date, to: Date): number {
  const msPerDay = 86400000
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((toUtc - fromUtc) / msPerDay)
}

/** Returns true if any day between `from` (exclusive) and `to` (exclusive) is in daysOfWeek */
function hasSkippedConfiguredDay(from: Date, to: Date, daysOfWeek: number[]): boolean {
  if (daysOfWeek.length === 0) return false
  const cursor = new Date(from)
  cursor.setDate(cursor.getDate() + 1)
  while (cursor < to) {
    // JS getDay(): 0=Sun … 6=Sat — convert to 0=Mon … 6=Sun
    const jsDay = cursor.getDay()
    const day = jsDay === 0 ? 6 : jsDay - 1
    if (daysOfWeek.includes(day)) return true
    cursor.setDate(cursor.getDate() + 1)
  }
  return false
}
