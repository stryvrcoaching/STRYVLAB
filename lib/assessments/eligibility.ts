export function isAdultBirthDate(
  value: unknown,
  referenceDate = new Date(),
): boolean {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return false
  }

  const cutoffYear = referenceDate.getUTCFullYear() - 18
  const cutoffMonth = referenceDate.getUTCMonth() + 1
  const cutoffDay = referenceDate.getUTCDate()
  return (
    year < cutoffYear ||
    (year === cutoffYear &&
      (month < cutoffMonth || (month === cutoffMonth && day <= cutoffDay)))
  )
}
