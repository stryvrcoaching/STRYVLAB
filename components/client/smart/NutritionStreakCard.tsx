import { Flame } from 'lucide-react'

type Props = {
  /** Set of ISO dates (YYYY-MM-DD) where at least one meal was logged */
  loggedDates: Set<string>
  /** Today's physiological date */
  today: string
}

function parseUTC(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function shiftUTC(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

function computeStreak(loggedDates: Set<string>, today: string): { current: number; longest: number } {
  // Walk backwards from today counting consecutive logged days
  let current = 0
  let cursor = today
  while (loggedDates.has(cursor)) {
    current++
    cursor = shiftUTC(cursor, -1)
  }

  // Longest: scan all logged dates sorted
  const sorted = Array.from(loggedDates).sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    if (prev === null || shiftUTC(prev, 1) === d) {
      run++
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prev = d
  }
  longest = Math.max(longest, current)

  return { current, longest }
}

const DOW_FR_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function getUTCDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return (jsDay + 6) % 7 // 0=Mon … 6=Sun
}

/** Build a 5-week grid (35 cells) ending on today's week */
function buildCalendarGrid(today: string): string[] {
  const todayDow = getUTCDow(today)
  // End = last Sunday of the week containing today
  // Start = 35 days before the end
  const endOffset = 6 - todayDow // days until Sunday
  const end = shiftUTC(today, endOffset)
  const start = shiftUTC(end, -34)

  const cells: string[] = []
  let cursor = start
  for (let i = 0; i < 35; i++) {
    cells.push(cursor)
    cursor = shiftUTC(cursor, 1)
  }
  return cells
}

function formatMonthLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(Date.UTC(y, m - 1, d)))
}

export default function NutritionStreakCard({ loggedDates, today }: Props) {
  const { current, longest } = computeStreak(loggedDates, today)
  const cells = buildCalendarGrid(today)

  // Month change labels — show month name when month changes in grid row
  const monthLabels: (string | null)[] = cells.map((d, i) => {
    if (i === 0) return formatMonthLabel(d)
    const prev = cells[i - 1]
    return d.slice(0, 7) !== prev.slice(0, 7) ? formatMonthLabel(d) : null
  })

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">
          Régularité
        </span>
        <div className="flex items-center gap-3">
          {/* Longest */}
          <div className="text-center">
            <p className="text-[11px] font-black text-white/50 tabular-nums">{longest}</p>
            <p className="text-[8px] text-white/25 uppercase tracking-[0.1em]">record</p>
          </div>
          {/* Current streak */}
          <div className="flex items-center gap-1.5 bg-[#222222] rounded-xl px-3 py-1.5">
            <Flame size={13} className="text-[#f2f2f2] shrink-0" fill="#f2f2f2" />
            <p className="text-[16px] font-black text-[#f2f2f2] tabular-nums leading-none">{current}</p>
            <p className="text-[9px] text-[#f2f2f2]/60 font-bold uppercase leading-none">jours</p>
          </div>
        </div>
      </div>

      {/* DOW headers */}
      <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
        {DOW_FR_SHORT.map((label, i) => (
          <div key={i} className="text-center text-[8px] text-white/20 font-bold">{label}</div>
        ))}
      </div>

      {/* Calendar grid — 5 rows × 7 cols */}
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((d, i) => {
          const isToday = d === today
          const isFuture = d > today
          const logged = loggedDates.has(d)
          // Month label overlaid on first cell of new month
          const monthChange = monthLabels[i]

          let bg: string
          let ring = ''
          if (isFuture) {
            bg = 'bg-white/[0.03]'
          } else if (isToday) {
            bg = logged ? 'bg-[#f2f2f2]' : 'bg-white/[0.08]'
            ring = 'ring-1 ring-[#f2f2f2]/60 ring-offset-1 ring-offset-[#111111]'
          } else if (logged) {
            bg = 'bg-[#f2f2f2]/70'
          } else {
            bg = 'bg-white/[0.05]'
          }

          return (
            <div key={d} className="relative aspect-square">
              <div className={`w-full h-full rounded-[4px] ${bg} ${ring} transition-colors`} />
              {monthChange && i % 7 === 0 && (
                <span className="absolute -top-[10px] left-0 text-[7px] text-white/25 font-bold capitalize">
                  {monthChange}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-end">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-white/[0.05]" />
          <span className="text-[8px] text-white/25">Non tracé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#f2f2f2]/70" />
          <span className="text-[8px] text-white/25">Tracé</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[3px] bg-[#f2f2f2]" />
          <span className="text-[8px] text-white/25">Aujourd'hui</span>
        </div>
      </div>
    </div>
  )
}
