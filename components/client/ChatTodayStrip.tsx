"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Barbell, ForkKnife, Drop, CheckCircle, Circle } from "@phosphor-icons/react"
import dynamic from "next/dynamic"

const QuickWaterModal = dynamic(() => import("@/components/client/QuickWaterModal"), { ssr: false })

interface TodayStrip {
  sessions: { id: string; name: string }[]
  calories: { logged: number; target: number }
  water: { logged: number; target: number }
  checkin: {
    morning: boolean
    evening: boolean
    pendingCount?: number
  }
}

interface ChatTodayStripProps {
  onCheckinClick?: () => void
}

/**
 * Semantic color for a progress bar based on completion ratio.
 * lenient=true: overshooting is OK (water), stays green up to 150%
 * lenient=false: strict (calories), overshooting triggers warnings
 */
function progressColor(pct: number, lenient = false): string {
  if (pct < 0.5)  return "#b84040"  // red — very low
  if (pct < 0.8)  return "#b07828"  // amber — getting there
  if (pct < 1.0)  return "#4a9264"  // green — approaching goal
  if (lenient) {
    if (pct < 1.5) return "#4a9264"  // water: still green even if over 100%
    return "#b07828"                  // water: amber only if truly excessive (>150%)
  }
  // Strict (calories)
  if (pct < 1.1) return "#b07828"  // 100–110%: slight overshoot → amber
  return "#b84040"                  // >110%: significant overshoot → red
}

export default function ChatTodayStrip({ onCheckinClick }: ChatTodayStripProps) {
  const router = useRouter()
  const [data, setData] = useState<TodayStrip | null>(null)
  const [waterOpen, setWaterOpen] = useState(false)

  function refresh() {
    fetch("/api/client/chat/today-strip")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }

  useEffect(() => { refresh() }, [])

  if (!data || !data.checkin) {
    return (
      <div className="shrink-0 h-[44px] bg-[#0d0d0d] flex items-center px-4 gap-2">
        {[80, 120, 100].map(w => (
          <div key={w} className="h-[26px] bg-[#111111] rounded-xl animate-pulse" style={{ width: w }} />
        ))}
      </div>
    )
  }

  const morningDone = data.checkin?.morning ?? false
  const eveningDone = data.checkin?.evening ?? false
  const pendingCount = data.checkin?.pendingCount ?? (Number(!morningDone) + Number(!eveningDone))
  const checkinDone = pendingCount === 0

  // Raw ratios (can exceed 1.0) — used for color; bar width is capped
  const rawCalPct  = data.calories.target > 0 ? data.calories.logged / data.calories.target : 0
  const rawWaterPct = data.water.target > 0 ? data.water.logged / data.water.target : 0

  const calBarWidth  = Math.min(rawCalPct, 1) * 100
  const waterBarWidth = Math.min(rawWaterPct, 1) * 100

  const calColor   = progressColor(rawCalPct, false)
  const waterColor = progressColor(rawWaterPct, true)

  return (
    <>
      <div className="shrink-0 bg-[#0d0d0d]">
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-none">

          {/* Check-in */}
          <button
            data-tour-strip="checkin"
            onClick={onCheckinClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 active:opacity-70 transition-all ${
              checkinDone ? "bg-[#222222]" : "bg-[#1a1a1a]"
            }`}
          >
            {checkinDone
              ? <CheckCircle size={13} weight="fill" className="text-[#f2f2f2]" />
              : <Circle size={13} className="text-[#808080]" />
            }
            <span className={`text-[11px] font-barlow font-semibold whitespace-nowrap ${checkinDone ? "text-[#f2f2f2]" : "text-[#808080]"}`}>
              {checkinDone ? "Check-ins ✓" : pendingCount === 2 ? "Check-ins (2)" : "Check-in (1)"}
            </span>
          </button>

          {/* Sessions */}
          {data.sessions.map((s, idx) => (
            <button
              key={s.id}
              {...(idx === 0 ? { 'data-tour-strip': 'program' } : {})}
              onClick={() => router.push("/client/programme")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
            >
              <Barbell size={13} className="text-[#5a5a5a]" />
              <span className="text-[11px] font-barlow font-medium text-[#808080] whitespace-nowrap max-w-[100px] truncate">
                {s.name}
              </span>
            </button>
          ))}

          {/* Calories */}
          <button
            data-tour-strip="calories"
            onClick={() => router.push("/client/nutrition")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
          >
            <ForkKnife size={13} style={{ color: calColor }} />
            <span className="text-[11px] font-barlow font-medium whitespace-nowrap" style={{ color: calColor }}>
              {data.calories.logged}
            </span>
            <span className="text-[11px] font-barlow text-[#5a5a5a] whitespace-nowrap">
              / {data.calories.target}
            </span>
            <div className="w-10 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${calBarWidth}%`, backgroundColor: calColor }}
              />
            </div>
          </button>

          {/* Eau */}
          <button
            data-tour-strip="water"
            onClick={() => setWaterOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#111111] shrink-0 active:opacity-70"
          >
            <Drop size={13} style={{ color: waterColor }} />
            <span className="text-[11px] font-barlow font-medium whitespace-nowrap" style={{ color: waterColor }}>
              {(data.water.logged / 1000).toFixed(1)}L
            </span>
            <span className="text-[11px] font-barlow text-[#5a5a5a] whitespace-nowrap">
              / {(data.water.target / 1000).toFixed(1)}L
            </span>
            <div className="w-8 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${waterBarWidth}%`, backgroundColor: waterColor }}
              />
            </div>
          </button>

        </div>
      </div>

      <QuickWaterModal
        open={waterOpen}
        onClose={() => { setWaterOpen(false); refresh() }}
      />
    </>
  )
}
