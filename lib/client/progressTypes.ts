// Types partagés entre /client/progress et /client/programme

export interface SetLog {
  exercise_name: string
  set_number: number
  actual_reps: number | null
  actual_weight_kg: number | string | null
  completed: boolean
  rpe: number | null
  rir_actual: number | null
}

export interface SessionLog {
  id: string
  session_name: string
  logged_at: string
  completed_at: string | null
  duration_min: number | null
  client_set_logs: SetLog[]
}

export interface HeatmapDay {
  date: string
  volume: number
  sessions: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface PREntry {
  exercise: string
  maxWeight: number
  prevMaxWeight: number
  achievedDate: string
  sessionCount: number
}

export interface SessionSummary {
  id: string
  name: string
  date: string
  volume: number
  setsCompleted: number
  durationMin: number | null
  hasPR: boolean
  prExercises: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function calculateStreaks(sortedDates: string[]): { streak: number; bestStreak: number } {
  if (!sortedDates.length) return { streak: 0, bestStreak: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let current = 0
  let best = 0
  let tempStreak = 1

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      tempStreak++
    } else {
      best = Math.max(best, tempStreak)
      tempStreak = 1
    }
  }
  best = Math.max(best, tempStreak)

  const lastDate = sortedDates[sortedDates.length - 1]
  if (lastDate !== todayStr && lastDate !== yesterdayStr) {
    return { streak: 0, bestStreak: best }
  }

  current = 1
  for (let i = sortedDates.length - 2; i >= 0; i--) {
    const next = new Date(sortedDates[i + 1])
    const curr = new Date(sortedDates[i])
    const diff = (next.getTime() - curr.getTime()) / 86400000
    if (diff === 1) current++
    else break
  }

  return { streak: current, bestStreak: best }
}

export function buildHeatmap(logs: SessionLog[]): HeatmapDay[] {
  const volumeMap: Record<string, number> = {}
  const sessionMap: Record<string, number> = {}

  for (const log of logs) {
    const date = log.logged_at.split('T')[0]
    if (!volumeMap[date]) { volumeMap[date] = 0; sessionMap[date] = 0 }
    sessionMap[date]++
    for (const s of log.client_set_logs) {
      if (s.completed) {
        volumeMap[date] += (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
      }
    }
  }

  const days: HeatmapDay[] = []
  const volumes = Object.values(volumeMap).filter(v => v > 0)
  const maxVol = volumes.length ? Math.max(...volumes) : 1

  for (let i = 83; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const date = d.toISOString().split('T')[0]
    const volume = volumeMap[date] ?? 0
    const sessions = sessionMap[date] ?? 0

    let level: 0 | 1 | 2 | 3 | 4 = 0
    if (volume > 0) {
      const ratio = volume / maxVol
      if (ratio < 0.25) level = 1
      else if (ratio < 0.5) level = 2
      else if (ratio < 0.75) level = 3
      else level = 4
    }

    days.push({ date, volume, sessions, level })
  }

  return days
}

export function buildPRs(logs: SessionLog[]): PREntry[] {
  const exerciseHistory: Record<string, { weights: number[]; dates: string[]; count: number }> = {}

  for (const log of logs) {
    const date = log.logged_at.split('T')[0]
    const seen = new Set<string>()
    for (const s of log.client_set_logs) {
      if (!s.completed || !s.actual_weight_kg) continue
      const name = s.exercise_name
      const weight = parseFloat(String(s.actual_weight_kg))
      if (!weight) continue
      if (!exerciseHistory[name]) exerciseHistory[name] = { weights: [], dates: [], count: 0 }
      if (!seen.has(name)) { exerciseHistory[name].count++; seen.add(name) }
      exerciseHistory[name].weights.push(weight)
      exerciseHistory[name].dates.push(date)
    }
  }

  const prs: PREntry[] = []
  for (const [exercise, data] of Object.entries(exerciseHistory)) {
    if (data.weights.length < 1) continue
    const sorted = [...data.weights].sort((a, b) => b - a)
    const maxWeight = sorted[0]
    const prevMaxWeight = sorted[1] ?? maxWeight
    const maxIdx = data.weights.indexOf(maxWeight)
    const achievedDate = data.dates[maxIdx] ?? ''
    prs.push({ exercise, maxWeight, prevMaxWeight, achievedDate, sessionCount: data.count })
  }

  return prs.sort((a, b) => b.maxWeight - a.maxWeight)
}

export function buildSessionList(logs: SessionLog[], prs: PREntry[]): SessionSummary[] {
  const prMap: Record<string, number> = {}
  for (const pr of prs) prMap[pr.exercise] = pr.maxWeight

  return [...logs]
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    .map(log => {
      const sets = log.client_set_logs
      const completed = sets.filter(s => s.completed)
      const volume = completed.reduce((sum, s) =>
        sum + (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0), 0)

      const prExercises: string[] = []
      for (const s of completed) {
        if (!s.actual_weight_kg) continue
        const w = parseFloat(String(s.actual_weight_kg))
        if (prMap[s.exercise_name] && w >= prMap[s.exercise_name]) {
          if (!prExercises.includes(s.exercise_name)) prExercises.push(s.exercise_name)
        }
      }

      return {
        id: log.id,
        name: log.session_name,
        date: log.logged_at.split('T')[0],
        volume: Math.round(volume),
        setsCompleted: completed.length,
        durationMin: log.duration_min,
        hasPR: prExercises.length > 0,
        prExercises,
      }
    })
}
