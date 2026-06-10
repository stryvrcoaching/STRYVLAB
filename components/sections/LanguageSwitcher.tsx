'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
// Utilisation de chemins relatifs pour corriger l'erreur "Cannot find module"
import type { Language } from '../../lib/i18n/translations'
import { useTranslation } from '../../lib/context/LanguageContext'

const languages: Array<{ code: Language; label: string; flag: string }> = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]

export function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const { switchLanguage } = useTranslation()

  // On cast la valeur pour rassurer TypeScript sur le type Language
  const currentLanguage = (params?.lang as Language) || 'fr'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleLanguageChange = (newLang: Language) => {
    if (newLang === currentLanguage) return

    // 1. Mise à jour du contexte local
    switchLanguage(newLang)

    // 2. Reconstruction de l'URL pour le SEO
    const segments = pathname.split('/')
    // Le premier segment est vide car le chemin commence par /
    // Le code langue est donc en segments[1]
    segments[1] = newLang
    const newPathname = segments.join('/')

    setIsOpen(false)
    router.push(newPathname)
  }

  const currentLangObj = languages.find((l) => l.code === currentLanguage) || languages[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/15 text-white transition-all min-h-[44px]"
      >
        <span className="text-base sm:text-lg">{currentLangObj.flag}</span>
        <span className="text-xs sm:text-sm font-light uppercase tracking-wider">
          {currentLangObj.code}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#0E0E0E]/95 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[44px] ${
                  currentLanguage === lang.code
                    ? 'bg-[#DAFA72]/10 border-l-4 border-l-[#DAFA72]'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className={`text-sm font-light ${
                  currentLanguage === lang.code ? 'text-[#DAFA72]' : 'text-white/70'
                }`}>
                  {lang.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}