import type { SignalTone } from "@/components/client/smart/DashboardSignalCard"

export type WorkoutAlert = {
  id: string
  code: string
  severity: "info" | "warning" | "critical"
  title: string
  body?: string
  eyebrow?: string
  label?: string
  href?: string
  tone: SignalTone
  notificationId?: string
  /** Kept for the performance-analysis endpoint and its consumers. */
  exercise_name?: string
}

/** Legacy shape used by the performance-analysis endpoint. */
export type WorkoutAnalysisRow = {
  exercise_name: string
  completion_rate: number
  avg_rir: number | null
  rir_trend: "improving" | "stable" | "declining" | string
  overloads_last_4_weeks: number
  stagnation: boolean
  overreaching: boolean
}

export type WorkoutAlertOptions = {
  activeMesocycle?: {
    name: string
    currentWeek: number
    totalWeeks: number
    phase?: string
  } | null
  recentPRs?: {
    exerciseName: string
    weightKg: number
    reps: number
    deltaKg?: number
    date?: string
    notificationId?: string
  }[]
  isDeloadRecommended?: boolean
}

/**
 * Produces the client-facing workout inbox items.
 *
 * The analysis-row overload remains supported for the existing performance API;
 * the object form is used by the programme page for persisted PRs and the
 * active training cycle.
 */
export function computeWorkoutAlerts(options: WorkoutAlertOptions): WorkoutAlert[]
export function computeWorkoutAlerts(rows: WorkoutAnalysisRow[]): WorkoutAlert[]
export function computeWorkoutAlerts(
  input: WorkoutAlertOptions | WorkoutAnalysisRow[],
): WorkoutAlert[] {
  if (Array.isArray(input)) return computePerformanceAlerts(input)

  const alerts: WorkoutAlert[] = []

  for (const pr of input.recentPRs ?? []) {
    const deltaText = pr.deltaKg && pr.deltaKg > 0 ? ` (+${pr.deltaKg} kg)` : ""
    alerts.push({
      id: `pr-${pr.exerciseName}-${pr.weightKg}-${pr.reps}`,
      code: "pr_broken",
      severity: "info",
      eyebrow: "Record personnel",
      title: `Nouveau PR : ${pr.exerciseName}`,
      body: `${pr.weightKg} kg × ${pr.reps} reps${deltaText}. Félicitations !`,
      label: "Voir",
      href: "/client/programme?tab=performances",
      tone: "success",
      exercise_name: pr.exerciseName,
      notificationId: pr.notificationId,
    })
  }

  const mesocycle = input.activeMesocycle
  if (mesocycle?.currentWeek === 1) {
    alerts.push({
      id: `mesocycle-start-${mesocycle.name}-${mesocycle.totalWeeks}`,
      code: "mesocycle_start",
      severity: "info",
      eyebrow: "Programme",
      title: `Nouveau mésocycle : ${mesocycle.name}`,
      body: `Semaine 1 / ${mesocycle.totalWeeks}${mesocycle.phase ? ` — ${mesocycle.phase}` : ""}.`,
      label: "Programme",
      href: "/client/programme",
      tone: "info",
    })
  }

  if (input.isDeloadRecommended) {
    alerts.push({
      id: "deload-recommended",
      code: "deload_recommended",
      severity: "warning",
      eyebrow: "Récupération",
      title: "Semaine de deload suggérée",
      body: "L'accumulation de fatigue est élevée. Réduis le volume de 30–40 % sur ce cycle.",
      label: "Conseils",
      tone: "warning",
    })
  }

  return alerts
}

function computePerformanceAlerts(rows: WorkoutAnalysisRow[]): WorkoutAlert[] {
  const byExercise = new Map<string, WorkoutAlert>()

  for (const row of rows) {
    let next: WorkoutAlert | null = null

    if (row.overreaching && (row.avg_rir ?? Infinity) <= 1 && row.completion_rate < 0.8) {
      next = {
        id: `overreaching-${row.exercise_name}`,
        code: "overreaching",
        severity: "critical",
        eyebrow: "Récupération",
        title: `SURMENAGE : ${row.exercise_name}`,
        body: "Réduis l'intensité et partage ton ressenti avec ton coach.",
        tone: "attention",
        exercise_name: row.exercise_name,
      }
    } else if (row.stagnation) {
      next = {
        id: `stagnation-${row.exercise_name}`,
        code: "stagnation",
        severity: "warning",
        eyebrow: "Progression",
        title: `Plateau détecté : ${row.exercise_name}`,
        body: "Ta progression ralentit. La prochaine séance peut aider à ajuster la charge.",
        tone: "warning",
        exercise_name: row.exercise_name,
      }
    } else if (row.completion_rate > 0.95 && row.rir_trend === "improving") {
      next = {
        id: `progression-${row.exercise_name}`,
        code: "progression",
        severity: "info",
        eyebrow: "Progression",
        title: `Progression régulière : ${row.exercise_name}`,
        body: "Tes dernières séances sont bien maîtrisées.",
        tone: "success",
        exercise_name: row.exercise_name,
      }
    }

    if (!next) continue
    const current = byExercise.get(row.exercise_name)
    if (!current || severityRank(next.severity) > severityRank(current.severity)) {
      byExercise.set(row.exercise_name, next)
    }
  }

  return [...byExercise.values()].sort(
    (left, right) => severityRank(right.severity) - severityRank(left.severity),
  )
}

function severityRank(severity: WorkoutAlert["severity"]) {
  if (severity === "critical") return 3
  if (severity === "warning") return 2
  return 1
}
