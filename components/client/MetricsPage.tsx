"use client"

import { useRouter } from "next/navigation"
import { Gear } from "@phosphor-icons/react"
import BodyDataSection from "@/components/client/profile/BodyDataSection"

interface MetricsPageProps {
  clientName: string
  clientEmail: string
  avatarInitials: string
  avatarUrl?: string | null
  streak: number
}

export default function MetricsPage({ clientName, clientEmail, avatarInitials, avatarUrl, streak }: MetricsPageProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-full bg-[#0d0d0d]">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
        <div>
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
            MON PROFIL
          </p>
          <p className="text-[13px] font-barlow font-semibold text-white">Métriques</p>
        </div>
        <button
          onClick={() => router.push("/client/profil")}
          className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 active:bg-white/[0.08] transition-colors"
          aria-label="Paramètres"
        >
          <Gear size={16} />
        </button>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-3 px-4 pb-5">
        <div className="w-14 h-14 rounded-full bg-[#111111] shrink-0 overflow-hidden flex items-center justify-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={clientName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[18px] font-barlow-condensed font-bold text-[#f2f2f2] uppercase">
              {avatarInitials}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-barlow font-semibold text-white truncate">{clientName}</p>
          <p className="text-[11px] text-white/40 truncate">{clientEmail}</p>
        </div>
        {streak > 0 && (
          <div className="px-2.5 py-1 bg-[#222222] rounded-full shrink-0">
            <span className="text-[11px] font-barlow-condensed font-bold text-[#f2f2f2]">
              🔥 {streak}j
            </span>
          </div>
        )}
      </div>

      {/* Body data */}
      <div className="flex-1 px-4 pb-24">
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-3">
          Données corporelles
        </p>
        <BodyDataSection />
      </div>
    </div>
  )
}
