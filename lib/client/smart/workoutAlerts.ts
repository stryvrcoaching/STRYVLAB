export type WorkoutAlertCode = 'overreaching' | 'stagnation' | 'progression'
export type WorkoutAlertSeverity = 'info' | 'warning' | 'critical'

export type WorkoutAlert = {
  code: WorkoutAlertCode
  severity: WorkoutAlertSeverity
  exercise_name: string
  title: string
  body: string
}

export type WorkoutAnalysisRow = {
  exercise_name: string
  completion_rate: number
  avg_rir: number | null
  rir_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  overloads_last_4_weeks: number
  stagnation: boolean
  overreaching: boolean
}

const PRIORITY: Record<WorkoutAlertCode, number> = {
  overreaching: 3,
  stagnation: 2,
  progression: 1,
}

export function computeWorkoutAlerts(rows: WorkoutAnalysisRow[]): WorkoutAlert[] {
  const byExercise = new Map<string, WorkoutAlert>()

  for (const row of rows) {
    const candidates: WorkoutAlert[] = []

    if (row.overreaching && (row.avg_rir ?? 99) <= 1 && row.completion_rate < 0.8) {
      candidates.push({
        code: 'overreaching',
        severity: 'critical',
        exercise_name: row.exercise_name,
        title: 'SURMENAGE',
        body: `${row.exercise_name} · réduis charge ou ajoute jour repos`,
      })
    }

    if (row.stagnation) {
      candidates.push({
        code: 'stagnation',
        severity: 'warning',
        exercise_name: row.exercise_name,
        title: 'STAGNATION',
        body: `${row.exercise_name} · essaie une alternative`,
      })
    }

    if (row.completion_rate > 0.95 && row.rir_trend === 'improving') {
      candidates.push({
        code: 'progression',
        severity: 'info',
        exercise_name: row.exercise_name,
        title: 'BONNE PROGRESSION',
        body: `${row.exercise_name} · prêt pour overload`,
      })
    }

    if (candidates.length === 0) continue
    candidates.sort((a, b) => PRIORITY[b.code] - PRIORITY[a.code])
    const top = candidates[0]
    const existing = byExercise.get(row.exercise_name)
    if (!existing || PRIORITY[top.code] > PRIORITY[existing.code]) {
      byExercise.set(row.exercise_name, top)
    }
  }

  return Array.from(byExercise.values()).sort(
    (a, b) => PRIORITY[b.code] - PRIORITY[a.code],
  )
}
