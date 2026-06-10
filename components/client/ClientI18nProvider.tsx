'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { type ClientLang, ct, ctp, cta, type ClientDictKey } from '@/lib/i18n/clientTranslations'

interface ClientI18nContextType {
  lang: ClientLang
  setLang: (lang: ClientLang) => void
  t: (key: ClientDictKey, vars?: Record<string, string | number>) => string
  tp: (key: ClientDictKey, n: number) => string
  ta: (key: ClientDictKey) => string[]
}

const ClientI18nContext = createContext<ClientI18nContextType>({
  lang: 'fr',
  setLang: () => {},
  t: (key, vars) => ct('fr', key, vars),
  tp: (key, n) => ctp('fr', key, n),
  ta: (key) => cta('fr', key),
})

export function ClientI18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, _setLang] = useState<ClientLang>('fr')

  useEffect(() => {
    // Try localStorage first (instant, no flash)
    const stored = localStorage.getItem('client_lang') as ClientLang | null
    if (stored && ['fr', 'en', 'es'].includes(stored)) {
      _setLang(stored)
      return
    }
    // Then sync from DB (authoritative)
    fetch('/api/client/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const dbLang = data?.preferences?.language as ClientLang | undefined
        if (dbLang && ['fr', 'en', 'es'].includes(dbLang)) {
          _setLang(dbLang)
          localStorage.setItem('client_lang', dbLang)
        }
      })
      .catch(() => {/* silent — keep stored/default */})
  }, [])

  const setLang = useCallback((newLang: ClientLang) => {
    _setLang(newLang)
    localStorage.setItem('client_lang', newLang)
  }, [])

  // Watch for localStorage changes (cross-tab support)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'client_lang' && e.newValue && ['fr', 'en', 'es'].includes(e.newValue)) {
        _setLang(e.newValue as ClientLang)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: ClientI18nContextType = {
    lang,
    setLang,
    t: (key, vars) => ct(lang, key, vars),
    tp: (key, n) => ctp(lang, key, n),
    ta: (key) => cta(lang, key),
  }

  return (
    <ClientI18nContext.Provider value={value}>
      {children}
    </ClientI18nContext.Provider>
  )
}

export function useClientT() {
  return useContext(ClientI18nContext)
}
