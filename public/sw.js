const CACHE_NAME = 'stryv-client-v4'
const STATIC_CACHE = 'stryv-static-v1'

// Only precache the offline fallback — never SSR routes (they need auth context)
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/client/offline',
]

// ─── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // Never intercept Supabase or hot-reload requests
  if (url.hostname.includes('supabase.co')) return
  if (url.pathname.includes('.hot-update.')) return

  // API routes — network only, no caching (session data must not persist across logout)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request))
    return
  }

  // Next.js static assets — content-hashed filenames, safe to cache forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Client pages — network-first with 3s timeout, fall back to offline page
  if (url.pathname.startsWith('/client')) {
    event.respondWith(networkFirstWithTimeout(request, 3000))
    return
  }
})

// ─── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'STRYVR', body: event.data.text() }
  }

  const title = payload.title || 'STRYVR'
  const options = {
    body: payload.body || '',
    data: { url: payload.url || '/client' },
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  }

  event.waitUntil((async () => {
    if (typeof payload.badgeCount === 'number' && self.navigator?.setAppBadge) {
      try {
        await self.navigator.setAppBadge(payload.badgeCount)
      } catch {}
    }
    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type !== 'client-inbox-badge') return

  event.waitUntil((async () => {
    try {
      if (typeof data.count === 'number' && data.count > 0 && self.navigator?.setAppBadge) {
        await self.navigator.setAppBadge(data.count)
      } else if (data.count === 0 && self.navigator?.clearAppBadge) {
        await self.navigator.clearAppBadge()
      }
    } catch {}
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/client'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then((c) => c && c.focus())
        }
      }
      return self.clients.openWindow(targetUrl)
    })
  )
})

// ─── Stratégies ────────────────────────────────────────────────────────────

// Network only — for API routes (no cache write)
async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch {
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Cache first — for versioned static assets
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

// Network first with timeout + AbortController — for client pages
async function networkFirstWithTimeout(request, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const requestUrl = new URL(request.url)

  try {
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    clearTimeout(timer)
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    if (cached) return cached

    // For navigations, send the user to the offline shell with a memory of
    // the page they were trying to reach so Retry can come back correctly.
    if (request.mode === 'navigate' && requestUrl.pathname !== '/client/offline') {
      const offlineUrl = `/client/offline?from=${encodeURIComponent(requestUrl.pathname + requestUrl.search)}`
      return Response.redirect(offlineUrl, 302)
    }

    // Fall back to offline page
    const offline = await cache.match('/client/offline')
    return offline ?? new Response('Offline', { status: 503 })
  }
}
