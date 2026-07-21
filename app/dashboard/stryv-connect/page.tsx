'use client'

import { Network, UsersRound, Waypoints } from 'lucide-react'
import { SalesAdminPanel } from '@/components/dashboard/SalesAdminPanel'
import { useSetTopBar } from '@/components/layout/useSetTopBar'

export default function StryvConnectDashboardPage() {
  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/30">Interne</p>
      <p className="text-[13px] font-semibold text-white">STRYV Connect</p>
    </div>,
  )

  return (
    <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
      <div className="mx-auto max-w-[1520px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(31,138,101,0.08),transparent_34%),linear-gradient(180deg,#1b1b1b_0%,#141414_100%)] p-5 sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-[760px] min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1f8a65]/85">Réseau commercial</p>
              <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-white sm:text-[32px]">Piloter l’équipe commerciale</h1>
              <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-white/58">
                Un espace dédié pour gérer les accès, attribuer chaque prospect au bon interlocuteur et suivre les commissions sans mélanger ces opérations au backlog produit.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[620px]">
              <Purpose icon={<UsersRound size={15} />} title="Équipe" detail="Inviter et gérer les accès" />
              <Purpose icon={<Waypoints size={15} />} title="Attribution" detail="Apporteur et closer" />
              <Purpose icon={<Network size={15} />} title="Suivi" detail="Prospects et commissions" />
            </div>
          </div>
        </section>

        <SalesAdminPanel />
      </div>
    </main>
  )
}

function Purpose({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[#1f8a65]">{icon}<p className="text-[11px] font-semibold text-white">{title}</p></div>
      <p className="mt-2 text-[11px] leading-5 text-white/42">{detail}</p>
    </div>
  )
}
