'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'stryv.internal-dashboard.help-mode'

type HelpModeContextValue = {
  enabled: boolean
  setEnabled: (value: boolean) => void
  toggle: () => void
}

const HelpModeContext = createContext<HelpModeContextValue | null>(null)

export function HelpModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === '1') setEnabled(true)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {}
  }, [enabled])

  const value = useMemo<HelpModeContextValue>(
    () => ({
      enabled,
      setEnabled,
      toggle: () => setEnabled((current) => !current),
    }),
    [enabled],
  )

  return <HelpModeContext.Provider value={value}>{children}</HelpModeContext.Provider>
}

export function useHelpMode() {
  const context = useContext(HelpModeContext)
  if (!context) {
    return {
      enabled: false,
      setEnabled: () => {},
      toggle: () => {},
    }
  }
  return context
}
