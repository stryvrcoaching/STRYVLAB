"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Barbell, ForkKnife, Drop, CheckCircle, Circle } from "@phosphor-icons/react"
import dynamic from "next/dynamic"
import { useClientT } from "@/components/client/ClientI18nProvider"
import { getPendingSlots, type CheckinAvailability } from "@/lib/client/checkin/pendingCheckins"

const QuickWaterModal = dynamic(() => import("@/components/client/QuickWaterModal"), { ssr: false })

interface TodayStrip {
  timezone: string
  sessions: { id: string; name: string; completed: boolean }[]
  calories: { logged: number; target: number }
  water: { logged: number; target: number }
  checkin: {
    morning: boolean
    evening: boolean
    pendingCount?: number
    availability?: CheckinAvailability
    sessions: { flow_type: string; date?: string; completed_at: string | null }[]
  }
}

interface ChatTodayStripProps {
  data: TodayStrip | null
  onCheckinClick?: () => void
  onWaterClick?: () => void
  onRefresh?: () => void
  className?: string
  surfaceClassName?: string
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

export default function ChatTodayStrip({ data, onCheckinClick, onWaterClick, onRefresh, className, surfaceClassName }: ChatTodayStripProps) {
  const router = useRouter()
  const { lang, t } = useClientT()
  // waterOpen is only used when no external onWaterClick callback is provided
  const [waterOpen, setWaterOpen] = useState(false)
  const [, setClockTick] = useState(0)
  const handleWaterClick = onWaterClick ?? (() => setWaterOpen(true))
  const copy = {
    checkinsDone: t('chat.today.checkinsDone'),
    checkinsTwo: t('chat.today.checkinsTwo'),
    checkinsOne: t('chat.today.checkinsOne'),
  }

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick((value) => value + 1), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  if (!data || !data.checkin) {
    return (
      <div data-tour-id="daily-strip" className={`shrink-0 h-[44px] flex items-center px-3 gap-2 ${className ?? "bg-[#121212]"}`}>
        {[80, 120, 100].map(w => (
          <div key={w} className={`h-[26px] rounded-xl animate-pulse ${surfaceClassName ?? "bg-[#111111]"}`} style={{ width: w }} />
        ))}
      </div>
    )
  }

  const pendingCount = getPendingSlots(
    new Date(),
    data.timezone,
    data.checkin.sessions,
    data.checkin.availability,
  ).length
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
      <div data-tour-id="daily-strip" className={`shrink-0 ${className ?? "bg-[#121212]"}`}>
        <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto no-scrollbar">

          {/* Check-in */}
          <button
            data-tour-strip="checkin"
            data-tour-id="checkin"
            onClick={checkinDone ? undefined : onCheckinClick}
            disabled={checkinDone || !onCheckinClick}
            aria-label={checkinDone ? copy.checkinsDone : pendingCount === 2 ? copy.checkinsTwo : copy.checkinsOne}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 enabled:active:opacity-70 transition-all disabled:cursor-default ${
              surfaceClassName ?? (checkinDone ? "bg-[#5dba87]/10" : "bg-[#ff8660]/10")
            }`}
          >
            {checkinDone
              ? <CheckCircle size={13} weight="fill" className="text-[#5dba87]" />
              : <Circle size={13} weight="fill" className="text-[#ff8660]" />
            }
            <span className={`text-[11px] font-barlow font-semibold whitespace-nowrap ${checkinDone ? "text-[#5dba87]" : "text-[#ff8660]"}`}>
              {checkinDone ? copy.checkinsDone : pendingCount === 2 ? copy.checkinsTwo : copy.checkinsOne}
            </span>
          </button>

          {/* Sessions */}
          {data.sessions.map((s, idx) => (
            <button
              key={s.id}
              {...(idx === 0 ? { 'data-tour-strip': 'program' } : {})}
              onClick={() => router.push("/client/programme")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 active:opacity-70 ${
                surfaceClassName ?? (s.completed ? "bg-[#5dba87]/10" : "bg-[#ff8660]/10")
              }`}
            >
              <Barbell size={13} className={s.completed ? "text-[#5dba87]" : "text-[#ff8660]"} />
              <span className={`text-[11px] font-barlow font-medium whitespace-nowrap max-w-[100px] truncate ${
                s.completed ? "text-[#5dba87]" : "text-[#ff8660]"
              }`}>
                {s.name}
              </span>
            </button>
          ))}

          {/* Calories */}
          <button
            data-tour-strip="calories"
            onClick={() => router.push("/client/nutrition")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 active:opacity-70 ${surfaceClassName ?? "bg-[#111111]"}`}
          >
            <ForkKnife size={13} style={{ color: calColor }} />
            <span className="text-[11px] font-barlow font-medium whitespace-nowrap" style={{ color: calColor }}>
              {data.calories.logged}
            </span>
            <span className="text-[11px] font-barlow text-[#5a5a5a] whitespace-nowrap">
              / {data.calories.target}
            </span>
            {/* Track distinct from pill surface so fill is readable */}
            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/[0.14] ring-1 ring-inset ring-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${calBarWidth}%`, backgroundColor: calColor }}
              />
            </div>
          </button>

          {/* Eau */}
          <button
            data-tour-strip="water"
            onClick={handleWaterClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0 active:opacity-70 ${surfaceClassName ?? "bg-[#111111]"}`}
          >
            <Drop size={13} style={{ color: waterColor }} />
            <span className="text-[11px] font-barlow font-medium whitespace-nowrap" style={{ color: waterColor }}>
              {(data.water.logged / 1000).toFixed(1)}L
            </span>
            <span className="text-[11px] font-barlow text-[#5a5a5a] whitespace-nowrap">
              / {(data.water.target / 1000).toFixed(1)}L
            </span>
            <div className="h-1.5 w-8 overflow-hidden rounded-full bg-white/[0.14] ring-1 ring-inset ring-white/[0.06]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${waterBarWidth}%`, backgroundColor: waterColor }}
              />
            </div>
          </button>

        </div>
      </div>

      {/* Only render internal modal when no external onWaterClick is provided */}
      {!onWaterClick && (
        <QuickWaterModal
          open={waterOpen}
          onClose={() => {
            setWaterOpen(false)
            onRefresh?.()
          }}
        />
      )}
    </>
  )
}
