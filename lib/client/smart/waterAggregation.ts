export type WaterLog = {
  logged_at: string
  amount_ml: number
}

export type WaterByTimeOfDay = {
  morning: number
  midday: number
  afternoon: number
  evening: number
}

function getHourInTz(iso: string, tz = 'Europe/Paris'): number {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const h = parts.find(p => p.type === 'hour')?.value ?? '0'
  return parseInt(h, 10)
}

export function groupWaterByTimeOfDay(
  logs: WaterLog[],
  tz: string = 'Europe/Paris'
): WaterByTimeOfDay {
  const out: WaterByTimeOfDay = { morning: 0, midday: 0, afternoon: 0, evening: 0 }
  for (const log of logs) {
    const hour = getHourInTz(log.logged_at, tz)
    if (hour >= 5 && hour < 12) out.morning += log.amount_ml
    else if (hour >= 12 && hour < 15) out.midday += log.amount_ml
    else if (hour >= 15 && hour < 19) out.afternoon += log.amount_ml
    else if (hour >= 19 && hour < 24) out.evening += log.amount_ml
  }
  return out
}
