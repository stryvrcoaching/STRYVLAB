export type SetLogUpsertRow = {
  exercise_id?: string | null
  exercise_name: string
  set_number: number
  side: string
}

/** Clé d'upsert — exercise_id quand présent (évite les collisions de noms identiques). */
export function setLogUpsertKey(row: SetLogUpsertRow): string {
  if (row.exercise_id) {
    return `${row.exercise_id}:${row.set_number}:${row.side}`
  }
  return `name:${row.exercise_name}:${row.set_number}:${row.side}`
}

/**
 * PostgreSQL rejette un upsert si deux lignes du même batch ciblent la même clé unique
 * ("ON CONFLICT DO UPDATE command cannot affect row a second time").
 * On garde la dernière occurrence (état le plus récent).
 */
export function dedupeSetLogsForUpsert<T extends SetLogUpsertRow>(rows: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const row of rows) {
    byKey.set(setLogUpsertKey(row), row)
  }
  return Array.from(byKey.values())
}
