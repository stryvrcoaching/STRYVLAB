'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Dumbbell, Clock, Layers, Target, Timer, Coffee,
  ChevronRight, CircleCheck, CircleOff, Play, Trophy, TrendingUp,
} from 'lucide-react'
import BodyMap from '@/components/client/BodyMap'
import { computeMuscleIntensity } from '@/lib/client/muscleDetection'
import ExerciseListDisclosure from '@/components/client/ExerciseListDisclosure'
import ClientTopBar from '@/components/client/ClientTopBar'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'
import { estimateSessionDurationMin } from '@/lib/training/sessionDuration'
import ClientWeekDayPicker, { getIsoWeekday, getWeekDates } from '@/components/client/ClientWeekDayPicker'

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false })
const CyclePhaseModal   = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'),   { ssr: false })
import type {
  PREntry,
  SessionSummary,
  SessionLog,
} from '@/lib/client/progressTypes'
import VolumeCoverageWidget from '@/components/client/smart/VolumeCoverageWidget'
import ExerciseProgressionChart from '@/components/client/smart/ExerciseProgressionChart'
import OneRMWidget from '@/components/client/smart/OneRMWidget'
import RegularityCalendarCard from '@/components/client/smart/RegularityCalendarCard'
import PeriodSegmentedControl from '@/components/client/smart/PeriodSegmentedControl'
import SectionEyebrow from '@/components/client/smart/SectionEyebrow'
import { sessionMatchesProgrammeDow } from '@/lib/client/plannedSessions'
import SkipWorkoutSheet from '@/components/client/SkipWorkoutSheet'
import WorkoutAlertsFeed from '@/components/client/smart/WorkoutAlertsFeed'
import type { WorkoutAlert } from '@/lib/client/smart/workoutAlerts'

type Tab = 'seance' | 'performances' | 'historique'

function avgRest(exercises: any[]): number | null {
  const rests = exercises.filter(ex => ex.rest_sec != null).map(ex => ex.rest_sec as number)
  if (rests.length === 0) return null
  return Math.round(rests.reduce((a, b) => a + b, 0) / rests.length)
}

function avgRir(exercises: any[]): number | null {
  const rirs = exercises.filter(ex => ex.rir != null).map(ex => ex.rir as number)
  if (rirs.length === 0) return null
  return Math.round(rirs.reduce((a, b) => a + b, 0) / rirs.length)
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  program: any
  sessions: any[]
  todayDow: number
  selectedDow: number
  activeTab: string
  currentDateIso: string
  completedTodayIds: string[]
  completedTodayNames: string[]
  startedTodayIds: string[]
  skippedTodayIds: string[]
  todayScheduledSessionIds: string[]
  todayDayOverrideKind: 'off' | null
  daysFull: string[]
  lang: ClientLang
  // Performance
  streak: number
  bestStreak: number
  allTimePRs: PREntry[]
  sessionList: SessionSummary[]
  rawLogs: SessionLog[]
  volumeCoverage?: {
    week_start: string
    sessions_count: number
    groups: any[]
    windows?: Record<'current_week' | '7d' | '14d' | '30d', { range_start: string; sessions_count: number; groups: any[] }>
  }
  recentFlexHistory?: {
    id: string
    name: string
    date: string
    volume: number
    setsCompleted: number
    durationMin: number | null
    kind: 'flex'
    href: string
  }[]
  exerciseDict?: Record<string, string>
  workoutAlerts?: WorkoutAlert[]
}

const SKIP_REASON_OPTIONS = [
  { key: 'sick_unwell', labelKey: 'programme.skip.reason.sick_unwell' },
  { key: 'fatigue_recovery', labelKey: 'programme.skip.reason.fatigue_recovery' },
  { key: 'pain_discomfort', labelKey: 'programme.skip.reason.pain_discomfort' },
  { key: 'personal_work_conflict', labelKey: 'programme.skip.reason.personal_work_conflict' },
  { key: 'travel_logistics', labelKey: 'programme.skip.reason.travel_logistics' },
] as const

const PERFORMANCE_PERIOD_OPTIONS = [
  { value: '7d', label: '7j' },
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: 'all', label: 'Tout' },
] as const

// ── Component ──────────────────────────────────────────────────────────────

export default function ProgrammeClientPage({
  program,
  sessions,
  todayDow,
  selectedDow: initialDow,
  activeTab: initialTab,
  currentDateIso,
  completedTodayIds,
  completedTodayNames,
  startedTodayIds,
  skippedTodayIds,
  todayScheduledSessionIds,
  todayDayOverrideKind,
  daysFull,
  lang,
  streak,
  bestStreak,
  allTimePRs,
  sessionList,
  rawLogs,
  volumeCoverage = { week_start: '', sessions_count: 0, groups: [], windows: undefined },
  recentFlexHistory = [],
  exerciseDict = {},
  workoutAlerts = [],
}: Props) {
  const { t } = useClientT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<Tab>(initialTab as Tab ?? 'seance')
  const [selectedDow, setSelectedDow] = useState(initialDow)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [cycleState, setCycleState] = useState<CycleState | null>(null)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState<(typeof SKIP_REASON_OPTIONS)[number]['key']>('fatigue_recovery')
  const [skipNote, setSkipNote] = useState('')
  const [skipSubmitting, setSkipSubmitting] = useState(false)
  const [skipReverting, setSkipReverting] = useState(false)
  const [skipError, setSkipError] = useState<string | null>(null)
  const [localSkippedIds, setLocalSkippedIds] = useState<string[]>(skippedTodayIds)
  const [localDayOverrideKind, setLocalDayOverrideKind] = useState<'off' | null>(todayDayOverrideKind)

  useEffect(() => {
    fetch('/api/client/cycle/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cycleState) setCycleState(data.cycleState) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLocalSkippedIds(skippedTodayIds)
  }, [skippedTodayIds])

  useEffect(() => {
    setLocalDayOverrideKind(todayDayOverrideKind)
  }, [todayDayOverrideKind])

  useEffect(() => {
    setSelectedDow(initialDow)
  }, [initialDow])

  useEffect(() => {
    setTab((initialTab as Tab) ?? 'seance')
  }, [initialTab])

  function handleTabChange(nextTab: Tab) {
    if (nextTab === tab) return

    setTab(nextTab)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)

    if (selectedDow >= 1 && selectedDow <= 7) {
      params.set('dow', String(selectedDow))
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleDayChange(date: string) {
    const nextDow = getIsoWeekday(date)
    setSelectedDow(nextDow)

    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'seance')
    params.set('dow', String(nextDow))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const completedIdsSet = useMemo(() => new Set(completedTodayIds), [completedTodayIds])
  const completedNamesSet = useMemo(() => new Set(completedTodayNames), [completedTodayNames])
  const startedIdsSet = useMemo(() => new Set(startedTodayIds), [startedTodayIds])
  const skippedIdsSet = useMemo(() => new Set(localSkippedIds), [localSkippedIds])

  const todaySession = useMemo(() =>
    sessions.find((s: any) => sessionMatchesProgrammeDow(s, selectedDow)) ?? null,
    [sessions, selectedDow]
  )

  const todayExercises = useMemo(() =>
    todaySession
      ? ((todaySession.program_exercises ?? []) as any[]).sort((a: any, b: any) => a.position - b.position)
      : [],
    [todaySession]
  )

  const muscleIntensityMap = useMemo(() =>
    computeMuscleIntensity(todayExercises.map((e: any) => ({
      name: e.name,
      sets: e.sets ?? 3,
      primary_muscles: e.primary_muscles ?? [],
      secondary_muscles: e.secondary_muscles ?? [],
      primary_muscle: e.primary_muscle ?? null,
      primary_activation: e.primary_activation ?? null,
      secondary_muscles_detail: e.secondary_muscles_detail ?? [],
      secondary_activations: e.secondary_activations ?? [],
    }))),
    [todayExercises]
  )

  const durationMin = todaySession ? estimateSessionDurationMin(todayExercises, program?.goal ?? 'hypertrophy') : null
  const totalSets = todayExercises.reduce((s: number, e: any) => s + (e.sets ?? 0), 0)
  const restAvg = todaySession ? avgRest(todayExercises) : null
  const rirAvg = todaySession ? avgRir(todayExercises) : null

  const isViewingToday = selectedDow === todayDow
  const isScheduledForActualToday = todaySession ? todayScheduledSessionIds.includes(todaySession.id) : false
  const isSessionStarted = todaySession ? startedIdsSet.has(todaySession.id) : false
  const isSessionSkipped = todaySession ? skippedIdsSet.has(todaySession.id) : false
  const showSkipAction = Boolean(
    todaySession
    && isViewingToday
    && isScheduledForActualToday
    && !isSessionStarted
    && !isSessionSkipped
    && !completedIdsSet.has(todaySession.id)
    && !completedNamesSet.has(todaySession.name)
  )

  async function handleConfirmSkip() {
    if (!todaySession || skipSubmitting) return
    setSkipSubmitting(true)
    setSkipError(null)
    try {
      const res = await fetch('/api/client/programme/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programSessionId: todaySession.id,
          scheduledDate: currentDateIso,
          reasonKey: skipReason,
          note: skipNote.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSkipError(data?.error ?? ct(lang, 'programme.skip.error.failed'))
        return
      }
      setLocalSkippedIds((prev) => prev.includes(todaySession.id) ? prev : [...prev, todaySession.id])
      setLocalDayOverrideKind('off')
      setSkipOpen(false)
      setSkipNote('')
      router.refresh()
    } finally {
      setSkipSubmitting(false)
    }
  }

  async function handleUndoSkip() {
    if (!todaySession || skipReverting) return
    setSkipReverting(true)
    setSkipError(null)
    try {
      const res = await fetch('/api/client/programme/skip', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programSessionId: todaySession.id,
          scheduledDate: currentDateIso,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSkipError(data?.error ?? ct(lang, 'programme.skip.undo.error.notFound'))
        return
      }
      setLocalSkippedIds((prev) => {
        const next = prev.filter((id) => id !== todaySession.id)
        setLocalDayOverrideKind(next.length > 0 ? 'off' : null)
        return next
      })
      router.refresh()
    } finally {
      setSkipReverting(false)
    }
  }

  // Historique — 30 dernières séances
  const recentSessions = useMemo(() =>
    [...sessionList].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    [sessionList]
  )

  const unifiedHistory = useMemo(() => {
    const planned = recentSessions.map((session) => ({
      ...session,
      kind: 'planned' as const,
      href: `/client/programme/recap/${session.id}`,
    }))

    return [...planned, ...recentFlexHistory]
      .sort((a, b) => {
        if (b.date === a.date) return (b.kind === 'flex' ? 1 : 0) - (a.kind === 'flex' ? 1 : 0)
        return b.date.localeCompare(a.date)
      })
      .slice(0, 30)
  }, [recentSessions, recentFlexHistory])

  // Timeline pour le graphe volume
  const timeline = useMemo(() => {
    const map: Record<string, { date: string; volume: number }> = {}
    for (const log of rawLogs) {
      const date = log.logged_at.split('T')[0]
      if (!map[date]) map[date] = { date, volume: 0 }
      for (const s of (log.client_set_logs ?? [])) {
        if (s.completed) {
          map[date].volume += (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
        }
      }
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [rawLogs])

  const sessionRegularityDates = useMemo(
    () => Array.from(new Set(rawLogs.map((log) => log.logged_at.split('T')[0]))).sort(),
    [rawLogs],
  )

  const TABS: { id: Tab; label: string }[] = [
    { id: 'seance',       label: ct(lang, 'programme.tab.seance')       },
    { id: 'performances', label: ct(lang, 'programme.tab.performances') },
    { id: 'historique',   label: ct(lang, 'programme.tab.historique')   },
  ]

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow pb-32 overflow-x-hidden">
      <ClientTopBar
        left={
          <div className="flex gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.01em] transition-[background-color,color] duration-150 ${
                  tab === id
                    ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
                    : 'text-white/45'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <p className="hidden text-right text-[10px] font-medium leading-tight text-white/35 sm:block">
              {ct(lang, 'programme.weeks', { n: String(program.weeks) })} · {ct(lang, 'programme.sessions_count', { n: String(sessions.length) })}
            </p>
            {cycleState?.currentPhase && cycleState.currentCycleDay && (
              <>
                <CycleArcIndicator
                  phase={cycleState.currentPhase}
                  cycleDay={cycleState.currentCycleDay}
                  avgCycleLength={cycleState.avgCycleLengthDays}
                  menstrualLength={cycleState.menstrualPhaseLengthDays}
                  confidence={cycleState.confidence}
                  onClick={() => setCycleModalOpen(true)}
                />
                <CyclePhaseModal
                  open={cycleModalOpen}
                  phase={cycleState.currentPhase}
                  cycleDay={cycleState.currentCycleDay}
                  avgCycleLength={cycleState.avgCycleLengthDays}
                  context="training"
                  onClose={() => setCycleModalOpen(false)}
                />
              </>
            )}
          </div>
        }
      />

      <main className="client-page-top mx-auto flex max-w-lg flex-col gap-4 px-5">

        {/* ══════════════════════════════════════════════════════════════
            TAB — SÉANCE
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'seance' && (
          <>
            <WorkoutAlertsFeed alerts={workoutAlerts} />

            <ClientWeekDayPicker
              anchorDate={currentDateIso}
              selectedDate={getWeekDates(currentDateIso)[selectedDow - 1]}
              locale={lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB'}
              onSelectDate={handleDayChange}
              isDateDisabled={(date) => {
                const dow = getIsoWeekday(date)
                return dow !== todayDow && !sessions.some((session: any) => sessionMatchesProgrammeDow(session, dow))
              }}
            />

            {todaySession ? (
              <div className="bg-white/[0.02] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-5 pt-5 pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-1">
                    {daysFull[selectedDow - 1]}{!isViewingToday ? ` · ${ct(lang, 'programme.preview')}` : ''}
                  </p>
                  <h2 className="text-[20px] font-bold text-white leading-tight">{todaySession.name}</h2>
                  <p className="text-[12px] text-white/35 mt-0.5">
                    {todayExercises.length} {ct(lang, 'programme.session.exercises')}
                  </p>
                </div>

                {/* BodyMap */}
                <div className="px-5 py-4 flex justify-center">
                  <BodyMap intensityMap={muscleIntensityMap} />
                </div>

                {/* Stats pills */}
                <div className="px-5 py-4 flex gap-2 flex-wrap">
                  {durationMin !== null && <StatPill icon={<Clock size={10} />} label={`~${durationMin} min`} />}
                  <StatPill icon={<Layers size={10} />} label={`${totalSets} ${ct(lang, 'programme.session.sets')}`} />
                  <StatPill icon={<Dumbbell size={10} />} label={`${todayExercises.length} ex.`} />
                  {restAvg !== null && <StatPill icon={<Timer size={10} />} label={ct(lang, 'programme.rest.avgsec', { n: String(restAvg) })} />}
                  {rirAvg !== null && <StatPill icon={<Target size={10} />} label={`RIR ${rirAvg}`} />}
                </div>

                {/* Exercices disclosure */}
                <ExerciseListDisclosure
                  exercises={todayExercises.map((ex: any) => ({
                    id: ex.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                  }))}
                />

                {/* CTA */}
                <div className="px-5 pb-5 pt-3">
                  {(completedIdsSet.has(todaySession.id) || completedNamesSet.has(todaySession.name)) ? (
                    <div className="flex items-center justify-between w-full bg-[#222222] pl-5 pr-2 py-2 rounded-xl gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#f2f2f2]">
                          <span className="truncate">{ct(lang, 'programme.session.done').replace(/\s*[✓✔]$/, '')}</span>
                          <CircleCheck aria-hidden size={14} strokeWidth={2.5} className="shrink-0 text-[#5dba87]" />
                        </div>
                        <p className="mt-1 text-[10px] text-white/45">{ct(lang, 'programme.start.flex.alt')}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/client/flex-workout?sourceWorkoutId=${todaySession.id}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#f2f2f2]/10 px-3 text-[#f2f2f2] text-[10px] font-bold whitespace-nowrap hover:bg-[#f2f2f2]/15 transition-colors"
                        >
                          {ct(lang, 'programme.start.flex')}
                        </Link>
                        <Link
                          href={`/client/programme/session/${todaySession.id}?fromDow=${selectedDow}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/[0.04] px-3 text-white/70 text-[10px] font-bold whitespace-nowrap hover:bg-white/[0.06] transition-colors"
                        >
                          {ct(lang, 'programme.session.redo')}
                        </Link>
                      </div>
                    </div>
                  ) : isSessionSkipped ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white">
                            {ct(lang, 'programme.session.cancelled')}
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            {ct(lang, 'programme.session.cancelled.desc')}
                          </p>
                        </div>
                        {localDayOverrideKind === 'off' && (
                          <span className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/50">
                            {ct(lang, 'programme.rest.tag')}
                          </span>
                        )}
                      </div>
                      {isViewingToday && (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <p className="text-[10px] text-white/30">
                            {ct(lang, 'programme.skip.undo.desc')}
                          </p>
                          <button
                            onClick={handleUndoSkip}
                            disabled={skipReverting}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/80 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {skipReverting ? ct(lang, 'programme.skip.undoing') : ct(lang, 'programme.skip.undo.btn')}
                          </button>
                        </div>
                      )}
                      {skipError && (
                        <p className="mt-3 text-[11px] text-[#ff8b8b]">{skipError}</p>
                      )}
                    </div>
                  ) : isSessionStarted ? (
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/client/programme/session/${todaySession.id}?fromDow=${selectedDow}`}
                        className="flex items-center justify-between w-full bg-[#f2f2f2] pl-5 pr-1.5 py-1.5 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.99] transition-all"
                      >
                        <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-[#080808]">
                          {ct(lang, 'programme.session.resume')}
                        </span>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.15]">
                          <Dumbbell size={15} className="text-[#080808]" />
                        </div>
                      </Link>
                      <Link
                        href={`/client/flex-workout?sourceWorkoutId=${todaySession.id}`}
                        className="flex items-center justify-between w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-5 pr-1.5 py-1.5 hover:bg-white/[0.05] active:scale-[0.99] transition-all"
                      >
                        <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-white/85">
                          {ct(lang, 'programme.start.flex')}
                        </span>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                          <Dumbbell size={15} className="text-white/80" />
                        </div>
                      </Link>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <Link
                        href={`/client/programme/session/${todaySession.id}?fromDow=${selectedDow}`}
                        className="group flex min-h-16 items-center justify-between rounded-xl bg-[#f2f2f2] pl-5 pr-2 text-[#080808] transition-colors hover:bg-white active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818]"
                      >
                        <span className="text-[13px] font-barlow-condensed font-bold uppercase tracking-[0.11em]">
                          {ct(lang, 'programme.session.start')}
                        </span>
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-black/[0.12] transition-transform group-hover:translate-x-0.5">
                          <Play size={15} fill="currentColor" aria-hidden="true" />
                        </div>
                      </Link>
                      <Link
                        href={`/client/flex-workout?sourceWorkoutId=${todaySession.id}`}
                        className="group mt-2 flex min-h-14 items-center justify-between rounded-xl bg-white/[0.045] pl-4 pr-2 text-white/80 transition-colors hover:bg-white/[0.075] hover:text-white active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818]"
                      >
                        <span className="flex items-center gap-3 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.1em]">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                            <Dumbbell size={15} aria-hidden="true" />
                          </span>
                          {ct(lang, 'programme.start.flex')}
                        </span>
                        <div className="flex h-9 w-9 items-center justify-center text-white/35 transition-colors group-hover:text-white/75">
                          <ChevronRight size={17} aria-hidden="true" />
                        </div>
                      </Link>
                      {showSkipAction && (
                        <button
                          onClick={() => setSkipOpen(true)}
                          className="mt-3 inline-flex min-h-10 items-center gap-2 px-1 text-[11px] font-medium text-white/40 transition-colors hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818]"
                        >
                          <CircleOff size={14} aria-hidden="true" />
                          {ct(lang, 'programme.session.cantDo')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/[0.02] rounded-xl px-5 py-10 text-center">
                <Coffee size={28} className="text-white/20 mx-auto mb-3" />
                <p className="text-[14px] font-semibold text-white/50">{ct(lang, 'programme.rest.today')}</p>
                <p className="text-[11px] text-white/25 mt-1">{ct(lang, 'programme.rest.recover')}</p>
                <div className="mt-4">
                  <Link
                    href="/client/flex-workout"
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/[0.04] px-4 text-[11px] font-bold text-white transition-colors hover:bg-white/[0.06]"
                  >
                    {ct(lang, 'programme.start.flex')}
                    <Dumbbell size={14} className="ml-2" />
                  </Link>
                </div>
                {(() => {
                  const sessionsByDow = [...sessions].sort((a: any, b: any) => {
                    const da = (a.days_of_week?.length ? Math.min(...a.days_of_week) : a.day_of_week) ?? 0
                    const db = (b.days_of_week?.length ? Math.min(...b.days_of_week) : b.day_of_week) ?? 0
                    return da - db
                  })
                  const next = sessionsByDow.find((s: any) => {
                    const d = (s.days_of_week?.length ? Math.min(...s.days_of_week) : s.day_of_week) ?? 0
                    return d > selectedDow
                  }) ?? sessionsByDow[0]
                  if (!next) return null
                  return (
                    <p className="text-[10px] text-white/25 mt-4">
                  {ct(lang, 'programme.session.next')} ·{' '}
                      <span className="text-white/40">
                        {(next.days_of_week?.length ? next.days_of_week : [next.day_of_week ?? 1])
                          .map((d: number) => daysFull[d - 1]).join('/')} — {next.name}
                      </span>
                    </p>
                  )
                })()}
              </div>
            )}

            {/* Volume hebdomadaire */}
            {volumeCoverage.groups.length > 0 && (
              <VolumeCoverageWidget
                weekStart={volumeCoverage.week_start}
                sessionsCount={volumeCoverage.sessions_count}
                groups={volumeCoverage.groups}
                windows={volumeCoverage.windows}
              />
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB — PERFORMANCES
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'performances' && (
          <div className="flex flex-col gap-4">
            <RegularityCalendarCard
              loggedDates={sessionRegularityDates}
              today={currentDateIso}
              title={ct(lang, 'programme.performance.activity')}
              streakLabel={ct(lang, 'common.days')}
            />

            {/* Filtre période */}
            <PeriodSegmentedControl
              options={PERFORMANCE_PERIOD_OPTIONS.map((option) => ({
                ...option,
                label:
                  option.value === '7d'
                    ? ct(lang, 'progress.period.7')
                    : option.value === '30d'
                      ? ct(lang, 'progress.period.30')
                      : option.value === '90d'
                        ? ct(lang, 'progress.period.90')
                        : ct(lang, 'progress.period.all'),
              }))}
              value={period}
              onChange={setPeriod}
            />

            {/* KPIs filtrés par période */}
            {sessionList.length > 0 && (() => {
              const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null
              const sinceStr = days ? (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0] })() : ''
              const recent = days ? sessionList.filter(s => s.date >= sinceStr) : sessionList
              const volume = recent.reduce((sum, s) => sum + s.volume, 0)
              const sets = recent.reduce((sum, s) => sum + s.setsCompleted, 0)
              const periodLabel = period === '7d' ? ct(lang, 'programme.period.7d') : period === '30d' ? ct(lang, 'programme.period.30d') : period === '90d' ? ct(lang, 'programme.period.90d') : ct(lang, 'programme.period.total')
              return (
                <div className="flex flex-col gap-2.5">
                  <SectionEyebrow>{periodLabel}</SectionEyebrow>
                  <div className="grid grid-cols-3 gap-2">
                    <KpiCard label={ct(lang, 'programme.kpi.sessions')} value={recent.length} />
                    <KpiCard label={ct(lang, 'progress.kpi.volume')} value={volume >= 1000 ? `${(volume / 1000).toFixed(1)}t` : `${Math.round(volume)}kg`} />
                    <KpiCard label={ct(lang, 'progress.kpi.sets')} value={sets} />
                  </div>
                </div>
              )
            })()}

            {/* PRs inline */}
            {allTimePRs.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <SectionEyebrow>{ct(lang, 'programme.prs')}</SectionEyebrow>
                <div className="space-y-2">
                  {allTimePRs.slice(0, 5).map((pr, i) => (
                    <div key={i} className="flex items-center justify-between rounded-2xl bg-[#161616] px-4 py-3">
                      <span className="text-[12px] text-white/70">{pr.exercise}</span>
                      <span className="text-[12px] font-bold text-[#f2f2f2] tabular-nums">{pr.maxWeight}kg</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exercise Progression Chart */}
            {rawLogs.length > 0 && <ExerciseProgressionChart rawLogs={rawLogs} />}

            {/* 1RM Trends Widget */}
            {sessionList.length > 0 && (
              <div>
                <OneRMWidget clientId={program.client_id} exerciseDict={exerciseDict} />
              </div>
            )}

            {sessionList.length === 0 && (
              <div className="text-center py-12">
                <TrendingUp size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-[12px] text-white/25">{ct(lang, 'programme.noPerfFirst')}</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB — HISTORIQUE
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'historique' && (
          <div className="flex flex-col gap-2">
            {unifiedHistory.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-[12px] text-white/25">{ct(lang, 'programme.noHistory')}</p>
              </div>
            ) : (
              unifiedHistory.map(session => {
                const [, m, d] = session.date.split('-')
                return (
                  <Link
                    key={`${session.kind}-${session.id}`}
                    href={session.href}
                    className="flex items-center justify-between bg-white/[0.02] rounded-xl px-4 py-3 hover:bg-white/[0.04] active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center w-9 shrink-0">
                        <p className="text-[12px] font-black text-white/50 font-mono">{d}/{m}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-white/80 truncate">{session.name}</p>
                          {session.kind === 'planned' && session.hasPR && (
                            <span className="shrink-0 flex items-center gap-1 bg-[#f2f2f2]/15 text-[#f2f2f2] text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full">
                              <Trophy size={8} />PR
                            </span>
                          )}
                          {session.kind === 'flex' && (
                            <span className="shrink-0 flex items-center gap-1 bg-white/[0.08] text-white/65 text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full">
                              Flex Workout
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Layers size={9} />{session.setsCompleted} sets
                          </span>
                          {session.durationMin && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                              <Clock size={9} />{session.durationMin}min
                            </span>
                          )}
                          {session.volume > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                              <TrendingUp size={9} />
                              {session.volume >= 1000 ? `${(session.volume / 1000).toFixed(1)}t` : `${session.volume}kg`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-white/20 shrink-0 ml-2" />
                  </Link>
                )
              })
            )}
          </div>
        )}


      </main>

      <SkipWorkoutSheet
        open={skipOpen && Boolean(todaySession)}
        title={ct(lang, 'programme.skip.modal.title')}
        description={ct(lang, 'programme.skip.modal.desc')}
        closeLabel={ct(lang, 'ui.close')}
        noteLabel={ct(lang, 'programme.skip.note')}
        notePlaceholder={ct(lang, 'programme.skip.note.placeholder')}
        cancelLabel={ct(lang, 'common.cancel')}
        confirmLabel={skipSubmitting ? ct(lang, 'programme.skip.confirming') : ct(lang, 'common.confirm')}
        options={SKIP_REASON_OPTIONS.map((option) => ({
          key: option.key,
          label: ct(lang, option.labelKey),
        }))}
        selectedReason={skipReason}
        note={skipNote}
        submitting={skipSubmitting}
        error={skipError}
        onClose={() => {
          setSkipOpen(false)
          setSkipError(null)
        }}
        onReasonChange={(reason) => setSkipReason(reason as typeof skipReason)}
        onNoteChange={setSkipNote}
        onConfirm={handleConfirmSkip}
      />
    </div>
  )
}

function StatPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-xl px-3 py-1.5">
      <span className="text-white/35">{icon}</span>
      <span className="text-[11px] font-medium text-white/55">{label}</span>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[#161616] px-4 py-4 text-center">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="text-[1.3rem] font-black leading-none font-mono text-white">{value}</p>
    </div>
  )
}
