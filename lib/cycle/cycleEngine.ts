import type { CyclePhase } from '@/lib/nutrition/engine/cycleSync'

export type { CyclePhase }

export interface CycleLog {
  period_start_date: string
  period_end_date: string | null
  computed_cycle_length_days: number | null
}

export interface CycleState {
  hasActiveCycle: boolean
  currentPhase: CyclePhase | null
  currentCycleDay: number | null
  avgCycleLengthDays: number
  regularity: 'unknown' | 'regular' | 'irregular'
  isPeriodStartExpected: boolean
  menstrualPhaseLengthDays: number
  nextPhaseIn: number | null
  lastPeriodDate: string | null
  lastPeriodEndDate: string | null
  logsCount: number
  confidence: 'estimated' | 'learning' | 'calibrated'
}

const NO_CYCLE_BILAN_VALUES = ['Ménopause / Aménorrhée', 'Non applicable']

export function hasActiveCycleFromBilan(bilanValue: string | null): boolean {
  if (!bilanValue) return true
  return !NO_CYCLE_BILAN_VALUES.includes(bilanValue)
}

export function computeAvgCycleLength(logs: CycleLog[]): number {
  const observed = getObservedCycleLengths(logs)
  const valid = observed.length > 0
    ? observed
    : logs
    .map(l => l.computed_cycle_length_days)
    .filter((n): n is number => n !== null && n >= 15 && n <= 90)
  if (valid.length === 0) return 28
  const sorted = [...valid].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle]
}

export function getObservedCycleLengths(logs: CycleLog[]): number[] {
  const dates = [...new Set(logs.map(log => log.period_start_date))]
    .sort((a, b) => a.localeCompare(b))

  return dates
    .slice(1)
    .map((date, index) => {
      const previous = new Date(`${dates[index]}T00:00:00Z`)
      const current = new Date(`${date}T00:00:00Z`)
      return Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24))
    })
    .filter(length => length >= 15 && length <= 90)
}

export function getCycleRegularity(logs: CycleLog[]): CycleState['regularity'] {
  const lengths = getObservedCycleLengths(logs)
  if (lengths.length < 2) return 'unknown'
  return Math.max(...lengths) - Math.min(...lengths) > 7
    ? 'irregular'
    : 'regular'
}

export function computeAvgMenstrualLength(logs: CycleLog[]): number {
  const durations = logs
    .filter(l => l.period_end_date !== null)
    .map(l => {
      const start = new Date(l.period_start_date)
      const end = new Date(l.period_end_date!)
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    })
    .filter(d => d >= 1 && d <= 14)
  if (durations.length === 0) return 5
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
}

export function computeCurrentCycleDay(
  lastPeriodStartDate: string,
  avgCycleLength: number,
  today: Date = new Date(),
): number {
  const start = new Date(lastPeriodStartDate)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((t.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return (diffDays % avgCycleLength) + 1
}

function daysSincePeriodStart(lastPeriodStartDate: string, today: Date): number {
  const start = new Date(`${lastPeriodStartDate}T00:00:00Z`)
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return Math.max(0, Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

export function detectPhase(
  cycleDay: number,
  avgCycleLength: number,
  menstrualLength: number,
): CyclePhase {
  if (cycleDay <= menstrualLength) return 'menstrual'
  const ovulationDay = Math.floor(avgCycleLength / 2)
  if (cycleDay < ovulationDay) return 'follicular'
  if (cycleDay <= ovulationDay + 1) return 'ovulatory'
  return 'luteal'
}

export function computeNextPhaseIn(
  cycleDay: number,
  phase: CyclePhase,
  avgCycleLength: number,
  menstrualLength: number,
): number {
  const ovulationDay = Math.floor(avgCycleLength / 2)
  switch (phase) {
    case 'menstrual':  return Math.max(1, menstrualLength - cycleDay + 1)
    case 'follicular': return Math.max(1, ovulationDay - cycleDay)
    case 'ovulatory':  return Math.max(1, ovulationDay + 2 - cycleDay)
    case 'luteal':     return Math.max(1, avgCycleLength - cycleDay + 1)
  }
}

const BILAN_ESTIMATE_DAY: Record<string, number> = {
  'Phase folliculaire (J1–J13)': 7,
  'Ovulation (J14)': 14,
  'Phase lutéale (J15–J28)': 21,
  'Règles': 1,
}

export function getCycleStateFromLogs(
  logs: CycleLog[],
  bilanValue: string | null,
  today: Date = new Date(),
): CycleState {
  const hasActiveCycle = hasActiveCycleFromBilan(bilanValue)

  if (!hasActiveCycle) {
    return {
      hasActiveCycle: false,
      currentPhase: null,
      currentCycleDay: null,
      avgCycleLengthDays: 28,
      regularity: 'unknown',
      isPeriodStartExpected: false,
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: null,
      lastPeriodDate: null,
      lastPeriodEndDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const avgCycleLength = computeAvgCycleLength(logs)
  const menstrualLength = computeAvgMenstrualLength(logs)
  const regularity = getCycleRegularity(logs)
  const logsCount = logs.length
  const confidence: CycleState['confidence'] =
    logsCount >= 4 ? 'calibrated' : logsCount >= 1 ? 'learning' : 'estimated'

  if (logsCount === 0) {
    const estimatedDay = bilanValue ? (BILAN_ESTIMATE_DAY[bilanValue] ?? null) : null
    if (!estimatedDay) {
      return {
        hasActiveCycle: true,
        currentPhase: null,
        currentCycleDay: null,
        avgCycleLengthDays: 28,
        regularity: 'unknown',
        isPeriodStartExpected: false,
        menstrualPhaseLengthDays: 5,
        nextPhaseIn: null,
        lastPeriodDate: null,
        lastPeriodEndDate: null,
        logsCount: 0,
        confidence: 'estimated',
      }
    }
    const phase = detectPhase(estimatedDay, 28, 5)
    return {
      hasActiveCycle: true,
      currentPhase: phase,
      currentCycleDay: estimatedDay,
      avgCycleLengthDays: 28,
      regularity: 'unknown',
      isPeriodStartExpected: false,
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: computeNextPhaseIn(estimatedDay, phase, 28, 5),
      lastPeriodDate: null,
      lastPeriodEndDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const lastLog = logs[0]
  const currentCycleDay = computeCurrentCycleDay(lastLog.period_start_date, avgCycleLength, today)
  const currentPhase = detectPhase(currentCycleDay, avgCycleLength, menstrualLength)
  const isPeriodStartExpected = daysSincePeriodStart(lastLog.period_start_date, today) >= avgCycleLength - 2

  return {
    hasActiveCycle: true,
    currentPhase,
    currentCycleDay,
    avgCycleLengthDays: avgCycleLength,
    regularity,
    isPeriodStartExpected,
    menstrualPhaseLengthDays: menstrualLength,
    nextPhaseIn: computeNextPhaseIn(currentCycleDay, currentPhase, avgCycleLength, menstrualLength),
    lastPeriodDate: lastLog.period_start_date,
    lastPeriodEndDate: lastLog.period_end_date,
    logsCount,
    confidence,
  }
}
