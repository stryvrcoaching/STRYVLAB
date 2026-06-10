import type { PendingSlot } from '@/lib/client/checkin/pendingCheckins'

const CHECKIN_DRAFT_KEY = 'client_checkin_draft_v1'

export type CheckinDraftState = {
  slot: PendingSlot
  collected: Record<string, number>
  stepIndex: number
}

export function loadCheckinDraft(): CheckinDraftState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CHECKIN_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CheckinDraftState | null
    if (!parsed?.slot?.date || !parsed?.slot?.flow_type) return null
    if (typeof parsed.stepIndex !== 'number' || parsed.stepIndex < 0) return null
    return {
      slot: parsed.slot,
      collected: parsed.collected ?? {},
      stepIndex: parsed.stepIndex,
    }
  } catch {
    return null
  }
}

export function saveCheckinDraft(state: CheckinDraftState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHECKIN_DRAFT_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage failures — flow still works in-memory.
  }
}

export function clearCheckinDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CHECKIN_DRAFT_KEY)
  } catch {
    // Ignore storage failures.
  }
}
