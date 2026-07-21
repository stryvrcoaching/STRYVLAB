/**
 * Client-side dismiss / snooze for cockpit directions.
 * Stored per coach browser + clientId + direction id.
 */

export type DirectionDismissKind = 'treated' | 'snooze'

export type DirectionDismissEntry = {
  kind: DirectionDismissKind
  /** ISO timestamp until which the direction is hidden */
  until: string
  at: string
}

const storageKey = (clientId: string) => `coach-cockpit-directions:${clientId}`

function readMap(clientId: string): Record<string, DirectionDismissEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(clientId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DirectionDismissEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(clientId: string, map: Record<string, DirectionDismissEntry>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(clientId), JSON.stringify(map))
}

export function isDirectionDismissed(
  clientId: string,
  directionId: string,
  now = new Date(),
): boolean {
  const entry = readMap(clientId)[directionId]
  if (!entry?.until) return false
  return new Date(entry.until).getTime() > now.getTime()
}

export function filterActiveDirections<T extends { id: string }>(
  clientId: string,
  directions: T[],
  now = new Date(),
): T[] {
  return directions.filter((d) => !isDirectionDismissed(clientId, d.id, now))
}

/** Hide until far future (effectively treated for this cycle). */
export function markDirectionTreated(clientId: string, directionId: string) {
  const until = new Date()
  until.setFullYear(until.getFullYear() + 1)
  const map = readMap(clientId)
  map[directionId] = {
    kind: 'treated',
    until: until.toISOString(),
    at: new Date().toISOString(),
  }
  writeMap(clientId, map)
}

/** Hide for 7 days. */
export function snoozeDirection(clientId: string, directionId: string, days = 7) {
  const until = new Date()
  until.setDate(until.getDate() + days)
  const map = readMap(clientId)
  map[directionId] = {
    kind: 'snooze',
    until: until.toISOString(),
    at: new Date().toISOString(),
  }
  writeMap(clientId, map)
}

export function clearDirectionDismiss(clientId: string, directionId: string) {
  const map = readMap(clientId)
  delete map[directionId]
  writeMap(clientId, map)
}
