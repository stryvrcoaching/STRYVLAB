export type PlannedSessionLike = {
  day_of_week?: number | null
  days_of_week?: number[] | null
}

function normalizedDays(session: PlannedSessionLike): number[] {
  const normalizeDay = (day: number): number | null => {
    if (!Number.isInteger(day)) return null
    if (day >= 0 && day <= 6) return day
    if (day >= 1 && day <= 7) return day % 7
    return null
  }

  const multi = Array.isArray(session.days_of_week)
    ? session.days_of_week
      .map((day) => normalizeDay(day))
      .filter((day): day is number => day != null)
    : []

  if (multi.length > 0) {
    return Array.from(new Set(multi))
  }

  const normalizedSingle = typeof session.day_of_week === 'number'
    ? normalizeDay(session.day_of_week)
    : null

  return normalizedSingle != null ? [normalizedSingle] : []
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

export function programmeDowToJsWeekday(programmeDow: number): number | null {
  if (!Number.isInteger(programmeDow) || programmeDow < 1 || programmeDow > 7) return null
  return programmeDow % 7
}

export function sessionMatchesProgrammeDow(
  session: PlannedSessionLike,
  programmeDow: number,
): boolean {
  const jsWeekday = programmeDowToJsWeekday(programmeDow)
  if (jsWeekday == null) return false
  return sessionMatchesJsWeekday(session, jsWeekday)
}

export function filterSessionsForProgrammeDow<T extends PlannedSessionLike>(
  sessions: T[],
  programmeDow: number,
): T[] {
  return sessions.filter((session) => sessionMatchesProgrammeDow(session, programmeDow))
}
