/**
 * Rolling average of daily steps from evening check-ins.
 * Prefer 7 days, then 6… down to 1 most recent value.
 */
export function computeStepsRollingAverage(
  rows: { date: string; daily_steps: number | null }[],
): number | null {
  const values = rows
    .filter(r => r.daily_steps != null && r.daily_steps > 0)
    .map(r => Number(r.daily_steps))
    .slice(0, 7)

  if (values.length === 0) return null

  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round(sum / values.length)
}
