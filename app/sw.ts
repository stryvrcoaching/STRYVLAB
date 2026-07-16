import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist, NetworkOnly, CacheFirst, NetworkFirst } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[]
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.hostname.includes("supabase.co") || url.pathname.includes(".hot-update."),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "stryv-static-v2",
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/client") || url.pathname.startsWith("/sales"),
      handler: async ({ request, event }) => {
        const networkFirst = new NetworkFirst({
          cacheName: "stryv-client-v6",
          networkTimeoutSeconds: 3,
        })
        try {
          return await networkFirst.handle({ request, event })
        } catch {
          const requestUrl = new URL(request.url)
          if (request.mode === "navigate" && requestUrl.pathname !== "/client/offline") {
            const offlineUrl = `/client/offline?from=${encodeURIComponent(requestUrl.pathname + requestUrl.search)}`
            return Response.redirect(offlineUrl, 302)
          }
          const cache = await caches.open("stryv-client-v6")
          const offline = await cache.match("/client/offline")
          return offline ?? new Response("Offline", { status: 503 })
        }
      },
    },
    ...defaultCache,
  ],
})

serwist.addEventListeners()

// ─── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload: any = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'STRYVR', body: event.data.text() }
  }

  const title = payload.title || 'STRYVR'
  const options: NotificationOptions = {
    body: payload.body || '',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/client' },
    icon: '/images/logo-stryvr-silver.png',
    badge: '/images/logo-stryvr-silver.png',
  }

  event.waitUntil((async () => {
    if (typeof payload.badgeCount === 'number' && (self.navigator as any)?.setAppBadge) {
      try {
        await (self.navigator as any).setAppBadge(payload.badgeCount)
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
      if (typeof data.count === 'number' && data.count > 0 && (self.navigator as any)?.setAppBadge) {
        await (self.navigator as any).setAppBadge(data.count)
      } else if (data.count === 0 && (self.navigator as any)?.clearAppBadge) {
        await (self.navigator as any).clearAppBadge()
      }
    } catch {}
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/client'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // First try to find a client that is already on the target URL (same pathname)
      try {
        const targetUrlObj = new URL(targetUrl, self.location.origin)
        const matchingClient = clients.find((client) => {
          try {
            const clientUrlObj = new URL(client.url, self.location.origin)
            return clientUrlObj.pathname === targetUrlObj.pathname
          } catch (err) {
            return false
          }
        })
        if (matchingClient) {
          return matchingClient.focus()
        }
      } catch (err) {
        // Fallback in case URL parsing fails
      }

      // If not matching, navigate the first available client window
      for (const client of clients) {
        if ('navigate' in client) {
          return (client as any).navigate(targetUrl).then((c: any) => c && c.focus())
        }
      }

      // If no window is open, open a new one
      return self.clients.openWindow(targetUrl)
    })
  )
})
