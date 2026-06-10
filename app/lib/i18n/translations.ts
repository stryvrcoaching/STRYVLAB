// Module i18n minimal pour STRYV lab
export type Language = 'fr' | 'en'

type Translations = {
  [key: string]: string
}

const translations: Record<Language, Translations> = {
  fr: {
    'nav.home': 'Accueil',
    'nav.analysis': 'Analyse IPT',
    'nav.tools': 'Outils',
    'nav.faq': 'FAQ',
    'header.menu': 'Menu',
    'header.close': 'Fermer',
    'tools.macros': 'Calculateur Macros',
    'tools.bodyFat': 'Taux de Masse Grasse',
    'tools.carbCycling': 'Carb Cycling',
    'tools.hrZones': 'Zones Cardiaques',
    'tools.hydration': 'Hydratation',
    'tools.oneRM': '1RM Calculator',
    'cta.miniScan': 'Mini-Scan Gratuit',
    'cta.start': 'Commencer',
    'cta.discover': 'Découvrir',
    'common.free': 'Gratuit',
    'common.loading': 'Chargement...',
  },
  en: {
    'nav.home': 'Home',
    'nav.analysis': 'IPT Analysis',
    'nav.tools': 'Tools',
    'nav.faq': 'FAQ',
    'header.menu': 'Menu',
    'header.close': 'Close',
    'tools.macros': 'Macro Caculator',
    'tools.bodyFat': 'Body Fat %',
    'tools.carbCycling': 'Carb Cycling',
    'tools.hrZones': 'HR Zones',
    'tools.hydration': 'Hydration',
    'tools.oneRM': '1RM Calculator',
    'cta.miniScan': 'Free Mini-Scan',
    'cta.start': 'Start',
    'cta.discover': 'Discover',
    'common.free': 'Free',
    'common.loading': 'Loading...',
  }
}

export function getTranslation(lang: Language = 'fr') {
  return (key: string): string => {
    return translations[lang][key] || key
  }
}

export function getCurrentLanguage(): Language {
  if (typeof window === 'undefined') return 'fr'
  const saved = localStorage.getItem('language') as Language
  if (saved && (saved === 'fr' || saved === 'en')) return saved
  return 'fr'
}

export function setLanguage(lang: Language): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('language', lang)
  window.dispatchEvent(new Event('languageChanged'))
}
