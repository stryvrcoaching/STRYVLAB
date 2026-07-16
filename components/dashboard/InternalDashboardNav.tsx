'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Brain, BriefcaseBusiness, HelpCircle, LayoutDashboard, MessageSquareQuote, Shield, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useHelpMode } from '@/components/dashboard/help-mode'

const ITEMS = [
  { href: '/dashboard/overview', label: 'Vue d’ensemble', shortLabel: 'Vue', icon: LayoutDashboard },
  { href: '/dashboard/business', label: 'Pilotage business', shortLabel: 'Business', icon: BriefcaseBusiness },
  { href: '/dashboard/product-feedback', label: 'Produit & retours', shortLabel: 'Produit', icon: MessageSquareQuote },
  { href: '/dashboard/stryv-connect', label: 'STRYV Connect', shortLabel: 'Connect', icon: UsersRound },
  { href: '/dashboard/security', label: 'Sécurité', shortLabel: 'Sécurité', icon: Shield },
  { href: '/dashboard/ai-nutrition-ops', label: 'Opérations IA', shortLabel: 'IA', icon: Brain },
] as const

const PAGE_HELP: Record<string, { title: string; summary: string; bullets: string[] }> = {
  '/dashboard/overview': {
    title: 'Vue d’ensemble',
    summary: 'Vue exécutive pour arbitrer vite entre produit, business, fiabilité et sécurité.',
    bullets: [
      'Priorités immédiates: ce qui doit être traité en premier.',
      'Pages les plus citées: zones produit qui concentrent la friction.',
      'Incidents récents: lecture rapide du risque opérationnel.',
    ],
  },
  '/dashboard/business': {
    title: 'Business',
    summary: 'Pilotage des revenus, de l’acquisition, des coûts IA et de la qualité de mesure.',
    bullets: [
      'Croissance 30j: comparaison avec la période précédente.',
      'Unit economics: rentabilité par client, coach et abonnement.',
      'Acquisition: demande, sources et conversion des parcours.',
    ],
  },
  '/dashboard/product-feedback': {
    title: 'Produit & retours',
    summary: 'Centralise les retours humains, les zones de friction et les décisions produit à prendre.',
    bullets: [
      'Feedback humain: retours client + coach liés aux pages.',
      'Pilotage produit: qualification, priorité et état d’avancement.',
      'Détail retour: qualification, statut et contexte brut envoyé.',
    ],
  },
  '/dashboard/stryv-connect': {
    title: 'STRYV Connect',
    summary: 'Gère l’équipe commerciale, l’attribution des prospects et les commissions.',
    bullets: [
      'Équipe commerciale: invitation et gestion des accès.',
      'Attribution: distinction entre apporteur et closer.',
      'Suivi: prospects ouverts, essais et coachs actifs.',
    ],
  },
  '/dashboard/security': {
    title: 'Sécurité',
    summary: 'Surveille refus d’accès, alertes, événements critiques et opérations sensibles.',
    bullets: [
      'Flux sécurité: volume et intensité des signaux récents.',
      'Incidents: niveau de sévérité et statut d’investigation.',
      'Contrôles: MFA, accès sensibles et posture de session.',
    ],
  },
  '/dashboard/ai-nutrition-ops': {
    title: 'Opérations IA',
    summary: 'Console d’exploitation du parsing nutrition et de la qualité de sortie IA.',
    bullets: [
      'Feedbacks: éléments à relire, corriger et exporter.',
      'Stats: volume, score moyen et top erreurs observées.',
      'Traces LLM: suivi des erreurs et qualité du pipeline IA.',
    ],
  },
}

export function InternalDashboardNav() {
  const pathname = usePathname()
  const help = pathname ? PAGE_HELP[pathname] : null
  const { enabled, toggle } = useHelpMode()
  const [pageHelpOpen, setPageHelpOpen] = useState(false)
  const pageHelpRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!pageHelpRef.current?.contains(event.target as Node)) {
        setPageHelpOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPageHelpOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <nav aria-label="Espaces de pilotage" className="rounded-2xl border border-white/[0.07] bg-[#171717]/95 p-2 shadow-[0_14px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1">
            {ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group inline-flex h-10 items-center gap-2 rounded-xl border px-3 transition focus:outline-none focus:ring-2 focus:ring-white/20 ${
                    active
                      ? 'border-white/16 bg-white text-[#121212]'
                      : 'border-transparent text-white/52 hover:bg-white/[0.055] hover:text-white'
                  }`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span className="text-[11px] font-semibold sm:hidden">{item.shortLabel}</span>
                  <span className="hidden text-[11px] font-semibold sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-l border-white/[0.07] pl-2">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            aria-label={enabled ? 'Désactiver le mode aide' : 'Activer le mode aide'}
            className={`inline-flex h-9 items-center gap-2 rounded-xl border px-2.5 text-[11px] transition focus:outline-none focus:ring-2 focus:ring-white/20 ${
              enabled
                ? 'border-white/18 bg-white/[0.10] text-white'
                : 'border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <HelpCircle size={14} />
            <span className="hidden xl:inline">{enabled ? 'Aide active' : 'Mode aide'}</span>
          </button>

          {help ? (
            <div ref={pageHelpRef} className="relative">
              <button
                type="button"
                aria-label={`Aide ${help.title}`}
                aria-expanded={pageHelpOpen}
                onClick={() => setPageHelpOpen((current) => !current)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-white/20 ${enabled ? 'border-white/16 bg-white/[0.08] text-white/88 hover:bg-white/[0.12]' : 'border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'}`}
              >
                <HelpCircle size={16} />
              </button>

              <div className={`absolute right-0 top-11 z-[70] w-[min(320px,calc(100vw-32px))] rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition duration-150 ${pageHelpOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'} `}>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">Aide page</p>
                <p className="mt-2 text-[15px] font-semibold text-white">{help.title}</p>
                <p className="mt-2 text-[13px] leading-6 text-white/78">{help.summary}</p>
                <div className="mt-3 space-y-2">
                  {help.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-xl border border-white/[0.06] bg-white/[0.045] px-3 py-2 text-[12px] leading-5 text-white/74">
                      {bullet}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
