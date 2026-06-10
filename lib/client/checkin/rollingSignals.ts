export type NumericSignalRow = {
  date: string
  value: number | null
}

export function clampWindowRows(
  rows: NumericSignalRow[],
  anchorDate: string,
  windowDays: number,
): NumericSignalRow[] {
  const anchor = new Date(`${anchorDate}T12:00:00.000Z`)
  const start = new Date(anchor)
  start.setUTCDate(start.getUTCDate() - Math.max(0, windowDays - 1))
  const startKey = start.toISOString().slice(0, 10)

  return rows
    .filter((row) => row.date >= startKey && row.date <= anchorDate)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function computeRollingAverage(
  rows: NumericSignalRow[],
  anchorDate: string,
  windowDays: number,
): number | null {
  const values = clampWindowRows(rows, anchorDate, windowDays)
    .filter((row) => row.value != null)
    .map((row) => Number(row.value))

  if (values.length === 0) return null

  const sum = values.reduce((acc, value) => acc + value, 0)
  return Math.round((sum / values.length) * 10) / 10
}

export function getLatestValueInWindow(
  rows: NumericSignalRow[],
  anchorDate: string,
  windowDays: number,
): number | null {
  const latest = clampWindowRows(rows, anchorDate, windowDays).find(
    (row) => row.value != null,
  )
  return latest?.value != null ? Number(latest.value) : null
}
