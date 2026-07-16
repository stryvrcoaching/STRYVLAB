export type PlannedSetType = 'warmup' | 'working' | 'cooldown' | 'dropset' | null
export type SupersetRestMode = 'after_exercise' | 'after_round'

export interface SetPrescription {
  set_number: number
  reps: string
  rest_sec: number | null
  rir: number | null
  tempo: string | null
  set_type: PlannedSetType
  superset_rest_mode: SupersetRestMode | null
}

export interface SetPrescriptionDefaults {
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  tempo: string | null
  superset_rest_mode?: SupersetRestMode | null
}

export function makeDefaultSetPrescription(
  setNumber: number,
  defaults: SetPrescriptionDefaults,
): SetPrescription {
  return {
    set_number: setNumber,
    reps: defaults.reps,
    rest_sec: defaults.rest_sec,
    rir: defaults.rir,
    tempo: defaults.tempo,
    set_type: null,
    superset_rest_mode: defaults.superset_rest_mode ?? null,
  }
}

export function normalizeSetPrescriptions(
  input: unknown,
  defaults: SetPrescriptionDefaults,
): SetPrescription[] {
  const count = Math.max(1, Number(defaults.sets || 1))
  const source = Array.isArray(input) ? input : []
  const normalized: SetPrescription[] = []

  for (let index = 0; index < count; index += 1) {
    const setNumber = index + 1
    const row = source[index] as Partial<SetPrescription> | undefined
    normalized.push({
      set_number: setNumber,
      reps: typeof row?.reps === 'string' && row.reps.trim() ? row.reps : defaults.reps,
      rest_sec: row?.rest_sec === null || typeof row?.rest_sec === 'number' ? row.rest_sec : defaults.rest_sec,
      rir: row?.rir === null || typeof row?.rir === 'number' ? row.rir : defaults.rir,
      tempo: row?.tempo === null || typeof row?.tempo === 'string' ? row.tempo : defaults.tempo,
      superset_rest_mode:
        row?.superset_rest_mode === 'after_exercise' ||
        row?.superset_rest_mode === 'after_round'
          ? row.superset_rest_mode
          : defaults.superset_rest_mode ?? null,
      set_type:
        row?.set_type === 'warmup' ||
        row?.set_type === 'working' ||
        row?.set_type === 'cooldown' ||
        row?.set_type === 'dropset'
          ? row.set_type
          : null,
    })
  }

  return normalized
}

export function applyDefaultFieldToSetPrescriptions<K extends keyof Omit<SetPrescription, 'set_number' | 'set_type'>>(
  prescriptions: SetPrescription[],
  key: K,
  previousDefault: SetPrescription[K],
  nextDefault: SetPrescription[K],
): SetPrescription[] {
  return prescriptions.map((row, index) => {
    if (index === 0 || row[key] === previousDefault) {
      return { ...row, [key]: nextDefault }
    }
    return row
  })
}
