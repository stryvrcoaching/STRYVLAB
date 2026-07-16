export type ClientPriorityState = 'open' | 'planned' | 'treated'

export type ClientPriorityStateRow = {
  id?: string
  coach_id: string
  client_id: string
  priority_key: string
  kind: string
  state: ClientPriorityState
  action_taken?: string | null
  agenda_event_id?: string | null
  kanban_task_id?: string | null
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
  planned_at?: string | null
  treated_at?: string | null
}

export type PriorityStateFingerprint = {
  sourceFingerprint: string
}

export function createPriorityStateRow(
  input: Omit<ClientPriorityStateRow, 'created_at' | 'updated_at'>,
): ClientPriorityStateRow {
  const now = new Date().toISOString()
  return {
    ...input,
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
    planned_at: input.state === 'planned' ? now : null,
    treated_at: input.state === 'treated' ? now : null,
  }
}

export function upsertPlannedState(
  existing: ClientPriorityStateRow | null,
  input: Omit<ClientPriorityStateRow, 'state' | 'created_at' | 'updated_at' | 'planned_at' | 'treated_at'>,
): ClientPriorityStateRow {
  const now = new Date().toISOString()
  return {
    ...(existing ?? {}),
    ...input,
    state: 'planned',
    metadata: input.metadata ?? existing?.metadata ?? {},
    created_at: existing?.created_at ?? now,
    updated_at: now,
    planned_at: now,
    treated_at: existing?.treated_at ?? null,
  }
}

export function upsertTreatedState(
  existing: ClientPriorityStateRow | null,
  input: Omit<ClientPriorityStateRow, 'state' | 'created_at' | 'updated_at' | 'planned_at' | 'treated_at'>,
): ClientPriorityStateRow {
  const now = new Date().toISOString()
  return {
    ...(existing ?? {}),
    ...input,
    state: 'treated',
    metadata: input.metadata ?? existing?.metadata ?? {},
    created_at: existing?.created_at ?? now,
    updated_at: now,
    planned_at: existing?.planned_at ?? null,
    treated_at: now,
  }
}

export function hasMaterialSourceChange(
  existing: ClientPriorityStateRow | null,
  next: PriorityStateFingerprint,
) {
  const current = String(existing?.metadata?.sourceFingerprint ?? '')
  return current !== next.sourceFingerprint
}

export function shouldHidePriorityFromState(
  existing: ClientPriorityStateRow | null,
  next: PriorityStateFingerprint,
) {
  if (!existing) return false
  if (existing.state !== 'treated') return false
  return !hasMaterialSourceChange(existing, next)
}
