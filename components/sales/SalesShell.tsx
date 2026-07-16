'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { CheckSquare, CircleDollarSign, LayoutDashboard, LogOut, UsersRound } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

const navigation = [
  { href: '/sales', label: 'Pilotage', icon: LayoutDashboard },
  { href: '/sales/leads', label: 'Prospects', icon: UsersRound },
  { href: '/sales/tasks', label: 'À faire', icon: CheckSquare },
  { href: '/sales/commissions', label: 'Commissions', icon: CircleDollarSign },
]

export function SalesShell({ children, partnerName }: { children: ReactNode; partnerName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function signOut() {
    setIsSigningOut(true)
    await createClient().auth.signOut()
    router.replace('/sales/login')
    router.refresh()
  }

  return (
    <div className="min-h-dvh bg-[#121212] text-white">
      <header className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 h-14 rounded-2xl border-[0.3px] border-white/[0.14] bg-[#121212]/95 shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:inset-x-4 sm:top-4">
        <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-5">
          <Link href="/sales" className="flex min-w-0 items-center gap-3" aria-label="STRYV lab, espace commercial">
            <Image src="/images/logo.png" alt="STRYV lab" width={90} height={28} className="h-6 w-auto brightness-0 invert" priority />
            <span className="hidden border-l border-white/[0.12] pl-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42 sm:inline">STRYV Connect</span>
          </Link>

          <nav aria-label="Navigation commerciale" className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition ${active ? 'bg-white text-[#121212]' : 'text-white/52 hover:bg-white/[0.06] hover:text-white'}`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden max-w-44 truncate text-right text-[11px] text-white/48 xl:block">{partnerName}</span>
            <button
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-[11px] font-semibold text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-[1520px] px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+5.5rem)] sm:px-6 sm:pt-[104px] lg:px-8 lg:pb-10">{children}</main>

      <nav aria-label="Navigation commerciale mobile" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex h-16 items-center justify-around rounded-2xl border-[0.3px] border-white/[0.14] bg-[#121212]/95 px-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:inset-x-4 sm:bottom-4 lg:hidden">
        {navigation.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-semibold transition ${active ? 'bg-white text-[#121212]' : 'text-white/48'}`}>
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
