import type { NutritionProtocolDay } from '@/lib/nutrition/types'

export interface DayRoles {
  trainingDayId: string | null
  restDayId: string | null
}

const TRAINING_RE = /entra[îi]n|training|sport|muscul|perf/i
const REST_RE = /repos|rest|regen|recup|récup/i

export function detectDayRoles(days: NutritionProtocolDay[]): DayRoles {
  let trainingDayId: string | null = null
  let restDayId: string | null = null

  for (const d of days) {
    if (!trainingDayId && TRAINING_RE.test(d.name)) trainingDayId = d.id
    if (!restDayId && REST_RE.test(d.name)) restDayId = d.id
  }

  if (!trainingDayId || !restDayId) {
    for (const d of days) {
      if (!trainingDayId && d.carb_cycle_type === 'high') trainingDayId = d.id
      if (!restDayId && d.carb_cycle_type === 'low') restDayId = d.id
    }
  }

  return { trainingDayId, restDayId }
}

export function buildScheduleSlots(
  sessions: { days_of_week?: number[] | null; day_of_week?: number | null }[],
  trainingDayPosition: number,
  restDayPosition: number,
): { week_index: number; dow: number; protocol_day_position: number }[] {
  const trainingDows = new Set<number>()
  for (const s of sessions) {
    const dows = s.days_of_week?.length ? s.days_of_week : (s.day_of_week != null ? [s.day_of_week] : [])
    for (const dow of dows) trainingDows.add(dow)
  }

  const slots: { week_index: number; dow: number; protocol_day_position: number }[] = []
  for (let dow = 1; dow <= 7; dow++) {
    slots.push({
      week_index: 1,
      dow,
      protocol_day_position: trainingDows.has(dow) ? trainingDayPosition : restDayPosition,
    })
  }
  return slots
}

export interface MacroDelta {
  trainingKcal: number
  restKcal: number
  delta: number
}

export function computeMacroDelta(
  days: NutritionProtocolDay[],
  trainingDayId: string,
  restDayId: string,
): MacroDelta | null {
  const trainingDay = days.find((d) => d.id === trainingDayId)
  const restDay = days.find((d) => d.id === restDayId)
  const trainingKcal = trainingDay?.calories
  const restKcal = restDay?.calories
  if (!trainingKcal || !restKcal) return null
  const delta = trainingKcal - restKcal
  return { trainingKcal, restKcal, delta }
}
