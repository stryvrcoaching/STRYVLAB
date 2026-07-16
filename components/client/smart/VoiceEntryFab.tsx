"use client"

import { useEffect } from "react"
import { Mic, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useClientT } from "@/components/client/ClientI18nProvider"
import { prefetchNutritionRoutes, warmNutritionFlows } from "@/lib/client/prefetch-nutrition-flows"

interface VoiceEntryFabProps {
  lang?: string
  onSuccess?: () => void
  currentDate?: string
}

export default function VoiceEntryFab({ currentDate }: VoiceEntryFabProps) {
  const { t } = useClientT()
  const router = useRouter()

  useEffect(() => {
    const cancelWarmup = warmNutritionFlows(router, currentDate)
    return () => {
      cancelWarmup?.()
    }
  }, [currentDate, router])

  return (
    <>
      {/* FAB cluster — stacked vertically above bottom nav */}
      <div
        className="fixed z-50 flex flex-col items-center gap-2.5"
        style={{ bottom: "82px", right: "12px" }}
      >
        {/* + Repas */}
        <button
          onMouseEnter={() => prefetchNutritionRoutes(router, currentDate)}
          onTouchStart={() => prefetchNutritionRoutes(router, currentDate)}
          onFocus={() => prefetchNutritionRoutes(router, currentDate)}
          onClick={() => {
            const query = currentDate ? `?date=${encodeURIComponent(currentDate)}` : ""
            router.push(`/client/nutrition/log${query}`)
          }}
          className="flex items-center justify-center h-11 w-11 rounded-[18px] transition-all active:scale-[0.93] shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          style={{ background: '#f2f2f2', color: '#080808' }}
          aria-label={t('ui.add.meal')}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>

        {/* Mic vocal */}
        <button
          onClick={() => {
            const params = new URLSearchParams({ input: "voice" })
            if (currentDate) params.set("date", currentDate)
            router.push(`/client/nutrition/log?${params.toString()}`)
          }}
          className="flex items-center justify-center h-11 w-11 rounded-[18px] transition-all active:scale-[0.93] shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          style={{ background: '#1a1a1a', color: '#808080' }}
          aria-label={t('chat.input.voice.start')}
        >
          <Mic size={20} />
        </button>
      </div>

    </>
  )
}
