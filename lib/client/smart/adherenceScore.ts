export type AdherenceInput = {
  sessionDates: string[]
  plannedDaysOfWeek: number[]
  mealDates: string[]
  waterByDate: Record<string, number>
  waterTargetMl: number
  checkinDates: string[]
  referenceDate: string
}

export type AdherenceResult = {
  score: number
  scoreDelta: number
  dimensions: {
    sport: number
    nutrition: number
    hydration: number
    checkins: number
  }
}

function getWindow(referenceDate: string, daysBack: number): string[] {
  const dates: string[] = []
  const ref = new Date(referenceDate)
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(ref.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function getDayOfWeek(dateStr: string): number {
  const jsDay = new Date(dateStr).getDay()
  return jsDay === 0 ? 7 : jsDay
}

function computeDimensions(
  window: string[],
  sessionDates: string[],
  plannedDaysOfWeek: number[],
  mealDates: string[],
  waterByDate: Record<string, number>,
  waterTargetMl: number,
  checkinDates: string[],
): AdherenceResult['dimensions'] {
  const sessionSet = new Set(sessionDates)
  const mealSet = new Set(mealDates)
  const checkinSet = new Set(checkinDates)

  const plannedInWindow = window.filter(d => plannedDaysOfWeek.includes(getDayOfWeek(d)))
  const sportDone = plannedInWindow.filter(d => sessionSet.has(d)).length
  const sport = plannedInWindow.length > 0
    ? Math.round((sportDone / plannedInWindow.length) * 25)
    : 25

  const nutritionDone = window.filter(d => mealSet.has(d)).length
  const nutrition = Math.round((nutritionDone / window.length) * 25)

  const hydrationDone = window.filter(d => (waterByDate[d] ?? 0) >= waterTargetMl * 0.8).length
  const hydration = waterTargetMl > 0
    ? Math.round((hydrationDone / window.length) * 25)
    : 25

  const checkinDone = window.filter(d => checkinSet.has(d)).length
  const checkins = Math.round((checkinDone / window.length) * 25)

  return { sport, nutrition, hydration, checkins }
}

export function computeAdherenceScore(input: AdherenceInput): AdherenceResult {
  const { sessionDates, plannedDaysOfWeek, mealDates, waterByDate, waterTargetMl, checkinDates, referenceDate } = input

  const todayWindow = getWindow(referenceDate, 7)
  const dims = computeDimensions(todayWindow, sessionDates, plannedDaysOfWeek, mealDates, waterByDate, waterTargetMl, checkinDates)
  const score = dims.sport + dims.nutrition + dims.hydration + dims.checkins

  const ref = new Date(referenceDate)
  ref.setDate(ref.getDate() - 1)
  const yesterdayRef = ref.toISOString().split('T')[0]
  const yesterdayWindow = getWindow(yesterdayRef, 7)
  const yd = computeDimensions(yesterdayWindow, sessionDates, plannedDaysOfWeek, mealDates, waterByDate, waterTargetMl, checkinDates)
  const yesterdayScore = yd.sport + yd.nutrition + yd.hydration + yd.checkins

  return { score, scoreDelta: score - yesterdayScore, dimensions: dims }
}
