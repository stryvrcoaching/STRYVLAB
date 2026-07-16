export type OverlayMetricFamily =
  | 'body'
  | 'recovery'
  | 'nutrition'
  | 'performance'
  | 'correlation'

export type OverlayMetricMode =
  | 'observed'
  | 'consumed'
  | 'planned'
  | 'derived'

export interface OverlaySeriesPoint {
  date: string
  value: number
}

export interface OverlayMetricDefinition {
  key: string
  label: string
  family: OverlayMetricFamily
  mode: OverlayMetricMode
  unit: string
  color: string
  dashed?: boolean
  correlationEligible: boolean
}

export interface OverlayMetricGroup {
  key: string
  label: string
  description: string
  family: OverlayMetricFamily
  metrics: string[]
}

export interface OverlayMetadataEntry {
  label: string
  family: OverlayMetricFamily
  mode: OverlayMetricMode
  unit: string
  color: string
  dashed: boolean
  correlationEligible: boolean
}

export type OverlaySeriesMap = Record<string, OverlaySeriesPoint[]>

export interface OverlayBuilderContext {
  clientId: string
  coachId: string
  timezone: string
  dateKeys: string[]
  startDateKey: string
  endDateKey: string
}

export interface OverlayResponse {
  series: OverlaySeriesMap
  groups: OverlayMetricGroup[]
  metadata: Record<string, OverlayMetadataEntry>
  windowDays: number
  startDate: string
  endDate: string
}
