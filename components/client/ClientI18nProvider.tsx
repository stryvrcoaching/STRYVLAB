'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { type ClientLang, ct, ctp, cta, type ClientDictKey } from '@/lib/i18n/clientTranslations'
import { readLocalStorage, writeLocalStorage } from '@/lib/client/browserStorage'
import { DEFAULT_CLIENT_LANG } from '@/lib/client/resolve-language'

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

export function ClientI18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode
  initialLang?: ClientLang
}) {
  const [lang, _setLang] = useState<ClientLang>(initialLang ?? DEFAULT_CLIENT_LANG)

  useEffect(() => {
    const stored = readLocalStorage('client_lang') as ClientLang | null
    if (!initialLang && stored && ['fr', 'en', 'es'].includes(stored)) {
      _setLang(stored)
    } else if (initialLang) {
      _setLang(initialLang)
      writeLocalStorage('client_lang', initialLang)
    }

    fetch('/api/client/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const dbLang = data?.preferences?.language as ClientLang | undefined
        if (dbLang && ['fr', 'en', 'es'].includes(dbLang)) {
          _setLang(dbLang)
          writeLocalStorage('client_lang', dbLang)
        }
      })
      .catch(() => {/* silent — keep stored/default */})
  }, [initialLang])

  useEffect(() => {
    writeLocalStorage('client_lang', lang)
    document.documentElement.lang = lang === 'fr' ? 'fr' : lang === 'es' ? 'es' : 'en'
  }, [lang])

  const setLang = useCallback((newLang: ClientLang) => {
    _setLang(newLang)
    writeLocalStorage('client_lang', newLang)
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
