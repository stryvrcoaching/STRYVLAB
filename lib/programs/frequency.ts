export function normalizeScheduledDays(session: any) {
  const rawDays = Array.isArray(session?.days_of_week)
    ? session.days_of_week
    : Array.isArray(session?.daysOfWeek)
      ? session.daysOfWeek
      : []

  const singleDay = session?.day_of_week ?? session?.dayOfWeek ?? null

  const daysSource = rawDays.length > 0
    ? rawDays
    : singleDay !== null && singleDay !== undefined
      ? [singleDay]
      : []

  return [...new Set(
    daysSource
      .map((day: unknown) => Number(day))
      .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 7)
  )]
}

export function getSessionsPerWeek(sessions: any[] = []) {
  return sessions.reduce((total, session) => {
    const normalized = normalizeScheduledDays(session)
    return total + (normalized.length > 0 ? normalized.length : 0)
  }, 0)
}

export function getTrainingDaysPerWeek(sessions: any[] = []) {
  return new Set(
    sessions.flatMap((session) => normalizeScheduledDays(session))
  ).size
}

export function resolveStoredFrequency(sessions: any[] | undefined, fallbackFrequency: number | null | undefined) {
  const computedFrequency = getSessionsPerWeek(sessions ?? [])
  return sessions && sessions.length > 0 ? computedFrequency : (fallbackFrequency ?? null)
}
