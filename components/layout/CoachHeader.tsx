'use client'

import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/layout/NotificationBell'

const ROUTE_TITLES: { match: (p: string) => boolean; label: string }[] = [
  { match: (p) => p === '/dashboard',                    label: 'Dashboard' },
  { match: (p) => p.startsWith('/coach/clients') && p.split('/').length > 3, label: 'Dossier client' },
  { match: (p) => p === '/coach/clients',                label: 'Clients' },
  { match: (p) => p.startsWith('/coach/assessments'),    label: 'Bilans' },
  { match: (p) => p.startsWith('/coach/programs'),       label: 'Programmes' },
  { match: (p) => p.startsWith('/outils'),               label: 'Outils' },
]

function getTitle(pathname: string) {
  return ROUTE_TITLES.find((r) => r.match(pathname))?.label ?? ''
}

export default function CoachHeader() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="sticky top-0 z-40 h-14 bg-surface/80 backdrop-blur-xl border-b border-white/60 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-bold text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <NotificationBell />
      </div>
    </header>
  )
}
