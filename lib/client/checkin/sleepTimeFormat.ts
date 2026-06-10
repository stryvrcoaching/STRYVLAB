export function formatSleepHours(value: number): string {
  if (!Number.isFinite(value)) return ''

  const totalMinutes = Math.round(value * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}h${String(minutes).padStart(2, '0')}`
}

export function splitSleepHours(value: number): { hours: number; minutes: number } {
  if (!Number.isFinite(value)) return { hours: 0, minutes: 0 }

  const totalMinutes = Math.round(value * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return { hours, minutes }
}

export function sleepPartsToHoursNumber(hours: number, minutes: number): number | null {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23) return null
  if (minutes < 0 || minutes > 59) return null

  return hours + minutes / 60
}
