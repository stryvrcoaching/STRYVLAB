'use client'

import { useEffect, useRef } from 'react'

type Props = {
  anchorDate: string
  selectedDate: string
  locale: string
  onSelectDate: (date: string) => void
  continuous?: boolean
  isDateDisabled?: (date: string) => boolean
  className?: string
}

function fromIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getTodayIsoDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getIsoWeekday(iso: string) {
  const weekday = fromIsoDate(iso).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export function getWeekDates(anchorDate: string) {
  const anchor = fromIsoDate(anchorDate)
  const monday = new Date(anchor)
  monday.setUTCDate(anchor.getUTCDate() - getIsoWeekday(anchorDate) + 1)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    return toIsoDate(date)
  })
}

function getCarouselDates(anchorDate: string, radius = 28) {
  const anchor = fromIsoDate(anchorDate)

  return Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const date = new Date(anchor)
    date.setUTCDate(anchor.getUTCDate() + index - radius)
    return toIsoDate(date)
  })
}

export default function ClientWeekDayPicker({
  anchorDate,
  selectedDate,
  locale,
  onSelectDate,
  continuous = false,
  isDateDisabled,
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedDayRef = useRef<HTMLButtonElement>(null)
  const scrollTimeoutRef = useRef<number | null>(null)
  const todayIsoDate = getTodayIsoDate()
  const dates = continuous ? getCarouselDates(selectedDate) : getWeekDates(anchorDate)
  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const fullDateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const selectedPeriodFormatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    if (!continuous) return
    const frame = window.requestAnimationFrame(() => {
      selectedDayRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [continuous, selectedDate])

  useEffect(() => () => {
    if (scrollTimeoutRef.current !== null) window.clearTimeout(scrollTimeoutRef.current)
  }, [])

  function handleScroll() {
    if (!continuous || !scrollRef.current) return
    if (scrollTimeoutRef.current !== null) window.clearTimeout(scrollTimeoutRef.current)

    scrollTimeoutRef.current = window.setTimeout(() => {
      const container = scrollRef.current
      if (!container) return
      const center = container.getBoundingClientRect().left + container.clientWidth / 2
      const dayButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-date]'))
      const closest = dayButtons.reduce<HTMLButtonElement | null>((current, button) => {
        if (!current) return button
        const currentCenter = current.getBoundingClientRect().left + current.getBoundingClientRect().width / 2
        const buttonCenter = button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2
        return Math.abs(buttonCenter - center) < Math.abs(currentCenter - center) ? button : current
      }, null)
      const nextDate = closest?.dataset.date
      if (nextDate && nextDate !== selectedDate) onSelectDate(nextDate)
    }, 140)
  }

  function renderDay(date: string, continuousItem = false) {
    const isSelected = date === selectedDate
    const isDisabled = isDateDisabled?.(date) ?? false
    const isPast = date < todayIsoDate
    const dayLabel = dayFormatter.format(fromIsoDate(date)).replace('.', '')

    return (
      <button
        key={date}
        ref={isSelected ? selectedDayRef : undefined}
        type="button"
        data-date={date}
        onClick={() => onSelectDate(date)}
        disabled={isDisabled}
        aria-current={isSelected ? 'date' : undefined}
        aria-label={fullDateFormatter.format(fromIsoDate(date))}
        className={`flex min-h-[70px] flex-col items-center justify-center rounded-[18px] px-1 py-2 transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] disabled:cursor-default ${
          continuousItem ? 'snap-center' : ''
        } ${
          isSelected
            ? 'bg-[#1f8a65] text-white shadow-[0_8px_20px_rgba(31,138,101,0.22)]'
            : isDisabled
              ? 'text-white/20'
              : isPast
                ? 'border border-[#1f8a65]/35 bg-[#1f8a65]/[0.09] text-[#79c8ad] hover:bg-[#1f8a65]/[0.14] hover:text-[#a4dfca] active:scale-[0.96]'
              : 'text-white/56 hover:bg-white/[0.05] hover:text-white active:scale-[0.96]'
        }`}
        style={continuousItem ? { flex: '0 0 calc((100% - 24px) / 7)' } : undefined}
      >
        <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.08em]">
          {dayLabel}
        </span>
        <span className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          {fromIsoDate(date).getUTCDate()}
        </span>
        {isSelected && (
          <span className="mt-1 text-[8px] font-barlow-condensed font-bold uppercase leading-none tracking-[0.1em] text-white/72">
            {selectedPeriodFormatter.format(fromIsoDate(date))}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={className}>
      {continuous ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Sélection du jour"
        >
          {dates.map(date => renderDay(date, true))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1" aria-label="Sélection du jour">
          {dates.map(date => renderDay(date))}
        </div>
      )}
    </div>
  )
}
