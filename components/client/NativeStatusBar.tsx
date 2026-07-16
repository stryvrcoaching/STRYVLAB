"use client"

import { useEffect } from "react"

const STATUS_BAR_COLOR = "#09090a"

export default function NativeStatusBar() {
  useEffect(() => {
    let active = true

    async function configure() {
      const [{ Capacitor }, { StatusBar, Style }] = await Promise.all([
        import("@capacitor/core"),
        import("@capacitor/status-bar"),
      ])

      if (!active || !Capacitor.isNativePlatform()) return

      try {
        async function setOverlayAndWait(overlay: boolean) {
          let resolveChange: (() => void) | null = null
          const changed = new Promise<void>((resolve) => {
            resolveChange = resolve
          })
          const listener = await StatusBar.addListener(
            "statusBarOverlayChanged",
            (info) => {
              if (info.overlays === overlay) resolveChange?.()
            },
          )

          await StatusBar.setOverlaysWebView({ overlay })
          await Promise.race([
            changed,
            new Promise<void>((resolve) => window.setTimeout(resolve, 150)),
          ])
          await listener.remove()
        }

        await setOverlayAndWait(false)
        await StatusBar.setBackgroundColor({ color: STATUS_BAR_COLOR })
        await setOverlayAndWait(true)
        await StatusBar.setStyle({ style: Style.Dark })
      } catch {}
    }

    void configure()
    return () => {
      active = false
    }
  }, [])

  return <div aria-hidden="true" className="client-status-bar-surface" />
}
