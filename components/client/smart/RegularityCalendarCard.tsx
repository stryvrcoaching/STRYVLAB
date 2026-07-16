import { Flame } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { clientLocale } from '@/lib/i18n/clientTranslations'

type Props = {
  loggedDates: Iterable<string>
  today: string
  title?: string
  streakLabel?: string
}

function shiftUTC(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

function getUTCDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return (jsDay + 6) % 7
}

function computeStreak(loggedDates: Set<string>, today: string): { current: number; longest: number } {
  let current = 0
  let cursor = today
  while (loggedDates.has(cursor)) {
    current++
    cursor = shiftUTC(cursor, -1)
  }

  const sorted = Array.from(loggedDates).sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const date of sorted) {
    if (prev === null || shiftUTC(prev, 1) === date) {
      run++
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prev = date
  }

  return { current, longest: Math.max(longest, current) }
}

function buildCalendarGrid(today: string, weeks = 5): string[] {
  const todayDow = getUTCDow(today)
  const endOffset = 6 - todayDow
  const end = shiftUTC(today, endOffset)
  const totalDays = weeks * 7
  const start = shiftUTC(end, -(totalDays - 1))

  const cells: string[] = []
  let cursor = start
  for (let index = 0; index < totalDays; index++) {
    cells.push(cursor)
    cursor = shiftUTC(cursor, 1)
  }
  return cells
}

function chunkWeeks(cells: string[], weekSize = 7): string[][] {
  const weeks: string[][] = []
  for (let index = 0; index < cells.length; index += weekSize) {
    weeks.push(cells.slice(index, index + weekSize))
  }
  return weeks
}

function formatMonthLabel(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(Date.UTC(y, m - 1, d)))
}

function buildVisibleMonthRange(weeks: string[][], locale: string): string[] {
  const labels = weeks
    .map((week) => week[0])
    .filter(Boolean)
    .map((date) => formatMonthLabel(date, locale))

  return labels.filter((label, index) => labels.indexOf(label) === index)
}

const DISPLAY_WEEKS = 4
const CELL_SIZE = 22
const CELL_GAP_X = 8
const CELL_GAP_Y = 8

export default function RegularityCalendarCard({
  loggedDates,
  today,
  title,
  streakLabel,
}: Props) {
  const { lang, t } = useClientT()
  const locale = clientLocale(lang)
  const resolvedTitle = title ?? t('nutrition.consistency')
  const resolvedStreakLabel = streakLabel ?? t('common.days')
  const dayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(Date.UTC(2024, 0, 1 + index))),
  )
  const loggedSet = new Set(loggedDates)
  const { current, longest } = computeStreak(loggedSet, today)
  const cells = buildCalendarGrid(today, DISPLAY_WEEKS)
  const weeks = chunkWeeks(cells)
  const visibleMonths = buildVisibleMonthRange(weeks, locale)

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111111] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-barlow-condensed text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
            {resolvedTitle}
          </span>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/24">
            {DISPLAY_WEEKS} {t('common.weeks')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-[44px] text-center">
            <p className="text-[11px] font-black tabular-nums leading-none text-white/60">{longest}</p>
            <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-white/24">{t('progress.streak.record')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-[16px] bg-white/[0.06] px-3 py-2">
            <Flame size={14} className="shrink-0 text-[#f2f2f2]" fill="#f2f2f2" />
            <p className="text-[16px] font-black leading-none tabular-nums text-[#f2f2f2]">{current}</p>
            <p className="text-[9px] font-bold uppercase leading-none text-[#f2f2f2]/60">{resolvedStreakLabel}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] bg-black/[0.16] px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {visibleMonths.map((month) => (
              <span key={month} className="rounded-full bg-white/[0.04] px-2 py-1 text-[7px] font-bold capitalize tracking-[0.08em] text-white/38">
                {month}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-x-2.5 pb-2">
          {dayLabels.map((label, index) => (
            <div key={label} className="text-center text-[8px] font-bold text-white/20">
              {label}
            </div>
          ))}
        </div>

        <div
          className="grid grid-cols-7"
          style={{
            columnGap: CELL_GAP_X,
            rowGap: CELL_GAP_Y,
          }}
        >
          {weeks.flatMap((week) =>
            week.map((date) => {
              const isToday = date === today
              const isFuture = date > today
              const isLogged = loggedSet.has(date)

              let cellClass = 'bg-transparent border-white/[0.10]'
              if (isFuture) cellClass = 'bg-transparent border-white/[0.05]'
              else if (isLogged) cellClass = 'bg-white/[0.18] border-white/[0.06]'
              if (isToday) cellClass = isLogged ? 'bg-[#f2f2f2] border-[#f2f2f2]' : 'bg-white/[0.18] border-white/[0.12]'

              return (
                <span
                  key={date}
                  className={`mx-auto block rounded-[5px] border transition-colors ${cellClass} ${isToday ? 'ring-2 ring-[#f2f2f2]/45 ring-offset-1 ring-offset-[#151515]' : ''}`}
                  style={{ height: CELL_SIZE, width: CELL_SIZE }}
                  title={date}
                />
              )
            }),
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-white/[0.06] bg-white/[0.18]" />
          <span className="text-[8px] text-white/25">{t('common.validated')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-white/[0.10] bg-transparent" />
          <span className="text-[8px] text-white/25">{t('common.empty')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-white/[0.03] bg-[#f2f2f2]" />
          <span className="text-[8px] text-white/25">{t('common.today')}</span>
        </div>
      </div>
    </div>
  )
}
