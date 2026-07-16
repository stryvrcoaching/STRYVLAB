export const CLIENT_INBOX_UPDATED_EVENT = 'client-inbox-updated'
const CLIENT_INBOX_INVALIDATION_KEY = 'client-inbox-invalidation:v1'

export function emitClientInboxUpdated() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CLIENT_INBOX_INVALIDATION_KEY, String(Date.now()))
  } catch {
    // Ignore storage failures; the in-page event still updates active listeners.
  }
  window.dispatchEvent(new CustomEvent(CLIENT_INBOX_UPDATED_EVENT))
}

export function hasClientInboxInvalidation() {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(CLIENT_INBOX_INVALIDATION_KEY) !== null
  } catch {
    return false
  }
}

export function clearClientInboxInvalidation() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(CLIENT_INBOX_INVALIDATION_KEY)
  } catch {
    // Ignore storage failures.
  }
}
