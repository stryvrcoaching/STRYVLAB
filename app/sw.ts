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
      // Static media used by the client shell — cache aggressively after first hit.
      matcher: ({ url, request }) =>
        request.destination === "image" ||
        request.destination === "font" ||
        url.pathname.startsWith("/logo/") ||
        url.pathname.startsWith("/images/lclient-dashboard-bg"),
      handler: new CacheFirst({
        cacheName: "stryv-client-media-v1",
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/client") || url.pathname.startsWith("/sales"),
      handler: async ({ request, event }) => {
        // Slightly longer network budget for cold 4G; fall back to cache for snappy revisits.
        const networkFirst = new NetworkFirst({
          cacheName: "stryv-client-v7",
          networkTimeoutSeconds: 4,
        })
        try {
          return await networkFirst.handle({ request, event })
        } catch {
          const requestUrl = new URL(request.url)
          if (request.mode === "navigate" && requestUrl.pathname !== "/client/offline") {
            const offlineUrl = `/client/offline?from=${encodeURIComponent(requestUrl.pathname + requestUrl.search)}`
            return Response.redirect(offlineUrl, 302)
          }
          const cache = await caches.open("stryv-client-v7")
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
  let targetUrl = event.notification?.data?.url || '/client'

  // Legacy payment pushes may still carry a raw Stripe Checkout URL.
  // Never navigate the PWA to checkout.stripe.com (breaks standalone + expires).
  try {
    const parsed = new URL(targetUrl, self.location.origin)
    const isExternal = parsed.origin !== self.location.origin
    const isStripe =
      parsed.hostname.includes('stripe.com') ||
      parsed.hostname.includes('checkout.stripe.com')
    if (isExternal && isStripe) {
      targetUrl = '/client/paiement'
    }
  } catch {
    // keep original
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      let targetUrlObj: URL
      try {
        targetUrlObj = new URL(targetUrl, self.location.origin)
      } catch {
        return self.clients.openWindow(targetUrl)
      }

      const isSameOrigin = targetUrlObj.origin === self.location.origin

      // Cross-origin (should be rare after Stripe rewrite): always open a new window.
      if (!isSameOrigin) {
        return self.clients.openWindow(targetUrlObj.href)
      }

      // Prefer focusing an existing client on the same pathname, then navigate it.
      const matchingClient = clients.find((client) => {
        try {
          const clientUrlObj = new URL(client.url, self.location.origin)
          return clientUrlObj.pathname === targetUrlObj.pathname
        } catch {
          return false
        }
      })

      if (matchingClient && 'navigate' in matchingClient) {
        return (matchingClient as any)
          .navigate(targetUrlObj.pathname + targetUrlObj.search + targetUrlObj.hash)
          .then((c: any) => c && c.focus())
      }

      for (const client of clients) {
        if ('navigate' in client) {
          return (client as any)
            .navigate(targetUrlObj.pathname + targetUrlObj.search + targetUrlObj.hash)
            .then((c: any) => c && c.focus())
        }
      }

      return self.clients.openWindow(targetUrlObj.pathname + targetUrlObj.search + targetUrlObj.hash)
    })
  )
})
