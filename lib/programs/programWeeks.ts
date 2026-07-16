export type ProgramWeekType = 'base' | 'build' | 'overload' | 'deload' | 'peak' | 'custom'

export interface ProgramWeekRecord {
  id: string
  program_id: string
  position: number
  label: string
  week_type: ProgramWeekType
  source_week_id: string | null
}

type DatabaseRecord = Record<string, unknown>

const SESSION_COPY_EXCLUSIONS = new Set([
  'id',
  'program_id',
  'program_week_id',
  'program_exercises',
  'created_at',
  'updated_at',
])

const EXERCISE_COPY_EXCLUSIONS = new Set([
  'id',
  'session_id',
  'created_at',
  'updated_at',
])

function copyDatabaseFields(source: DatabaseRecord, exclusions: Set<string>): DatabaseRecord {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !exclusions.has(key)),
  )
}

export function buildDuplicatedSessionInsert(
  source: DatabaseRecord,
  programId: string,
  programWeekId: string,
): DatabaseRecord {
  return {
    ...copyDatabaseFields(source, SESSION_COPY_EXCLUSIONS),
    program_id: programId,
    program_week_id: programWeekId,
    lineage_id: source.lineage_id ?? source.id,
  }
}

export function buildDuplicatedExerciseInsert(
  source: DatabaseRecord,
  sessionId: string,
): DatabaseRecord {
  return {
    ...copyDatabaseFields(source, EXERCISE_COPY_EXCLUSIONS),
    session_id: sessionId,
    lineage_id: source.lineage_id ?? source.id,
  }
}

export function nextProgramWeekPosition(weeks: Pick<ProgramWeekRecord, 'position'>[]): number {
  if (weeks.length === 0) return 0
  return Math.max(...weeks.map((week) => week.position)) + 1
}
