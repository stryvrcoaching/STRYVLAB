import { Capacitor } from '@capacitor/core'
import { Health, type HealthSample } from '@capgo/capacitor-health'

export const HEALTH_SCOPES = ['steps', 'sleep', 'weight', 'restingHeartRate'] as const

export type HealthPlatform = 'ios' | 'android'

export type HealthSyncPayload = {
  local_date: string
  timezone: string
  platform: HealthPlatform
  scopes: readonly string[]
  steps?: number
  sleep_minutes?: number
  resting_heart_rate?: number
  weight_kg?: number
  source_details: Record<string, string | undefined>
}

function dayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    localDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

function round(value: number, digits = 0) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function latestSample(samples: HealthSample[]) {
  return [...samples].sort((left, right) => right.endDate.localeCompare(left.endDate))[0]
}

function sleepMinutes(samples: HealthSample[]) {
  return round(samples
    .filter((sample) => sample.sleepState !== 'awake' && sample.sleepState !== 'inBed')
    .reduce((total, sample) => total + sample.value, 0))
}

export function isNativeHealthPlatform(): boolean {
  return Capacitor.isNativePlatform() && ['ios', 'android'].includes(Capacitor.getPlatform())
}

export async function syncTodayHealthData(): Promise<HealthSyncPayload> {
  if (!isNativeHealthPlatform()) {
    throw new Error('health.error.nativeOnly')
  }

  const availability = await Health.isAvailable()
  if (!availability.available) {
    throw new Error('health.error.unavailable')
  }

  const platform = Capacitor.getPlatform() as HealthPlatform
  const authorization = await Health.requestAuthorization({ read: [...HEALTH_SCOPES] })
  const granted = HEALTH_SCOPES.filter((scope) => authorization.readAuthorized.includes(scope))
  if (!granted.length) {
    throw new Error('health.error.permission')
  }

  const { localDate, startDate, endDate } = dayBounds()
  const query = { startDate, endDate, limit: 100, ascending: false } as const
  const [stepsResult, sleepResult, weightResult, restingHeartRateResult] = await Promise.all([
    granted.includes('steps')
      ? Health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' })
      : Promise.resolve({ samples: [] }),
    granted.includes('sleep')
      ? Health.readSamples({ dataType: 'sleep', ...query })
      : Promise.resolve({ samples: [] }),
    granted.includes('weight')
      ? Health.readSamples({ dataType: 'weight', ...query })
      : Promise.resolve({ samples: [] }),
    granted.includes('restingHeartRate')
      ? Health.queryAggregated({ dataType: 'restingHeartRate', startDate, endDate, bucket: 'day', aggregation: 'average' })
      : Promise.resolve({ samples: [] }),
  ])

  const latestWeight = latestSample(weightResult.samples)
  const sleepSample = latestSample(sleepResult.samples)

  return {
    local_date: localDate,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    platform,
    scopes: granted,
    steps: stepsResult.samples[0] ? round(stepsResult.samples[0].value) : undefined,
    sleep_minutes: sleepMinutes(sleepResult.samples) || undefined,
    resting_heart_rate: restingHeartRateResult.samples[0]
      ? round(restingHeartRateResult.samples[0].value)
      : undefined,
    weight_kg: latestWeight ? round(latestWeight.value, 2) : undefined,
    source_details: {
      steps: stepsResult.samples[0]?.unit,
      sleep: sleepSample?.sourceName,
      weight: latestWeight?.sourceName,
      restingHeartRate: restingHeartRateResult.samples[0]?.unit,
    },
  }
}
