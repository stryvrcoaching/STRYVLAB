export async function syncAppBadge(count: number) {
  if (typeof navigator === 'undefined') return

  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
    serviceWorker?: ServiceWorkerContainer
  }

  try {
    if (count > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(count)
    } else if (count === 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge()
    }
  } catch {
    // Best-effort only — unsupported browsers should fail silently.
  }

  try {
    nav.serviceWorker?.controller?.postMessage({ type: 'client-inbox-badge', count })
  } catch {
    // Silent no-op.
  }
}
