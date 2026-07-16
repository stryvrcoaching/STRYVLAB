export const REST_START_BUFFER_SEC = 5
export const REST_END_BUFFER_SEC = 5
export const REST_TOTAL_BUFFER_SEC = REST_START_BUFFER_SEC + REST_END_BUFFER_SEC
export const REST_OUTLIER_CAP_SEC = 8 * 60

export function normalizeRecordedRestSec(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value - REST_TOTAL_BUFFER_SEC))
}

export function computeRobustAverageRestSec(values: Array<number | null | undefined>): number | null {
  const normalized = values
    .map(normalizeRecordedRestSec)
    .filter((value): value is number => value != null)

  if (normalized.length === 0) return null

  const sorted = [...normalized].sort((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)]
  const dynamicCap = Math.min(REST_OUTLIER_CAP_SEC, Math.max(90, Math.round(median * 2.5)))

  const capped = sorted.filter((value) => value <= dynamicCap)
  const baseline = capped.length > 0 ? capped : sorted

  const trimCount = baseline.length >= 10 ? Math.floor(baseline.length * 0.1) : 0
  const trimmed = trimCount > 0
    ? baseline.slice(trimCount, baseline.length - trimCount)
    : baseline

  if (trimmed.length === 0) return null

  return Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length)
}
