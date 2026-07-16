export type MeasurementCategory = {
  label: string
  score: number
  max: number
}

export function computeMeasurementReadiness(input: {
  productEventsTracked: boolean
  trackedEvents30d: number
  uniqueTrackedUsers30d: number
  consentedVisitors30d: number
  hasLeadSignals: boolean
  hasRevenueSignals: boolean
  hasAttributionSignals: boolean
  warnings: string[]
}) {
  const categories: MeasurementCategory[] = [
    {
      label: 'Decision alignment',
      score: input.hasLeadSignals && input.hasRevenueSignals ? 24 : input.hasLeadSignals || input.hasRevenueSignals ? 18 : 10,
      max: 25,
    },
    {
      label: 'Event model clarity',
      score: input.productEventsTracked && input.trackedEvents30d > 0 ? 16 : 8,
      max: 20,
    },
    {
      label: 'Data accuracy',
      score: input.productEventsTracked
        ? input.warnings.length === 0
          ? 16
          : 13
        : 6,
      max: 20,
    },
    {
      label: 'Conversion quality',
      score: input.hasLeadSignals && input.hasRevenueSignals ? 12 : input.hasLeadSignals ? 9 : 4,
      max: 15,
    },
    {
      label: 'Attribution & context',
      score: input.hasAttributionSignals && input.consentedVisitors30d > 0 ? 8 : input.hasAttributionSignals ? 6 : 2,
      max: 10,
    },
    {
      label: 'Governance',
      score: input.productEventsTracked && input.uniqueTrackedUsers30d > 0 ? 8 : 5,
      max: 10,
    },
  ]

  const score = categories.reduce((sum, category) => sum + category.score, 0)
  const verdict =
    score >= 85 ? 'Measurement-Ready'
      : score >= 70 ? 'Usable with Gaps'
        : score >= 55 ? 'Unreliable'
          : 'Broken'

  return { score, verdict, categories }
}
