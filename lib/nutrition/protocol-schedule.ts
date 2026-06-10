type ProtocolDayLike = {
  position: number
  name?: string | null
  carb_cycle_type?: string | null
  [key: string]: unknown
}

type ScheduleSlotLike = {
  week_index: number
  dow: number
  protocol_day_position: number
}

export function toDowMondayFirst(date: Date): number {
  const js = date.getDay()
  return js === 0 ? 7 : js
}

export function getCycleWeekIndex(dateIso: string, startDateIso: string): number {
  const a = new Date(`${startDateIso}T00:00:00Z`)
  const b = new Date(`${dateIso}T00:00:00Z`)
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.max(0, Math.floor((b.getTime() - a.getTime()) / dayMs))
  return (Math.floor(diffDays / 7) % 4) + 1
}

export function resolveProtocolDayByDate<TDay extends ProtocolDayLike>(
  dateIso: string,
  scheduleStartDate: string | null | undefined,
  days: TDay[],
  scheduleSlots: ScheduleSlotLike[],
): TDay | null {
  if (!days.length) return null

  const sortedDays = [...days].sort((a, b) => a.position - b.position)
  const fallback = sortedDays[0] ?? null
  if (!fallback) return null

  const dow = toDowMondayFirst(new Date(`${dateIso}T12:00:00Z`))
  const startDate = scheduleStartDate ?? dateIso
  const weekIndex = getCycleWeekIndex(dateIso, startDate)

  const direct = scheduleSlots.find(
    (s) => s.week_index === weekIndex && s.dow === dow,
  )
  if (direct) {
    return sortedDays.find((d) => d.position === direct.protocol_day_position) ?? fallback
  }

  const week1Fallback = scheduleSlots.find((s) => s.week_index === 1 && s.dow === dow)
  if (week1Fallback) {
    return sortedDays.find((d) => d.position === week1Fallback.protocol_day_position) ?? fallback
  }

  return fallback
}

export function resolveRestProtocolDay<TDay extends ProtocolDayLike>(
  days: TDay[],
): TDay | null {
  if (!days.length) return null
  const sortedDays = [...days].sort((a, b) => a.position - b.position)
  const direct = sortedDays.find((day) => {
    const name = String(day.name ?? '').toLowerCase()
    const cycle = String(day.carb_cycle_type ?? '').toLowerCase()
    return (
      name.includes('repos') ||
      name.includes('rest') ||
      name.includes('recovery') ||
      name.includes('recup') ||
      name.includes('récup') ||
      name.includes('off') ||
      cycle.includes('low')
    )
  })
  return direct ?? sortedDays[0] ?? null
}
