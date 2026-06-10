'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getTranslation } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  switchLanguage: (lang: Language) => void;
  t: any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ 
  children, 
  initialLanguage 
}: { 
  children: React.ReactNode;
  initialLanguage: string;
}) {
  // Sécurisation du typage pour éviter les erreurs de cast
  const validLang = (['fr', 'en', 'es'].includes(initialLanguage) ? initialLanguage : 'fr') as Language;
  const [language, setLanguage] = useState<Language>(validLang);

  // Synchronisation si la langue de l'URL change (via navigation)
  useEffect(() => {
    if (initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage as Language);
    }
  }, [initialLanguage]);

  const switchLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
      window.dispatchEvent(new Event('languageChange'));
    }
  };

  const t = getTranslation(language);

  return (
    <LanguageContext.Provider value={{ language, switchLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Petit fallback pour éviter que l'application ne crash totalement en cas de bug de Provider
    return { 
      language: 'fr' as Language, 
      switchLanguage: () => {}, 
      t: getTranslation('fr') 
    };
  }
  return context;
};