'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Dumbbell, Clock, Layers, Target, Timer, Coffee,
  Flame, ChevronRight, Trophy, TrendingUp, Zap, X,
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

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false })
const CyclePhaseModal   = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'),   { ssr: false })
import type {
  HeatmapDay,
  PREntry,
  SessionSummary,
  SessionLog,
} from '@/lib/client/progressTypes'
import SmartAlertsFeed, { type GenericAlert } from '@/components/client/smart/SmartAlertsFeed'
import VolumeCoverageWidget from '@/components/client/smart/VolumeCoverageWidget'
import RecentSessionsStrip from '@/components/client/smart/RecentSessionsStrip'
import ExerciseProgressionChart from '@/components/client/smart/ExerciseProgressionChart'
import OneRMWidget from '@/components/client/smart/OneRMWidget'
import DeloadAlertBanner from '@/components/client/smart/DeloadAlertBanner'

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
  todayDayOverrideKind: 'off' | null
  daysShort: string[]
  daysFull: string[]
  lang: ClientLang
  // Performance
  streak: number
  bestStreak: number
  heatmapData: HeatmapDay[]
  allTimePRs: PREntry[]
  sessionList: SessionSummary[]
  rawLogs: SessionLog[]
  // Smart Workout
  workoutAlerts?: GenericAlert[]
  volumeCoverage?: {
    week_start: string
    sessions_count: number
    groups: any[]
    windows?: Record<'current_week' | '7d' | '14d' | '30d', { range_start: string; sessions_count: number; groups: any[] }>
  }
  smartRecentSessions?: { id: string; completed_at: string; program_session_id: string | null; volume_kg: number; avg_rir: number | null }[]
}

const SKIP_REASON_OPTIONS = [
  { key: 'sick_unwell', label: 'Malade / pas en forme' },
  { key: 'fatigue_recovery', label: 'Fatigue / récupération insuffisante' },
  { key: 'pain_discomfort', label: 'Douleur / gêne physique' },
  { key: 'personal_work_conflict', label: 'Imprévu perso / boulot' },
  { key: 'travel_logistics', label: 'Déplacement / logistique' },
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
  todayDayOverrideKind,
  daysShort,
  daysFull,
  lang,
  streak,
  bestStreak,
  heatmapData,
  allTimePRs,
  sessionList,
  rawLogs,
  workoutAlerts = [],
  volumeCoverage = { week_start: '', sessions_count: 0, groups: [], windows: undefined },
  smartRecentSessions = [],
}: Props) {
  const { t } = useClientT()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>(initialTab as Tab ?? 'seance')
  const [selectedDow, setSelectedDow] = useState(initialDow)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [cycleState, setCycleState] = useState<CycleState | null>(null)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState<(typeof SKIP_REASON_OPTIONS)[number]['key']>('fatigue_recovery')
  const [skipNote, setSkipNote] = useState('')
  const [skipSubmitting, setSkipSubmitting] = useState(false)
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

  const completedIdsSet = useMemo(() => new Set(completedTodayIds), [completedTodayIds])
  const completedNamesSet = useMemo(() => new Set(completedTodayNames), [completedTodayNames])
  const startedIdsSet = useMemo(() => new Set(startedTodayIds), [startedTodayIds])
  const skippedIdsSet = useMemo(() => new Set(localSkippedIds), [localSkippedIds])

  const todaySession = useMemo(() =>
    sessions.find((s: any) =>
      (s.days_of_week?.length ? s.days_of_week : [s.day_of_week]).includes(selectedDow)
    ) ?? null,
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
  const isSessionStarted = todaySession ? startedIdsSet.has(todaySession.id) : false
  const isSessionSkipped = todaySession ? skippedIdsSet.has(todaySession.id) : false
  const showSkipAction = Boolean(todaySession && isViewingToday && !isSessionStarted && !isSessionSkipped && !completedIdsSet.has(todaySession.id) && !completedNamesSet.has(todaySession.name))

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
        setSkipError(data?.error ?? 'Impossible de passer cette séance.')
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

  // Historique — 30 dernières séances
  const recentSessions = useMemo(() =>
    [...sessionList].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
    [sessionList]
  )

  // Timeline pour le graphe volume
  const timeline = useMemo(() => {
    const map: Record<string, { date: string; volume: number }> = {}
    for (const log of rawLogs) {
      const date = log.logged_at.split('T')[0]
      if (!map[date]) map[date] = { date, volume: 0 }
      for (const s of log.client_set_logs) {
        if (s.completed) {
          map[date].volume += (s.actual_reps ?? 0) * (parseFloat(String(s.actual_weight_kg)) || 0)
        }
      }
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [rawLogs])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'seance',       label: ct(lang, 'programme.tab.seance')       },
    { id: 'performances', label: ct(lang, 'programme.tab.performances') },
    { id: 'historique',   label: ct(lang, 'programme.tab.historique')   },
  ]

  const isOnFire = streak >= 7

  return (
    <div className="min-h-screen bg-[#0d0d0d] font-barlow pb-32">
      <ClientTopBar
        left={
          <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-wide transition-all duration-200 ${
                  tab === id
                    ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
                    : 'text-white/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
        right={
          <div className="flex flex-col items-end gap-0.5">
            <p className="text-[9px] text-white/30 uppercase tracking-[0.12em]">
              {program.weeks}sem · {sessions.length} séances
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

      <main className="max-w-lg mx-auto px-5 pt-[72px] flex flex-col gap-4">

        {/* ══════════════════════════════════════════════════════════════
            TAB — SÉANCE
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'seance' && (
          <>
            {/* Deload Alert */}
            <DeloadAlertBanner clientId={program.client_id} />

            {/* Sélecteur jours */}
            <div className="flex gap-1">
              {daysShort.map((d, i) => {
                const dow = i + 1
                const hasSession = sessions.some((s: any) =>
                  (s.days_of_week?.length ? s.days_of_week : [s.day_of_week]).includes(dow)
                )
                const isToday = dow === todayDow
                const isSelected = dow === selectedDow
                const cls = `flex-1 flex flex-col items-center py-2 rounded-xl text-[10px] font-bold transition-colors ${
                  isSelected
                    ? 'bg-[#f2f2f2] text-[#080808]'
                    : isToday
                    ? 'bg-[#f2f2f2]/20 text-[#f2f2f2]'
                    : hasSession
                    ? 'bg-white/[0.04] text-white/50 hover:bg-white/[0.07] cursor-pointer'
                    : 'text-white/20'
                }`
                const dot = hasSession && (
                  <span className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-[#0d0d0d]' : 'bg-[#f2f2f2]/50'}`} />
                )
                if (!hasSession && !isToday) {
                  return <div key={d} className={cls}><span>{d}</span>{dot}</div>
                }
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDow(dow)}
                    className={cls}
                  >
                    <span>{d}</span>{dot}
                  </button>
                )
              })}
            </div>

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
                      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#f2f2f2]">
                        {ct(lang, 'programme.session.done')}
                      </span>
                      <Link
                        href={`/client/programme/session/${todaySession.id}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#f2f2f2]/10 px-3 text-[#f2f2f2] text-[10px] font-bold whitespace-nowrap hover:bg-[#f2f2f2]/15 transition-colors"
                      >
                        {ct(lang, 'programme.session.redo')}
                      </Link>
                    </div>
                  ) : isSessionSkipped ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white">
                            Séance annulée
                          </p>
                          <p className="mt-1 text-[11px] text-white/45">
                            Ton coach a été informé. Cette journée est considérée comme une journée de repos.
                          </p>
                        </div>
                        {localDayOverrideKind === 'off' && (
                          <span className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/50">
                            Repos
                          </span>
                        )}
                      </div>
                    </div>
                  ) : isSessionStarted ? (
                    <Link
                      href={`/client/programme/session/${todaySession.id}`}
                      className="flex items-center justify-between w-full bg-[#f2f2f2] pl-5 pr-1.5 py-1.5 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.99] transition-all"
                    >
                      <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-[#080808]">
                        Reprendre la séance
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.15]">
                        <Dumbbell size={15} className="text-[#080808]" />
                      </div>
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/client/programme/session/${todaySession.id}`}
                        className="flex items-center justify-between w-full bg-[#f2f2f2] pl-5 pr-1.5 py-1.5 rounded-xl hover:bg-[#e0e0e0] active:scale-[0.99] transition-all"
                      >
                        <span className="text-[12px] font-barlow-condensed font-bold uppercase tracking-wide text-[#080808]">
                          {ct(lang, 'programme.session.start')}
                        </span>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.15]">
                          <Dumbbell size={15} className="text-[#080808]" />
                        </div>
                      </Link>
                      {showSkipAction && (
                        <button
                          onClick={() => setSkipOpen(true)}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white/80"
                        >
                          Je ne peux pas faire cette séance
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
                  Prochaine ·{' '}
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
            {workoutAlerts.length > 0 && <SmartAlertsFeed alerts={workoutAlerts} />}
            {smartRecentSessions.length > 0 && <RecentSessionsStrip sessions={smartRecentSessions} />}

            {/* Streak */}
            {streak > 0 ? (
              <div
                className="relative rounded-xl overflow-hidden px-5 py-5"
                style={{
                  background: isOnFire ? '#1a1a1a' : '#111111',
                }}
              >
                <div className="flex items-center">
                  <div className="flex-1">
                    <div className="flex items-end gap-2 mb-1">
                      <span className="font-black font-mono leading-none text-[3.5rem]"
                        style={{ color: isOnFire ? '#f2f2f2' : 'white', lineHeight: 1 }}>
                        {streak}
                      </span>
                      <span className="text-[1.1rem] font-semibold text-white/40 mb-2">j</span>
                      {isOnFire && <Flame size={22} className="text-[#f2f2f2] mb-1.5 ml-1" />}
                    </div>
                    <p className="text-[11px] text-white/50">
                      {isOnFire ? ct(lang, 'programme.streak.fire') : ct(lang, 'programme.streak.consecutive')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/25 mb-1">Record</p>
                    <p className="text-[1.4rem] font-black text-white/35 font-mono leading-none">
                      {bestStreak}<span className="text-[0.8rem] font-medium ml-0.5">j</span>
                    </p>
                    <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ width: 56, background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min((streak / Math.max(bestStreak, 1)) * 100, 100)}%`, background: '#f2f2f2' }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-white/[0.02] rounded-xl px-4 py-3">
                <Zap size={14} className="text-white/20 shrink-0" />
                <p className="text-[12px] text-white/35">
                  {bestStreak > 0
                    ? ct(lang, 'programme.streak.record.relaunch', { n: String(bestStreak) })
                    : ct(lang, 'programme.streak.start')}
                </p>
              </div>
            )}

            {/* Filtre période */}
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
              {(['7d', '30d', '90d', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-200 ${
                    period === p ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  {p === '7d' ? ct(lang, 'progress.period.7') : p === '30d' ? ct(lang, 'progress.period.30') : p === '90d' ? ct(lang, 'progress.period.90') : ct(lang, 'progress.period.all')}
                </button>
              ))}
            </div>

            {/* KPIs filtrés par période */}
            {sessionList.length > 0 && (() => {
              const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null
              const sinceStr = days ? (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0] })() : ''
              const recent = days ? sessionList.filter(s => s.date >= sinceStr) : sessionList
              const volume = recent.reduce((sum, s) => sum + s.volume, 0)
              const sets = recent.reduce((sum, s) => sum + s.setsCompleted, 0)
              const periodLabel = period === '7d' ? ct(lang, 'programme.period.7d') : period === '30d' ? ct(lang, 'programme.period.30d') : period === '90d' ? ct(lang, 'programme.period.90d') : ct(lang, 'programme.period.total')
              return (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-2.5 px-1">
                    {periodLabel}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <KpiCard label={ct(lang, 'programme.kpi.sessions')} value={recent.length} />
                    <KpiCard label="Volume" value={volume >= 1000 ? `${(volume / 1000).toFixed(1)}t` : `${Math.round(volume)}kg`} />
                    <KpiCard label="Sets" value={sets} />
                  </div>
                </div>
              )
            })()}

            {/* Heatmap filtrée par période */}
            {(() => {
              const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : null
              const filteredHeatmap = days ? heatmapData.slice(-days) : heatmapData
              const heatLabel = period === '7d' ? ct(lang, 'programme.period.heatmap.7') : period === '30d' ? ct(lang, 'programme.period.heatmap.30') : period === '90d' ? ct(lang, 'programme.period.heatmap.90') : ct(lang, 'programme.period.heatmap.all')
              return (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-2.5 px-1">
                    {ct(lang, 'programme.heatmap.label', { period: heatLabel })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {filteredHeatmap.map((d, i) => (
                      <div key={i} className={`w-4 h-4 rounded-lg ${d.level > 0 ? 'bg-[#f2f2f2]/70' : 'bg-white/[0.05]'}`} title={d.date} />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* PRs inline */}
            {allTimePRs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-2.5 px-1">
                  {ct(lang, 'programme.prs')}
                </p>
                <div className="space-y-2">
                  {allTimePRs.slice(0, 5).map((pr, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-xl px-3 py-2">
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
                <OneRMWidget clientId={program.client_id} />
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
            {recentSessions.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-[12px] text-white/25">{ct(lang, 'programme.noHistory')}</p>
              </div>
            ) : (
              recentSessions.map(session => {
                const [, m, d] = session.date.split('-')
                return (
                  <Link
                    key={session.id}
                    href={`/client/programme/recap/${session.id}`}
                    className="flex items-center justify-between bg-white/[0.02] rounded-xl px-4 py-3 hover:bg-white/[0.04] active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-center w-9 shrink-0">
                        <p className="text-[12px] font-black text-white/50 font-mono">{d}/{m}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-white/80 truncate">{session.name}</p>
                          {session.hasPR && (
                            <span className="shrink-0 flex items-center gap-1 bg-[#f2f2f2]/15 text-[#f2f2f2] text-[9px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full">
                              <Trophy size={8} />PR
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

      {skipOpen && todaySession && (
        <div className="fixed inset-0 z-[90] flex items-end bg-black/65">
          <button
            aria-label="Fermer"
            className="absolute inset-0"
            onClick={() => {
              if (skipSubmitting) return
              setSkipOpen(false)
              setSkipError(null)
            }}
          />
          <div className="relative w-full rounded-t-[28px] border-t border-white/[0.08] bg-[#161616] px-5 pb-6 pt-4">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/10" />
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-white">Impossible de faire ta séance ?</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                  Ton coach sera informé et cette journée passera en journée de repos.
                </p>
              </div>
              <button
                onClick={() => {
                  if (skipSubmitting) return
                  setSkipOpen(false)
                  setSkipError(null)
                }}
                className="rounded-xl border border-white/[0.08] p-2 text-white/50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {SKIP_REASON_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setSkipReason(option.key)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[12px] transition-colors ${
                    skipReason === option.key
                      ? 'border-[#f2f2f2] bg-[#f2f2f2]/10 text-white'
                      : 'border-white/[0.08] bg-white/[0.02] text-white/55 hover:bg-white/[0.05]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                Note optionnelle
              </label>
              <textarea
                value={skipNote}
                onChange={(e) => setSkipNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[12px] text-white outline-none placeholder:text-white/20"
                placeholder="Explique brièvement si tu veux donner plus de contexte."
              />
            </div>

            {skipError && (
              <p className="mt-3 text-[11px] text-[#f39a9a]">{skipError}</p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  if (skipSubmitting) return
                  setSkipOpen(false)
                  setSkipError(null)
                }}
                className="flex-1 rounded-xl border border-white/[0.08] px-4 py-3 text-[12px] font-semibold text-white/60"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSkip}
                disabled={skipSubmitting}
                className="flex-1 rounded-xl bg-[#f2f2f2] px-4 py-3 text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.08em] text-[#080808] disabled:opacity-60"
              >
                {skipSubmitting ? 'Confirmation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="bg-white/[0.02] rounded-xl p-3 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-1">{label}</p>
      <p className="text-[1.3rem] font-black leading-none font-mono text-white">{value}</p>
    </div>
  )
}
