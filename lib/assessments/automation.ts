export type WeeklyAutomationInput = {
  dayOfWeek: number
  time: string
  timezone: string
  startsOn: string
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])) as Record<string, string>
}

function offsetMinutes(date: Date, timezone: string) {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = value.match(/GMT([+-])(\d{2}):?(\d{2})?/) 
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === '-' ? -minutes : minutes
}

export function nextWeeklyRun({ dayOfWeek, time, timezone, startsOn }: WeeklyAutomationInput, from = new Date()) {
  const [hour, minute] = time.split(':').map(Number)
  const today = localParts(from, timezone)
  const start = new Date(`${startsOn}T00:00:00Z`)
  const candidate = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day), hour, minute))

  for (let days = 0; days < 14; days += 1) {
    const date = new Date(candidate)
    date.setUTCDate(candidate.getUTCDate() + days)
    if (date.getUTCDay() !== dayOfWeek || date < start) continue
    const utc = new Date(date.getTime() - offsetMinutes(date, timezone) * 60_000)
    if (utc > from) return utc.toISOString()
  }
  throw new Error('Impossible de calculer la prochaine échéance')
}
