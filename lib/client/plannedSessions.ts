export type PlannedSessionLike = {
  day_of_week?: number | null
  days_of_week?: number[] | null
}

function normalizedDays(session: PlannedSessionLike): number[] {
  const multi = Array.isArray(session.days_of_week)
    ? session.days_of_week.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : []

  if (multi.length > 0) {
    return Array.from(new Set(multi))
  }

  return Number.isInteger(session.day_of_week) && (session.day_of_week as number) >= 0 && (session.day_of_week as number) <= 6
    ? [session.day_of_week as number]
    : []
}

export function sessionMatchesJsWeekday(
  session: PlannedSessionLike,
  jsWeekday: number,
): boolean {
  return normalizedDays(session).includes(jsWeekday)
}

export function filterSessionsForJsWeekday<T extends PlannedSessionLike>(
  sessions: T[],
  jsWeekday: number,
): T[] {
  return sessions.filter((session) => sessionMatchesJsWeekday(session, jsWeekday))
}
