import type { PhaseClientProfile, ProgressionContext, RawSignalInput } from '@/lib/coach/phaseEngine/types'

export const defaultPhaseProfile: PhaseClientProfile = {
  experienceLevel: 'intermediate',
  currentPhase: 'recomp',
  cyclicProtocolMode: null,
}

export const defaultProgression: ProgressionContext = {
  overloadEventCount: 0,
  compoundOneRmImproving: false,
  recentPrDetected: false,
}

export function makeExerciseRow(
  overrides: Partial<RawSignalInput['performance']['exercises'][0]> = {},
): RawSignalInput['performance']['exercises'][0] {
  return {
    exercise_id: 'ex-1',
    exercise_name: 'Back Squat',
    completion_rate: 0.9,
    avg_rir: 2,
    prescribed_rir: 2,
    overloads_last_4_weeks: 0,
    stagnation: false,
    overreaching: false,
    load_progressing: false,
    intentional_intensity: false,
    ...overrides,
  }
}

export function makeRawInput(overrides: Partial<RawSignalInput> = {}): RawSignalInput {
  return {
    weightSeries: [],
    bodyFatSeries: [],
    leanMassSeries: [],
    waistSeries: [],
    checkin: {},
    checkinResponseRate: 0,
    rhrSeries: [],
    anchorDate: undefined,
    performance: {
      exercises: [],
      global_overreaching: false,
      sessionsCount: 0,
      weeklyFrequency: 3,
    },
    clientProfile: defaultPhaseProfile,
    progression: defaultProgression,
    latestBodyFat: null,
    gender: null,
    windowDays: 30,
    ...overrides,
  }
}
