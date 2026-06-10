'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { useState } from 'react'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false)

  return (
    <motion.header 
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#EDF3F7]/80 border-b border-white/5"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, type: 'spring' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image src="/images/logo.png" alt="STRYV" width={32} height={32} className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-105" />
            <span className="font-unbounded font-semibold text-base text-white tracking-tight leading-none">
              STRYV<span className="font-light text-white/60"> lab</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/genesis-era" className="text-sm font-light text-white/70 hover:text-[#19D4FF] transition-colors">
              STRYV Era
            </Link>
            
            {/* Laboratoire Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setToolsDropdownOpen(true)}
              onMouseLeave={() => setToolsDropdownOpen(false)}
            >
              <button className="text-sm font-light text-white/70 hover:text-[#19D4FF] transition-colors flex items-center gap-1">
                Laboratoire
                <span className="text-xs">▼</span>
              </button>
              {toolsDropdownOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-64 bg-[rgba(255,255,255,0.15)] backdrop-blur-lg rounded-2xl border border-[rgba(255,255,255,0.25)] shadow-depth-4 z-50 py-2"
                  onMouseEnter={() => setToolsDropdownOpen(true)}
                  onMouseLeave={() => setToolsDropdownOpen(false)}
                >
                  <Link href="/outils/macros" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Calculateur Macros
                  </Link>
                  <Link href="/outils/body-fat" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Taux Masse Grasse
                  </Link>
                  <Link href="/outils/carb-cycling" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Carb Cycling
                  </Link>
                  <Link href="/outils/hr-zones" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Zones FC
                  </Link>
                  <Link href="/outils/hydratation" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Hydratation
                  </Link>
                  <Link href="/outils/1rm" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white">
                    Calculateur 1RM
                  </Link>
                  <div className="border-t border-[rgba(255,255,255,0.25)] mt-2 pt-2">
                    <Link href="/outils" className="block px-4 py-3 hover:bg-white/5 transition-colors text-sm text-[#19D4FF] font-medium">
                      → Voir Tous les Outils
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="#science" className="text-sm font-light text-white/70 hover:text-[#19D4FF] transition-colors">
              La Science
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="secondary" size="sm" className="border-[rgba(255,255,255,0.25)] text-white hover:bg-white/5">
                Connexion
              </Button>
            </Link>
            <Link href="/genesis-era">
              <Button size="sm" className="bg-[#19D4FF] hover:bg-[#19D4FF] text-[#0F2334]">
                Démarrer
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span 
              className={`w-5 h-px bg-white transition-all ${
                mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span 
              className={`w-5 h-px bg-white transition-all ${
                mobileMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span 
              className={`w-5 h-px bg-white transition-all ${
                mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <nav 
          className="md:hidden absolute top-full left-0 right-0 bg-[#EDF3F7]/95 backdrop-blur-xl border-b border-white/5 p-6 flex flex-col gap-4"
        >
          <Link
            href="/genesis-era"
            className="text-white/70 py-3 text-sm font-light hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            STRYV Era
          </Link>
          <Link
            href="/outils"
            className="text-white/70 py-3 text-sm font-light hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Laboratoire
          </Link>
          <Link
            href="#science"
            className="text-white/70 py-3 text-sm font-light hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            La Science
          </Link>
          <Link
            href="/login"
            className="text-white/70 py-3 text-sm font-light hover:text-white transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            Connexion
          </Link>
          <Link
            href="/ipt-choice"
            className="bg-[#19D4FF] text-[#0F2334] py-3 px-6 rounded-xl font-medium text-sm text-center transition-all hover:bg-[#19D4FF]"
            onClick={() => setMobileMenuOpen(false)}
          >
            Démarrer l'Analyse
          </Link>
        </nav>
      )}
    </motion.header>
  )
}









