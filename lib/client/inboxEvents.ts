export const CLIENT_INBOX_UPDATED_EVENT = 'client-inbox-updated'

export function emitClientInboxUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CLIENT_INBOX_UPDATED_EVENT))
}
