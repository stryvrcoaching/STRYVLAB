"use client"

type PrefetchRouter = {
  prefetch: (href: string) => void
}

const warmedKeys = new Set<string>()

function warmOnce(key: string, runner: () => void) {
  if (warmedKeys.has(key)) return
  warmedKeys.add(key)
  runner()
}

function scheduleIdle(task: () => void) {
  if (typeof window === "undefined") return
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(() => task(), { timeout: 1200 })
    return () => window.cancelIdleCallback(id)
  }
  const timeoutId = window.setTimeout(task, 180)
  return () => window.clearTimeout(timeoutId)
}

export function prefetchNutritionRoutes(router: PrefetchRouter, date?: string | null) {
  if (typeof window === "undefined") return
  const safeDate = date ?? new Date().toISOString().slice(0, 10)
  const routes = [
    `/client/nutrition/log?mode=default&date=${safeDate}`,
    `/client/nutrition/log?mode=search&date=${safeDate}`,
    `/client/nutrition/log/photo?date=${safeDate}`,
    `/client/nutrition/log?input=voice&date=${safeDate}`,
    `/client/nutrition/compose?date=${safeDate}`,
  ]

  for (const href of routes) {
    warmOnce(`route:${href}`, () => {
      try {
        router.prefetch(href)
      } catch {
        // noop
      }
    })
  }
}

export function preloadNutritionBundles() {
  if (typeof window === "undefined") return

  warmOnce("bundle:nutrition-log", () => {
    void import("@/app/client/nutrition/log/NutritionLogContent")
  })
  warmOnce("bundle:voice-log", () => {
    void import("@/components/client/smart/VoiceLogSheet")
  })
  warmOnce("bundle:photo-log", () => {
    void import("@/components/client/smart/PhotoMealLogSheet")
  })
  warmOnce("bundle:meal-log-sheet", () => {
    void import("@/components/client/smart/MealLogSheet")
  })
}

export function warmNutritionFlows(router: PrefetchRouter, date?: string | null) {
  return scheduleIdle(() => {
    prefetchNutritionRoutes(router, date)
    preloadNutritionBundles()
  })
}
