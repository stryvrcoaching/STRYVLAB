'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bell,
  ChartColumn,
  ChevronRight,
  Droplets,
  Dumbbell,
  FileText,
  MessageSquareText,
  MoonStar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import CheckinModal from '@/components/client/CheckinModal'
import QuickWaterModal from '@/components/client/QuickWaterModal'
import { determineSlotForClick } from '@/lib/client/checkin/checkinEngine'
import { cn } from '@/app/lib/utils'
import type { ClientLang } from '@/lib/i18n/clientTranslations'
import type { ClientNotificationItem } from '@/lib/client/inbox'
import type { ChatTodayStripData } from '@/lib/client/chat/today-strip'
import type { WorkoutAlert } from '@/lib/client/smart/workoutAlerts'

type AssessmentSummary = {
  id: string
  name: string
  status: string
  createdAt: string
  submittedAt: string | null
  token: string | null
}

type DashboardProps = {
  clientFirstName: string | null
  lang: ClientLang
  todayStrip: ChatTodayStripData | null
  notifications: ClientNotificationItem[]
  assessments: {
    pending: AssessmentSummary[]
    recent: AssessmentSummary[]
  }
  coach: {
    fullName: string | null
    avatarUrl: string | null
  }
}

type PriorityItem = {
  key: string
  title: string
  body: string
  label: string
  href?: string
  onClick?: () => void
  icon: React.ElementType
  accent?: boolean
}

const CONTOUR_PATTERN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420' viewBox='0 0 420 420' fill='none'>
    <path d='M20 30C90 5 160 5 210 30C260 55 330 55 400 30' stroke='rgba(255,255,255,0.10)' stroke-width='1'/>
    <path d='M0 95C70 70 150 70 210 95C270 120 350 120 420 95' stroke='rgba(255,255,255,0.08)' stroke-width='1'/>
    <path d='M20 160C90 135 160 135 210 160C260 185 330 185 400 160' stroke='rgba(255,255,255,0.10)' stroke-width='1'/>
    <path d='M0 225C70 200 150 200 210 225C270 250 350 250 420 225' stroke='rgba(255,255,255,0.08)' stroke-width='1'/>
    <path d='M20 290C90 265 160 265 210 290C260 315 330 315 400 290' stroke='rgba(255,255,255,0.10)' stroke-width='1'/>
    <path d='M0 355C70 330 150 330 210 355C270 380 350 380 420 355' stroke='rgba(255,255,255,0.08)' stroke-width='1'/>
    <path d='M80 0C55 70 55 150 80 210C105 270 105 350 80 420' stroke='rgba(255,255,255,0.06)' stroke-width='1'/>
    <path d='M165 0C140 70 140 150 165 210C190 270 190 350 165 420' stroke='rgba(255,255,255,0.08)' stroke-width='1'/>
    <path d='M250 0C225 70 225 150 250 210C275 270 275 350 250 420' stroke='rgba(255,255,255,0.06)' stroke-width='1'/>
    <path d='M335 0C310 70 310 150 335 210C360 270 360 350 335 420' stroke='rgba(255,255,255,0.08)' stroke-width='1'/>
  </svg>`,
)}")`

const GRAIN_TEXTURE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' fill='none'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter>
    <rect width='160' height='160' filter='url(#n)' opacity='0.18'/>
  </svg>`,
)}")`

const copyByLang: Record<ClientLang, Record<string, string>> = {
  fr: {
    greetingFallback: 'Bonjour',
    subtitle: 'Ton cockpit de suivi du jour.',
    pendingCheckins: 'check-ins à faire',
    completedCheckins: 'check-ins validés',
    sessionsToday: 'sessions prévues',
    coachSignals: 'signaux coach',
    priorities: 'Actions prioritaires',
    alerts: 'À surveiller',
    coachSpace: 'Espace coach',
    quickActions: 'Accès rapides',
    open: 'Ouvrir',
    attentionEmpty: 'Aucun signal important pour le moment.',
    coachEmpty: 'Aucun nouveau message coach.',
    hydration: 'Hydratation',
    nutrition: 'Nutrition',
    training: 'Programme',
    metrics: 'Mesures',
    profile: 'Profil',
    checkinNow: 'Faire mon check-in',
    openProgram: 'Voir ma séance',
    openAssessment: 'Remplir le bilan',
    logWater: 'Ajouter de l’eau',
    dashboard: 'Dashboard',
    allGood: 'Tout est à jour',
  },
  en: {
    greetingFallback: 'Hello',
    subtitle: 'Your daily control dashboard.',
    pendingCheckins: 'check-ins pending',
    completedCheckins: 'check-ins done',
    sessionsToday: 'sessions today',
    coachSignals: 'coach signals',
    priorities: 'Priority actions',
    alerts: 'Needs attention',
    coachSpace: 'Coach space',
    quickActions: 'Quick access',
    open: 'Open',
    attentionEmpty: 'No important signal right now.',
    coachEmpty: 'No new coach message.',
    hydration: 'Hydration',
    nutrition: 'Nutrition',
    training: 'Training',
    metrics: 'Metrics',
    profile: 'Profile',
    checkinNow: 'Complete check-in',
    openProgram: 'Open workout',
    openAssessment: 'Complete assessment',
    logWater: 'Log water',
    dashboard: 'Dashboard',
    allGood: 'Everything is up to date',
  },
  es: {
    greetingFallback: 'Hola',
    subtitle: 'Tu panel diario de control.',
    pendingCheckins: 'check-ins pendientes',
    completedCheckins: 'check-ins hechos',
    sessionsToday: 'sesiones previstas',
    coachSignals: 'señales del coach',
    priorities: 'Acciones prioritarias',
    alerts: 'A vigilar',
    coachSpace: 'Espacio coach',
    quickActions: 'Accesos rápidos',
    open: 'Abrir',
    attentionEmpty: 'No hay señal importante por ahora.',
    coachEmpty: 'No hay mensaje nuevo del coach.',
    hydration: 'Hidratación',
    nutrition: 'Nutrición',
    training: 'Programa',
    metrics: 'Medidas',
    profile: 'Perfil',
    checkinNow: 'Hacer check-in',
    openProgram: 'Ver sesión',
    openAssessment: 'Completar balance',
    logWater: 'Añadir agua',
    dashboard: 'Dashboard',
    allGood: 'Todo está al día',
  },
}

function dashboardCopy(lang: ClientLang) {
  return copyByLang[lang] ?? copyByLang.fr
}

function localeFor(lang: ClientLang) {
  if (lang === 'en') return 'en-GB'
  if (lang === 'es') return 'es-ES'
  return 'fr-FR'
}

function formatLongDate(lang: ClientLang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

function formatShortDate(date: string, lang: ClientLang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

function notificationHref(notification: ClientNotificationItem): string {
  switch (notification.type) {
    case 'bilan_pending': {
      const token = typeof notification.payload?.token === 'string' ? notification.payload.token : null
      return token ? `/bilan/${token}` : '/client/bilans'
    }
    case 'tdee_updated':
      return '/client/nutrition'
    case 'system_reminder':
      return '/client/profil'
    case 'program_assigned':
      return '/client/programme'
    case 'coach_feedback':
    case 'coach_note':
    default:
      return '/client/profil'
  }
}

function CoachAvatar({ fullName, avatarUrl }: { fullName: string | null; avatarUrl: string | null }) {
  const initial = (fullName?.trim().charAt(0) ?? 'C').toUpperCase()

  return (
    <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-[#2c3035]">
      {avatarUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${avatarUrl}")` }}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(0,0,0,0.14))]" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: '160px 160px' }} />
      <div className="relative flex h-full w-full items-center justify-center text-sm font-semibold text-white">
        {!avatarUrl ? initial : null}
      </div>
    </div>
  )
}

function SurfaceCard({
  children,
  className,
  accent = false,
}: {
  children: React.ReactNode
  className?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28px] p-5 shadow-[0_16px_36px_rgba(0,0,0,0.26)]',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          accent
            ? 'bg-[linear-gradient(135deg,rgba(47,63,55,0.96)_0%,rgba(166,146,112,0.90)_50%,rgba(86,127,149,0.96)_100%)]'
            : 'bg-[linear-gradient(180deg,#2f3338_0%,#292d31_55%,#23272b_100%)]',
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_30%,rgba(0,0,0,0.16))]" />
      <div className="pointer-events-none absolute inset-0 opacity-18" style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: '160px 160px' }} />
      {accent ? <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: CONTOUR_PATTERN, backgroundSize: '320px 320px' }} /> : null}
      <div className="relative">{children}</div>
    </div>
  )
}

function ProgressRail({
  value,
  total,
  accent,
}: {
  value: number
  total: number
  accent: string
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/20">
      <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, background: accent }} />
    </div>
  )
}

function PrimaryButton({
  href,
  label,
  onClick,
}: {
  href?: string
  label: string
  onClick?: () => void
}) {
  const className =
    'inline-flex h-11 items-center justify-between rounded-2xl bg-[#f2f2f2] px-4 text-[13px] font-medium text-[#111315] transition hover:bg-white'

  if (href) {
    return (
      <Link href={href} className={className}>
        <span>{label}</span>
        <ArrowRight size={16} className="text-[#111315]/70" />
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className}>
      <span>{label}</span>
      <ArrowRight size={16} className="text-[#111315]/70" />
    </button>
  )
}

export default function ClientDashboard({
  clientFirstName,
  lang,
  todayStrip,
  notifications,
  assessments,
  coach,
}: DashboardProps) {
  const router = useRouter()
  const copy = dashboardCopy(lang)
  const [checkinMoment, setCheckinMoment] = useState<'morning' | 'evening' | null>(null)
  const [waterOpen, setWaterOpen] = useState(false)
  const [workoutAlerts, setWorkoutAlerts] = useState<WorkoutAlert[]>([])

  useEffect(() => {
    let cancelled = false

    fetch('/api/client/workout-alerts', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setWorkoutAlerts((data?.alerts ?? []) as WorkoutAlert[])
      })
      .catch(() => {
        if (!cancelled) setWorkoutAlerts([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const plannedSessions = useMemo(() => todayStrip?.sessions ?? [], [todayStrip])
  const pendingCheckins = todayStrip?.checkin.pendingCount ?? 0
  const coachSignals = notifications.filter(
    (item) => item.type === 'coach_note' || item.type === 'coach_feedback',
  )
  const clientAlerts = notifications.filter(
    (item) =>
      item.type === 'system_reminder' ||
      item.type === 'tdee_updated' ||
      item.type === 'bilan_pending',
  )

  const handleCheckinClick = useCallback(() => {
    if (!todayStrip) return

    const slot = determineSlotForClick(
      new Date(),
      todayStrip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      todayStrip.checkin.sessions,
    )

    if (slot?.flow_type === 'morning' || slot?.flow_type === 'evening') {
      setCheckinMoment(slot.flow_type)
      return
    }

    if (!todayStrip.checkin.morning) {
      setCheckinMoment('morning')
      return
    }

    if (!todayStrip.checkin.evening) {
      setCheckinMoment('evening')
    }
  }, [todayStrip])

  const priorityItems = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = []

    if (assessments.pending[0]) {
      items.push({
        key: `assessment-${assessments.pending[0].id}`,
        title: assessments.pending[0].name,
        body: copy.priorities,
        label: copy.openAssessment,
        href: assessments.pending[0].token ? `/bilan/${assessments.pending[0].token}` : '/client/bilans',
        icon: FileText,
        accent: true,
      })
    }

    if (pendingCheckins > 0) {
      items.push({
        key: 'checkin',
        title: pendingCheckins > 1 ? `${pendingCheckins} ${copy.pendingCheckins}` : copy.checkinNow,
        body: copy.priorities,
        label: copy.checkinNow,
        onClick: handleCheckinClick,
        icon: MoonStar,
        accent: items.length === 0,
      })
    }

    if (plannedSessions[0]) {
      items.push({
        key: `session-${plannedSessions[0].id}`,
        title: plannedSessions[0].name,
        body: copy.priorities,
        label: copy.openProgram,
        href: '/client/programme',
        icon: Dumbbell,
        accent: items.length === 0,
      })
    }

    return items
  }, [assessments.pending, copy, handleCheckinClick, pendingCheckins, plannedSessions])

  const combinedAlerts = useMemo(
    () => [
      ...workoutAlerts.slice(0, 2).map((alert) => ({
        id: `workout-${alert.code}-${alert.exercise_name}`,
        title: alert.title,
        body: alert.body,
        href: '/client/programme',
      })),
      ...clientAlerts.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body ?? null,
        href: notificationHref(item),
      })),
    ].slice(0, 4),
    [clientAlerts, workoutAlerts],
  )

  const heroName = clientFirstName?.trim() || copy.greetingFallback
  const caloriesLogged = todayStrip?.calories.logged ?? 0
  const caloriesTarget = todayStrip?.calories.target ?? 0
  const waterLogged = todayStrip?.water.logged ?? 0
  const waterTarget = todayStrip?.water.target ?? 0

  return (
    <>
      <CheckinModal
        moment={checkinMoment ?? 'morning'}
        open={checkinMoment !== null}
        onClose={() => setCheckinMoment(null)}
        onSuccess={() => router.refresh()}
      />

      <QuickWaterModal
        open={waterOpen}
        onClose={() => setWaterOpen(false)}
        onLogged={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />

      <div className="relative min-h-full text-white">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[#1a1c20]" />
        <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(0,0,0,0.10)_100%)]" />
        <div className="pointer-events-none fixed inset-0 z-0 opacity-50" style={{ backgroundImage: CONTOUR_PATTERN, backgroundSize: '360px 360px' }} />
        <div className="pointer-events-none fixed inset-0 z-0 opacity-12" style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: '180px 180px' }} />

        <main className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28 pt-5">
          <SurfaceCard accent className="px-5 pb-5 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/62">{copy.dashboard}</p>
                <h1 className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.04em] text-white">
                  {heroName}
                </h1>
                <p className="mt-2 text-sm text-white/68">{formatLongDate(lang)}</p>
                <p className="mt-1 text-[13px] text-white/50">{copy.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <CoachAvatar fullName={coach.fullName} avatarUrl={coach.avatarUrl} />
                <Link
                  href="/client/profil"
                  className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-black/18 text-white/75"
                >
                  <Bell size={18} />
                  {notifications.filter((item) => !item.read_at).length > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-400" />
                  ) : null}
                </Link>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <SurfaceCard className="rounded-[24px] p-4">
                <p className="text-2xl font-semibold tracking-[-0.03em]">
                  {pendingCheckins > 0 ? pendingCheckins : 2 - pendingCheckins}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-white/52">
                  {pendingCheckins > 0 ? copy.pendingCheckins : copy.completedCheckins}
                </p>
              </SurfaceCard>
              <SurfaceCard className="rounded-[24px] p-4">
                <p className="text-2xl font-semibold tracking-[-0.03em]">{plannedSessions.length}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/52">{copy.sessionsToday}</p>
              </SurfaceCard>
              <SurfaceCard className="rounded-[24px] p-4">
                <p className="text-2xl font-semibold tracking-[-0.03em]">{coachSignals.length}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/52">{copy.coachSignals}</p>
              </SurfaceCard>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <MoonStar size={16} className="text-white/72" />
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/42">{copy.priorities}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {priorityItems.length === 0 ? (
                <div className="rounded-2xl bg-black/12 px-4 py-4 text-[13px] text-white/50">
                  {copy.allGood}
                </div>
              ) : (
                priorityItems.map((item) => (
                  <div key={item.key} className="relative overflow-hidden rounded-[24px] bg-black/12 px-4 py-4">
                    {item.accent ? (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(47,63,55,0.96)_0%,rgba(166,146,112,0.90)_50%,rgba(86,127,149,0.96)_100%)]" />
                        <div className="pointer-events-none absolute inset-0 opacity-18" style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: '160px 160px' }} />
                      </>
                    ) : (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#32363b_0%,#2a2e32_100%)]" />
                        <div className="pointer-events-none absolute inset-0 opacity-14" style={{ backgroundImage: GRAIN_TEXTURE, backgroundSize: '160px 160px' }} />
                      </>
                    )}

                    <div className="relative flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/16 text-white">
                        <item.icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-medium leading-tight text-white">{item.title}</p>
                        <p className="mt-1 text-[12px] text-white/58">{item.body}</p>
                        <div className="mt-3">
                          <PrimaryButton href={item.href} onClick={item.onClick} label={item.label} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>

          <div className="grid grid-cols-2 gap-4">
            <SurfaceCard className="p-4">
              <div className="flex items-center gap-2 text-white/75">
                <Sparkles size={16} />
                <p className="text-[12px] font-medium">{copy.nutrition}</p>
              </div>
              <p className="mt-4 text-[24px] font-semibold tracking-[-0.04em]">
                {caloriesLogged}
                <span className="ml-1 text-sm text-white/38">/ {caloriesTarget} kcal</span>
              </p>
              <div className="mt-3">
                <ProgressRail
                  value={caloriesLogged}
                  total={caloriesTarget}
                  accent="linear-gradient(90deg, rgba(74,222,128,0.95), rgba(103,232,249,0.95))"
                />
              </div>
              <Link href="/client/nutrition" className="mt-4 inline-flex items-center gap-1 text-[12px] text-white/72">
                {copy.open} <ChevronRight size={14} />
              </Link>
            </SurfaceCard>

            <SurfaceCard className="p-4">
              <div className="flex items-center gap-2 text-white/75">
                <Droplets size={16} />
                <p className="text-[12px] font-medium">{copy.hydration}</p>
              </div>
              <p className="mt-4 text-[24px] font-semibold tracking-[-0.04em]">
                {(waterLogged / 1000).toFixed(1)}
                <span className="ml-1 text-sm text-white/38">/ {(waterTarget / 1000).toFixed(1)} L</span>
              </p>
              <div className="mt-3">
                <ProgressRail
                  value={waterLogged}
                  total={waterTarget}
                  accent="linear-gradient(90deg, rgba(125,211,252,0.95), rgba(74,222,128,0.85))"
                />
              </div>
              <button onClick={() => setWaterOpen(true)} className="mt-4 inline-flex items-center gap-1 text-[12px] text-white/72">
                {copy.open} <ChevronRight size={14} />
              </button>
            </SurfaceCard>
          </div>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-white/72" />
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/42">{copy.alerts}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {combinedAlerts.length === 0 ? (
                <div className="rounded-2xl bg-black/12 px-4 py-3 text-[13px] text-white/48">
                  {copy.attentionEmpty}
                </div>
              ) : (
                combinedAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-black/12 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-white">{alert.title}</p>
                      {alert.body ? <p className="mt-1 text-[12px] leading-relaxed text-white/45">{alert.body}</p> : null}
                    </div>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-white/35" />
                  </Link>
                ))
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <MessageSquareText size={16} className="text-white/72" />
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/42">{copy.coachSpace}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {coachSignals.length === 0 ? (
                <div className="rounded-2xl bg-black/12 px-4 py-3 text-[13px] text-white/48">
                  {copy.coachEmpty}
                </div>
              ) : (
                coachSignals.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={notificationHref(item)}
                    className="rounded-2xl bg-black/12 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-white">{item.title}</p>
                        {item.body ? <p className="mt-1 text-[12px] leading-relaxed text-white/45">{item.body}</p> : null}
                      </div>
                      <span className="shrink-0 text-[11px] text-white/30">
                        {formatShortDate(item.created_at, lang)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <ChartColumn size={16} className="text-white/72" />
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/42">{copy.quickActions}</p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { href: '/client/programme', label: copy.training, icon: Dumbbell },
                { href: '/client/nutrition', label: copy.nutrition, icon: Sparkles },
                { href: '/client/metrics', label: copy.metrics, icon: ChartColumn },
                { href: '/client/profil', label: copy.profile, icon: Bell },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl bg-black/12 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black/16">
                      <item.icon size={17} className="text-white/75" />
                    </div>
                    <span className="text-[13px] font-medium text-white">{item.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-white/35" />
                </Link>
              ))}
            </div>
          </SurfaceCard>
        </main>
      </div>
    </>
  )
}
