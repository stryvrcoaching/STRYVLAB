'use client'

import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown, Dna, BarChart3, RefreshCw, HeartPulse, Droplet, Dumbbell } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { Language } from '@/lib/i18n/translations'
import { getTranslation } from '@/lib/i18n/translations'
import { navigationItems } from '@/lib/navigation-constants'

// Motion components
const MotionHeader = motion.header
const MotionNav = motion.nav
const MotionDiv = motion.div

// Tools list
const toolsList = [
  { id: 'macros', href: '/outils/macros', icon: Dna, label: 'Calculateur Macros' },
  { id: 'bodyFat', href: '/outils/body-fat', icon: BarChart3, label: 'Taux de Masse Grasse' },
  { id: 'carbCycling', href: '/outils/carb-cycling', icon: RefreshCw, label: 'Carb Cycling' },
  { id: 'hrZones', href: '/outils/hr-zones', icon: HeartPulse, label: 'Zones Cardiaques' },
  { id: 'hydratation', href: '/outils/hydratation', icon: Droplet, label: 'Hydratation' },
  { id: 'oneRM', href: '/outils/1rm', icon: Dumbbell, label: '1RM Calculator' },
] as const

// Definition du type pour la position (CORRECTION TYPESCRIPT ICI)
type DropdownPosition = {
  top: number;
  left: number | undefined;
  right: number | undefined;
  width: number;
}

export function HeaderMedisync() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)
  
  // CORRECTION: Ajout du type <DropdownPosition> pour autoriser 'undefined'
  const [toolsDropdownPosition, setToolsDropdownPosition] = useState<DropdownPosition>({ 
    top: 0, 
    left: 0, 
    right: undefined, 
    width: 0 
  })
  
  const [mounted, setMounted] = useState(false)
  const toolsButtonRef = useRef<HTMLButtonElement>(null)
  const toolsDropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  
  // Detect if we're on FAQ section
  useEffect(() => {
    const checkActiveSection = () => {
      if (typeof window === 'undefined' || pathname !== '/') return
      
      if (window.location.hash === '#faq') {
        setActiveSection('faq')
        return
      }
      
      const faqSection = document.getElementById('faq')
      if (faqSection) {
        const rect = faqSection.getBoundingClientRect()
        const isInViewport = rect.top <= 100 && rect.bottom >= 100
        setActiveSection(isInViewport ? 'faq' : null)
      } else {
        setActiveSection(null)
      }
    }
    
    if (typeof window !== 'undefined') {
      checkActiveSection()
      window.addEventListener('hashchange', checkActiveSection)
      window.addEventListener('scroll', checkActiveSection, { passive: true })
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('hashchange', checkActiveSection)
        window.removeEventListener('scroll', checkActiveSection)
      }
    }
  }, [pathname])
  
  // Language detection
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language
      return saved && ['fr', 'en', 'es'].includes(saved) ? saved : 'fr'
    }
    return 'fr'
  })
  const t = getTranslation(language)
  
  useEffect(() => {
    const handleLanguageChange = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('language') as Language
        if (saved && ['fr', 'en', 'es'].includes(saved)) {
          setLanguage(saved)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleLanguageChange)
      window.addEventListener('languageChanged', handleLanguageChange)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleLanguageChange)
        window.removeEventListener('languageChanged', handleLanguageChange)
      }
    }
  }, [])

  // Scroll detection
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setIsScrolled(latest > 50)
  })

  // Update tools dropdown position
  useEffect(() => {
    const updateDropdownPosition = () => {
      if (toolsButtonRef.current) {
        const rect = toolsButtonRef.current.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        
        // Calculer la position pour que le dropdown reste visible
        let left: number | undefined = rect.left
        let right: number | undefined = undefined
        
        // Si le dropdown dépasse à droite, l'aligner à droite du bouton
        const dropdownWidth = 240 // Largeur minimale du dropdown
        if (rect.left + dropdownWidth > viewportWidth) {
          right = viewportWidth - rect.right
          left = undefined
        }
        
        setToolsDropdownPosition({
          top: rect.bottom + 8,
          left: left,
          right: right,
          width: rect.width
        })
      }
    }

    if (toolsDropdownOpen) {
      updateDropdownPosition()
      window.addEventListener('resize', updateDropdownPosition)
      window.addEventListener('scroll', updateDropdownPosition, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition)
    }
  }, [toolsDropdownOpen])


  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    if (href === '/' && pathname === '/') {
      return activeSection === null
    }
    if (href === '/#faq') {
      return activeSection === 'faq' || pathname === '/' && window.location.hash === '#faq'
    }
    return pathname === href || pathname?.startsWith(href + '/')
  }

  return (
    <>
      <MotionHeader 
        className="fixed top-0 left-0 right-0 z-[9999]"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header Background */}
        <div 
          // MODIFICATION ICI : Suppression de la classe "border" et "border-[...]"
          className="absolute inset-0 shadow-depth-2 z-0 transition-all duration-300 ease-out before:absolute before:inset-0 before:rounded-b-[1.21rem] before:p-[1px] before:bg-gradient-to-br before:from-transparent before:via-transparent before:to-transparent before:-z-10 before:pointer-events-none"
          style={{
            backdropFilter: 'blur(19.2px)',
            WebkitBackdropFilter: 'blur(19.2px)',
            backgroundColor: 'rgba(255,255,255,0.18)',
            opacity: 0.96,
            borderBottomLeftRadius: '1.21rem',
            borderBottomRightRadius: '1.21rem',
            // borderTop: 'none' (plus nécessaire si on enlève la bordure globale)
          }}
        />
        
        {/* Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo */}
            <Link 
              href="/"
              className="relative z-30 flex items-center group"
            >
              <motion.span
                className="text-2xl flex items-baseline"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <span style={{ fontFamily: "'Azonix', system-ui, sans-serif", fontStyle: 'italic', color: '#FFFFFF' }}>STRYV</span>
                <span className="text-[0.95em]" style={{ fontFamily: "'Michroma', system-ui, sans-serif", marginLeft: '0.5rem' }}>Smart fit</span>
              </motion.span>
            </Link>

            {/* Desktop Navigation */}
            <MotionNav 
              className="hidden md:flex items-center gap-1 relative z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {navigationItems.map((item) => {
                if (item.hasDropdown) {
                  return (
                    <div 
                      key={item.href} 
                      className="relative"
                      onMouseEnter={() => setToolsDropdownOpen(true)}
                      onMouseLeave={() => setToolsDropdownOpen(false)}
                    >
                      <button
                        ref={toolsButtonRef}
                        className={`
                          px-3 py-0 h-[50px] rounded-full text-xs md:text-sm font-normal transition-all duration-200
                          flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0
                          ${toolsDropdownOpen 
                            ? 'bg-[rgba(237,237,237,0.5)] text-white' 
                            : 'text-white hover:text-white hover:scale-105'
                          }
                        `}
                        style={{ color: 'rgba(242,242,242,1)' }}
                      >
                        {item.label}
                        <ChevronDown 
                          className={`w-4 h-4 transition-transform duration-200 ${toolsDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                      </button>
                      
                      {/* Tools Dropdown */}
                      {mounted && toolsDropdownOpen && createPortal(
                        <motion.div
                          ref={toolsDropdownRef}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="fixed rounded-card backdrop-blur-[16px] border border-[rgba(255,255,255,0.18)] before:absolute before:inset-0 before:rounded-card before:p-[1px] before:bg-gradient-to-br before:from-transparent before:via-transparent before:to-transparent before:-z-10 shadow-depth-2 z-20 p-2 min-w-[240px]"
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            opacity: 0.8,
                            top: `${toolsDropdownPosition.top}px`,
                            left: toolsDropdownPosition.left !== undefined ? `${toolsDropdownPosition.left}px` : 'auto',
                            right: toolsDropdownPosition.right !== undefined ? `${toolsDropdownPosition.right}px` : 'auto',
                            zIndex: 99999
                          }}
                          onMouseEnter={() => setToolsDropdownOpen(true)}
                          onMouseLeave={() => setToolsDropdownOpen(false)}
                        >
                          {toolsList.map((tool) => {
                            const Icon = tool.icon
                            return (
                              <Link
                                key={tool.id}
                                href={tool.href}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-200 group"
                                style={{ color: 'rgba(242,242,242,1)' }}
                              >
                                <Icon className="w-4 h-4 text-[#19D4FF] group-hover:scale-110 transition-transform" />
                                <span>{tool.label}</span>
                              </Link>
                            )
                          })}
                        </motion.div>,
                        document.body
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      px-3 py-0 h-[50px] rounded-full text-xs md:text-sm font-normal transition-all duration-200 relative
                      flex items-center justify-center whitespace-nowrap flex-shrink-0
                      ${isActive(item.href)
                        ? 'bg-[rgba(237,237,237,0.5)] text-white hover:bg-[rgba(237,237,237,0.6)]'
                        : 'text-white hover:text-white hover:scale-105'
                      }
                    `}
                    style={{ color: 'rgba(242,242,242,1)' }}
                  >
                    {item.label}
                    {isActive(item.href) && (
                      <motion.div
                        className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#19D4FF] to-[#0FA8CC]"
                        layoutId="activeIndicator"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </MotionNav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden relative z-30 p-2 transition-colors"
              style={{ color: 'rgba(242,242,242,1)' }}
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-6 h-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <MotionDiv
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t border-white/10"
            >
              <div className="px-4 py-6 space-y-2 bg-[rgba(255,255,255,0.15)] backdrop-blur-[16px] border-t border-[rgba(255,255,255,0.18)]">
                {navigationItems.map((item) => {
                  if (item.hasDropdown) {
                    return (
                      <div key={item.href} className="space-y-2">
                        <div className="px-4 py-3 text-sm font-medium text-gray-400 uppercase tracking-wider">
                          {item.label}
                        </div>
                        {toolsList.map((tool) => {
                          const Icon = tool.icon
                          return (
                            <Link
                              key={tool.id}
                              href={tool.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                            >
                              <Icon className="w-4 h-4 text-[#19D4FF]" />
                              <span>{tool.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        block px-4 py-3 rounded-lg text-sm font-normal transition-all
                        ${isActive(item.href)
                          ? 'bg-[rgba(237,237,237,0.5)]'
                          : 'hover:bg-white/5'
                        }
                      `}
                      style={{ color: 'rgba(242,242,242,1)' }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </MotionHeader>

      {/* Spacer to prevent content from going under header */}
      <div className="h-20" />
    </>
  )
}