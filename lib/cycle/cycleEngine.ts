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
  menstrualPhaseLengthDays: number
  nextPhaseIn: number | null
  lastPeriodDate: string | null
  logsCount: number
  confidence: 'estimated' | 'learning' | 'calibrated'
}

const NO_CYCLE_BILAN_VALUES = ['Ménopause / Aménorrhée', 'Non applicable']

export function hasActiveCycleFromBilan(bilanValue: string | null): boolean {
  if (!bilanValue) return true
  return !NO_CYCLE_BILAN_VALUES.includes(bilanValue)
}

export function computeAvgCycleLength(logs: CycleLog[]): number {
  const valid = logs
    .map(l => l.computed_cycle_length_days)
    .filter((n): n is number => n !== null && n >= 21 && n <= 35)
  if (valid.length === 0) return 28
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
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
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: null,
      lastPeriodDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const avgCycleLength = computeAvgCycleLength(logs)
  const menstrualLength = computeAvgMenstrualLength(logs)
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
        menstrualPhaseLengthDays: 5,
        nextPhaseIn: null,
        lastPeriodDate: null,
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
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: computeNextPhaseIn(estimatedDay, phase, 28, 5),
      lastPeriodDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const lastLog = logs[0]
  const currentCycleDay = computeCurrentCycleDay(lastLog.period_start_date, avgCycleLength, today)
  const currentPhase = detectPhase(currentCycleDay, avgCycleLength, menstrualLength)

  return {
    hasActiveCycle: true,
    currentPhase,
    currentCycleDay,
    avgCycleLengthDays: avgCycleLength,
    menstrualPhaseLengthDays: menstrualLength,
    nextPhaseIn: computeNextPhaseIn(currentCycleDay, currentPhase, avgCycleLength, menstrualLength),
    lastPeriodDate: lastLog.period_start_date,
    logsCount,
    confidence,
  }
}
