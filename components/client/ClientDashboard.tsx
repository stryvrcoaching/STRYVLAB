"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle,
  ChevronRight,
  Droplets,
  Dumbbell,
  FileText,
  MessageSquareText,
  MoonStar,
  Sparkles,
  TrendingUp,
  Trophy,
  Apple,
  Flame,
  Footprints,
} from "lucide-react";
import CheckinModal from "@/components/client/CheckinModal";
import QuickWaterModal from "@/components/client/QuickWaterModal";
import ChatTodayStrip from "@/components/client/ChatTodayStrip";
import dynamic from "next/dynamic";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import WeightTrackerWidget from "@/components/client/WeightTrackerWidget";
import CoachMessageSheet from "@/components/client/CoachMessageSheet";
import StrivrToken from "@/components/client/StrivrToken";
import { getProgressionSummary, PROGRESSION_LEVEL_COLORS } from "@/lib/rewards/progression";

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false });
const CyclePhaseModal = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'), { ssr: false });
import { determineSlotForClick } from "@/lib/client/checkin/checkinEngine";
import { cn } from "@/app/lib/utils";
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations";
import type { ClientNotificationItem } from "@/lib/client/inbox";
import type { ChatTodayStripData } from "@/lib/client/chat/today-strip";
import { Flame as PhosphorFlame, Footprints as PhosphorFootprints, Barbell as PhosphorBarbell } from "@phosphor-icons/react";
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents";
import { sendClientMutation } from "@/lib/client/offline-mutations";
import { useInboxUnreadCount } from "@/lib/client/useInboxUnreadCount";

type AssessmentSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  token: string | null;
};

type DashboardProps = {
  clientId: string;
  clientFirstName: string | null;
  clientAvatarUrl?: string | null;
  clientGoal?: string | null;
  clientPhase?: string | null;
  clientCreatedAt?: string | null;
  clientGender?: string | null;
  lang: ClientLang;
  todayStrip: ChatTodayStripData | null;
  notifications: ClientNotificationItem[];
  assessments: {
    pending: AssessmentSummary[];
    recent: AssessmentSummary[];
  };
  coach: {
    fullName: string | null;
    avatarUrl?: string | null;
  };
  weeklyStepAvg?: number | null;
  stepTarget?: number | null;
  weeklyCalorieAvg?: number | null;
  weeklyVolume?: number;
  streak?: { current_streak: number; longest_streak: number; total_points: number; available_points?: number; level: string } | null;
  nextAppointment?: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    client_timezone: string;
    meeting_kind: string;
    meeting_url: string | null;
    status: string;
  } | null;
};

type PriorityItem = {
  key: string;
  title: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ElementType;
  tone: AlertTone;
};

type AlertTone = "success" | "warning" | "attention" | "info" | "neutral";

// ── Design constants ──────────────────────────────────────────────────────────
const SECTION_PANEL_CLASS =
  "premium-panel bg-[#09090a] rounded-[22px] px-4 py-3";
const SECTION_TITLE_CLASS =
  "text-[11px] uppercase tracking-[0.18em] text-white/55 font-normal";
const CARD_TITLE_CLASS = "text-[14px] font-medium leading-tight text-white";
const CARD_BODY_CLASS = "mt-1 text-[12px] leading-relaxed text-white/45";
const KPI_VALUE_CLASS = "text-[24px] font-semibold tracking-[-0.04em] text-white";
const KPI_LABEL_CLASS = "mt-1 text-[11px] leading-snug text-white/50";
const INLINE_LINK_CLASS =
  "mt-4 inline-flex items-center gap-1 text-[12px] text-white/55 transition-opacity hover:opacity-100";
const ICON_WELL_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/16 text-white/78";
// ─────────────────────────────────────────────────────────────────────────────

const copyByLang: Record<ClientLang, Record<string, string>> = {
  fr: {
    greetingFallback: "Bonjour",
    sessionsToday: "sessions prévues",
    coachSignals: "signaux coach",
    coachSpace: "Espace coach",
    open: "Ouvrir",
    coachEmpty: "Aucun nouveau message coach.",
    hydration: "Hydratation",
    nutrition: "Nutrition",
    openProgram: "Voir ma séance",
    openAssessment: "Remplir le bilan",
    allGood: "Tout est en ordre",
    allGoodSub: "Beau travail aujourd'hui",
  },
  en: {
    greetingFallback: "Hello",
    sessionsToday: "sessions today",
    coachSignals: "coach signals",
    coachSpace: "Coach space",
    open: "Open",
    coachEmpty: "No new coach message.",
    hydration: "Hydration",
    nutrition: "Nutrition",
    openProgram: "Open workout",
    openAssessment: "Complete assessment",
    allGood: "Everything is up to date",
    allGoodSub: "Great work today",
  },
  es: {
    greetingFallback: "Hola",
    sessionsToday: "sesiones previstas",
    coachSignals: "señales del coach",
    coachSpace: "Espacio coach",
    open: "Abrir",
    coachEmpty: "No hay mensaje nuevo del coach.",
    hydration: "Hidratación",
    nutrition: "Nutrición",
    openProgram: "Ver sesión",
    openAssessment: "Completar balance",
    allGood: "Todo está al día",
    allGoodSub: "Buen trabajo hoy",
  },
};

function dashboardCopy(lang: ClientLang) {
  return copyByLang[lang] ?? copyByLang.fr;
}

function initialsFor(name: string | null | undefined, fallback = "C") {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function localeFor(lang: ClientLang) {
  if (lang === "en") return "en-GB";
  if (lang === "es") return "es-ES";
  return "fr-FR";
}

function formatLongDate(lang: ClientLang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function getTimeGreeting(lang: ClientLang) {
  const hour = new Date().getHours();
  if (lang === "en") return hour < 18 ? "Good morning" : "Good evening";
  if (lang === "es") return hour < 18 ? "Buenos días" : "Buenas noches";
  return hour < 18 ? "Bonjour" : "Bonsoir";
}

function notificationHref(notification: ClientNotificationItem): string {
  const actionUrl =
    typeof notification.payload?.action_url === "string"
      ? notification.payload.action_url
      : null
  if (actionUrl) return actionUrl

  switch (notification.type) {
    case "bilan_pending": {
      const token =
        typeof notification.payload?.token === "string"
          ? notification.payload.token
          : null;
      return token ? `/bilan/${token}` : "/client/bilans";
    }
    case "tdee_updated":
      return "/client/nutrition";
    case "program_updated":
    case "program_assigned":
      return "/client/programme";
    default:
      return "/client/profil";
  }
}

function isCoachMessageNotification(notification: ClientNotificationItem) {
  return notification.type === "coach_message" || notification.payload?.message_kind === "coach_message";
}

// ── Sub-components ────────────────────────────────────────────────────────────
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors';
import ClientTransformationWidget from './ClientTransformationWidget';

function ClientAvatar({
  firstName,
  avatarUrl,
}: {
  firstName: string | null;
  avatarUrl: string | null | undefined;
}) {
  const initial = (firstName?.trim().charAt(0) ?? "C").toUpperCase();

  return (
    <div className="bg-[#09090a] border border-white/[0.04] relative h-12 w-12 shrink-0 overflow-hidden rounded-[20px] p-0 shadow-sm">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={firstName ?? "Client"}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.12))]" />
      )}
      {!avatarUrl && (
        <div className="relative flex h-full w-full items-center justify-center text-sm font-semibold text-white">
          {initial}
        </div>
      )}
    </div>
  );
}

function getPhaseLabel(phase?: string | null) {
  if (!phase) return 'dashboard.phase.general';
  // Standardize the phase labels
  switch (phase.toLowerCase()) {
    case 'fat_loss':
    case 'cut': return 'dashboard.phase.cut';
    case 'hypertrophy':
    case 'bulk': return 'dashboard.phase.bulk';
    case 'recomp': return 'dashboard.phase.recomp';
    case 'maintenance': return 'dashboard.phase.maintenance';
    case 'strength': return 'dashboard.phase.strength';
    default: return phase;
  }
}

function getPhaseShortLabel(phase?: string | null) {
  if (!phase) return null;
  switch (phase.toLowerCase()) {
    case 'fat_loss':
    case 'cut':
      return 'CUT';
    case 'hypertrophy':
    case 'bulk':
      return 'BULK';
    case 'recomp':
      return 'RECOMP';
    case 'maintenance':
      return 'MAIN';
    case 'strength':
      return 'STR';
    default:
      return phase.toUpperCase();
  }
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className="text-white/55" />
      <p className={SECTION_TITLE_CLASS}>{title}</p>
    </div>
  );
}

function SurfaceCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-[#09090a] border border-white/[0.04] relative overflow-hidden rounded-[24px] p-4", className)}>
      <div className="relative">{children}</div>
    </div>
  );
}

function ProgressRail({
  value,
  total,
  accent,
}: {
  value: number;
  total: number;
  accent: string;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;

  return (
    <div className="h-[5px] overflow-hidden rounded-full bg-black/20">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${ratio * 100}%`, background: accent }}
      />
    </div>
  );
}

const ALERT_TONE_STYLES: Record<AlertTone, { background: string; text: string }> = {
  success: { background: "bg-[#5dba87]/5 border-[#5dba87]/15", text: "text-[#5dba87]" },
  warning: { background: "bg-[#f2c94c]/5 border-[#f2c94c]/15", text: "text-[#f2c94c]" },
  attention: { background: "bg-[#ff8660]/5 border-[#ff8660]/15", text: "text-[#ff8660]" },
  info: { background: "bg-[#7aa7ff]/5 border-[#7aa7ff]/15", text: "text-[#7aa7ff]" },
  neutral: { background: "bg-white/[0.03] border-white/[0.08]", text: "text-white/55" },
};

function ActionAlertButton({ item }: { item: PriorityItem }) {
  const styles = ALERT_TONE_STYLES[item.tone];

  const content = (
    <div className={cn("flex items-center justify-between gap-3 w-full px-4 py-3.5 border rounded-2xl text-left active:scale-[0.98] transition shadow-sm", styles.background)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <item.icon size={16} className={cn("shrink-0", styles.text)} />
        <span className="text-[13px] font-medium text-white/90 truncate">
          {item.title}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", styles.text)}>
          {item.label}
        </span>
        <ChevronRight size={12} className={styles.text} />
      </div>
    </div>
  );

  if (item.href) {
    return <Link href={item.href} onClick={item.onClick} className="block w-full">{content}</Link>;
  }
  return <button onClick={item.onClick} className="block w-full">{content}</button>;
}

function notificationAlertItem(notification: ClientNotificationItem): PriorityItem {
  const isCoachMessage = isCoachMessageNotification(notification);
  const isLevelUp = notification.payload?.event === "level_up";
  const priority = typeof notification.payload?.priority === "string"
    ? notification.payload.priority
    : null;
  const tone: AlertTone = priority === "urgent"
    ? "attention"
    : priority === "important"
      ? "warning"
      : notification.type === "bilan_pending"
        ? "attention"
        : isLevelUp
          ? "warning"
          : notification.type === "coach_message" || notification.type === "coach_feedback" || notification.type === "coach_note"
          ? "info"
          : notification.type === "system_reminder" || notification.type === "tdee_updated"
            ? "warning"
            : "success";

  const icon = isLevelUp
    ? Trophy
    : notification.type === "bilan_pending"
    ? FileText
    : notification.type === "coach_message" || notification.type === "coach_feedback" || notification.type === "coach_note"
      ? MessageSquareText
      : notification.type === "system_reminder"
        ? MoonStar
        : notification.type === "tdee_updated"
          ? TrendingUp
          : notification.type === "program_assigned" || notification.type === "program_updated"
            ? Sparkles
            : Bell;

  return {
    key: `notification-${notification.id}`,
    title: isCoachMessage ? (notification.body ?? notification.title) : notification.title,
    label: "Ouvrir",
    href: isCoachMessage ? undefined : notificationHref(notification),
    icon,
    tone,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientDashboard({
  clientId,
  clientFirstName,
  clientAvatarUrl,
  clientGoal,
  clientPhase,
  clientCreatedAt,
  clientGender = "male",
  lang,
  todayStrip,
  notifications,
  assessments,
  coach,
  weeklyStepAvg = null,
  stepTarget = null,
  weeklyCalorieAvg = null,
  weeklyVolume = 0,
  streak = null,
  nextAppointment = null,
}: DashboardProps) {
  const router = useRouter();
  const { chat: unreadCoachMessages } = useInboxUnreadCount();
  const copy = dashboardCopy(lang);
  const t = useCallback(
    (key: Parameters<typeof ct>[1], vars?: Record<string, string | number>) =>
      ct(lang, key, vars),
    [lang],
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [checkinMoment, setCheckinMoment] = useState<"morning" | "evening" | null>(null);
  const [checkinDate, setCheckinDate] = useState<string | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [heroHeight, setHeroHeight] = useState(212);
  const [isProgressionExpanded, setIsProgressionExpanded] = useState(false);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [openCoachMessage, setOpenCoachMessage] = useState<ClientNotificationItem | null>(null);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());

  const dismissNotifications = useCallback((notificationIds: string[]) => {
    const uniqueIds = [...new Set(notificationIds)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      uniqueIds.forEach((id) => next.add(id));
      return next;
    });
    emitClientInboxUpdated();

    uniqueIds.forEach((id) => {
      void sendClientMutation({
        kind: "notification",
        url: `/api/client/notifications/${id}`,
        method: "PATCH",
      }).then((result) => {
        if (!result.queued) router.refresh();
      });
    });
  }, [router]);

  useEffect(() => {
    fetch('/api/client/cycle/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cycleState) setCycleState(data.cycleState) })
      .catch(() => {})
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCoachMessage = params.get('openCoachMessage');
    const requestedMoment = params.get('openCheckin');
    const requestedNotificationId = params.get('notificationId');
    const requestedWater = params.get('openWater') === '1';

    if (requestedCoachMessage) {
      void fetch(`/api/client/notifications/${encodeURIComponent(requestedCoachMessage)}`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (data?.notification) setOpenCoachMessage(data.notification);
        })
        .catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (requestedMoment === 'morning' || requestedMoment === 'evening') {
      if (requestedNotificationId) {
        void fetch(`/api/client/notifications/${encodeURIComponent(requestedNotificationId)}`, { method: "PATCH" })
          .then(() => router.refresh())
          .catch(() => {});
      }
      setCheckinDate(params.get('date') || todayStrip?.date || null);
      setCheckinMoment(requestedMoment);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (requestedWater) {
      setWaterOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [router, todayStrip?.date]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const updateHeroHeight = () => setHeroHeight(Math.ceil(hero.getBoundingClientRect().height));
    updateHeroHeight();

    const observer = new ResizeObserver(updateHeroHeight);
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  // ── Scroll detection: find the shell's scrollable <main> parent ──────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Walk up from rootRef to find the first scrollable ancestor
    // (ConditionalClientShell renders a <main> with overflow-y-auto)
    let scrollParent: HTMLElement | null = root.parentElement;
    while (scrollParent) {
      const style = window.getComputedStyle(scrollParent);
      const overflowY = style.overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        break;
      }
      scrollParent = scrollParent.parentElement;
    }

    const target = scrollParent ?? document.documentElement;
    let lastScrollTop = target.scrollTop;

    const onScroll = () => {
      const currentScroll = target.scrollTop;
      if (currentScroll <= 10) {
        setHeroCollapsed(false);
      } else if (currentScroll > lastScrollTop) {
        // Scroll down -> collapse today strip
        setHeroCollapsed(true);
      } else if (currentScroll < lastScrollTop) {
        // Scroll up -> expand today strip
        setHeroCollapsed(false);
      }
      lastScrollTop = Math.max(0, currentScroll);
    };

    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  const plannedSessions = useMemo(() => todayStrip?.sessions ?? [], [todayStrip]);
  // ── Check-in handler ──────────────────────────────────────────────────────
  const handleCheckinClick = useCallback(() => {
    if (!todayStrip) return;

    setCheckinDate(null);

    const slot = determineSlotForClick(
      new Date(),
      todayStrip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      todayStrip.checkin.sessions,
      todayStrip.checkin.availability,
    );

    if (slot?.flow_type === "morning" || slot?.flow_type === "evening") {
      setCheckinMoment(slot.flow_type);
      setCheckinDate(slot.date ?? null);
    }
  }, [todayStrip]);

  // ── Priority items ────────────────────────────────────────────────────────
  const priorityItems = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = [];

    if (assessments.pending[0]) {
      items.push({
        key: `assessment-${assessments.pending[0].id}`,
        title: assessments.pending[0].name,
        label: copy.openAssessment,
        href: assessments.pending[0].token
          ? `/bilan/${assessments.pending[0].token}`
          : "/client/bilans",
        icon: FileText,
        tone: "attention",
      });
    }

    return items;
  }, [assessments.pending, copy]);

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedNotificationIds.has(notification.id)),
    [dismissedNotificationIds, notifications],
  );

  const alertNotifications = useMemo(
    () => visibleNotifications.filter((notification) =>
      notification.payload?.event !== "checkin_reminder" && !isCoachMessageNotification(notification),
    ),
    [visibleNotifications],
  );

  const dashboardAlerts = useMemo(
    () => [...priorityItems, ...alertNotifications.map((notification) => {
      const item = notificationAlertItem(notification);
      return {
        ...item,
        onClick: () => {
          dismissNotifications([notification.id]);
          if (isCoachMessageNotification(notification)) {
            setOpenCoachMessage(notification);
          }
        },
      };
    })],
    [alertNotifications, dismissNotifications, priorityItems],
  );

  // ── Data ──────────────────────────────────────────────────────────────────
  const heroName = clientFirstName?.trim() || copy.greetingFallback;
  const normalizedGender = clientGender?.trim().toLowerCase();
  const isFemaleClient = normalizedGender === "female" || normalizedGender === "femme";
  const hasCycleIndicator = Boolean(
    isFemaleClient && cycleState?.currentPhase && cycleState.currentCycleDay,
  );
  const caloriesLogged = todayStrip?.calories?.logged ?? 0;
  const caloriesTarget = todayStrip?.calories?.target ?? 0;
  const waterLogged = todayStrip?.water?.logged ?? 0;
  const waterTarget = todayStrip?.water?.target ?? 0;
  const unreadCount = unreadCoachMessages;
  const greeting = getTimeGreeting(lang);

  // ── Gamification Logic ────────────────────────────────────────────────────
  let gamification = null;
  if (streak) {
    const progression = getProgressionSummary(streak.total_points);
    const availablePoints = Math.max(0, streak.available_points ?? streak.total_points);
    const levelColor = PROGRESSION_LEVEL_COLORS[progression.level];

    gamification = {
      ...streak,
      level: progression.level,
      availablePoints,
      levelColor,
      ...progression,
    };
  }

  return (
    <>
      {/* ── Modals (single instance each) ── */}
      <CheckinModal
        moment={checkinMoment ?? "morning"}
        open={checkinMoment !== null}
        onClose={() => {
          setCheckinMoment(null);
          setCheckinDate(null);
        }}
        onSuccess={() => router.refresh()}
        date={checkinDate ?? undefined}
      />
      <QuickWaterModal
        open={waterOpen}
        onClose={() => setWaterOpen(false)}
        onLogged={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />
      <CoachMessageSheet
        notification={openCoachMessage}
        coachAvatarUrl={coach.avatarUrl}
        coachInitial={initialsFor(coach.fullName)}
        clientAvatarUrl={clientAvatarUrl}
        clientInitial={initialsFor(clientFirstName)}
        onClose={() => {
          setOpenCoachMessage(null);
        }}
      />
      {hasCycleIndicator && cycleState?.currentPhase && cycleState.currentCycleDay && (
        <CyclePhaseModal
          open={cycleModalOpen}
          phase={cycleState.currentPhase}
          cycleDay={cycleState.currentCycleDay}
          avgCycleLength={cycleState.avgCycleLengthDays}
          context="training"
          onClose={() => setCycleModalOpen(false)}
        />
      )}

      <div ref={rootRef} className="premium-dashboard-bg text-white">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <video
            className="h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/images/lclient-dashboard-bg.jpg"
          >
            <source src="/videos/client-dashboard-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,7,0.48),rgba(6,6,7,0.82))]" />
        </div>
        <div className="premium-dashboard-content">

          {/* ── FIXED HEADER — stays locked at the top of the screen ── */}
          <div ref={heroRef} className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-xl z-30">
            <div className="w-full rounded-b-[32px] bg-[var(--client-chrome-bg)] pt-1 shadow-lg shadow-black/40">
              <div
                className="mx-auto w-full max-w-xl px-4"
                style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
              >
                <div className="flex items-center justify-between pb-3 pt-2.5">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/logo/logo-stryvr-silver.png"
                      alt="STRYVR Logo"
                      width={20}
                      height={20}
                      className="w-5 h-5 object-contain"
                    />
                    <span className="text-[12px] font-bold tracking-[0.25em] text-white/90">STRYVR</span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center justify-between gap-3 pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <ClientAvatar
                      firstName={clientFirstName}
                      avatarUrl={clientAvatarUrl}
                    />
                    <div className="min-w-0">
                      <h1 className="text-[20px] font-semibold leading-none tracking-[-0.03em] text-white">
                        {clientFirstName?.trim() ? `${greeting}, ${heroName}` : greeting}
                      </h1>
                      <p className="text-[12px] text-white/50 mt-1.5 leading-none font-medium">
                        {formatLongDate(lang)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {gamification && (
                      <button
                        type="button"
                        data-tour-id="progression"
                        onClick={() => setIsProgressionExpanded(!isProgressionExpanded)}
                        aria-expanded={isProgressionExpanded}
                        aria-label={`${t('dashboard.points')}: ${gamification.availablePoints}. ${gamification.level}`}
                        className="flex h-12 min-w-[88px] flex-col justify-center rounded-2xl border border-white/[0.04] bg-[#111111] px-3 text-left transition-colors hover:bg-[#151515] active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-1 text-[14px] font-bold leading-none tabular-nums text-white">
                          {gamification.availablePoints}<StrivrToken size={14} />
                        </span>
                        <span className="mt-1 text-[10px] font-bold uppercase leading-none tracking-[0.1em]" style={{ color: gamification.levelColor }}>
                          {gamification.level}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      data-tour-id="coach-chat"
                      aria-label={t('feedback.openCoachMessage')}
                      onClick={() => {
                        setOpenCoachMessage({
                          id: "header-coach-message",
                          type: "coach_message",
                          title: t('feedback.coachMessage'),
                          body: null,
                          payload: { message_kind: "coach_message", header_open: true },
                          read_at: null,
                          created_at: new Date().toISOString(),
                        })
                      }}
                      className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.04] bg-[#111111] text-white/75 transition-colors hover:bg-[#151515] active:scale-[0.96]"
                    >
                      <MessageSquareText size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff8660] px-1 text-[9px] font-bold text-[#140b08]">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {hasCycleIndicator && cycleState?.currentPhase && cycleState.currentCycleDay && (
                  <div className="mb-3 flex min-h-[58px] w-full items-center justify-between rounded-2xl border border-white/[0.04] bg-[#111111] px-3.5 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => setCycleModalOpen(true)}
                      className="min-w-0 rounded-lg text-left outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#ef6a62]"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">{t('dashboard.phaseLabel')}</p>
                      <p className="mt-1 truncate text-[13px] font-bold uppercase leading-none tracking-[0.08em] text-[#ef6a62]">
                        {cycleState.currentPhase === 'menstrual' ? t('cycle.phase.menstrual.full') : t(`cycle.phase.${cycleState.currentPhase}`)}
                      </p>
                      {clientPhase && (
                        <p className="mt-1.5 text-[10px] leading-none text-white/45">
                          {t('programme.section')} · {getPhaseShortLabel(clientPhase)}
                        </p>
                      )}
                    </button>
                    <CycleArcIndicator
                      phase={cycleState.currentPhase}
                      cycleDay={cycleState.currentCycleDay}
                      avgCycleLength={cycleState.avgCycleLengthDays}
                      menstrualLength={cycleState.menstrualPhaseLengthDays}
                      confidence={cycleState.confidence}
                      onClick={() => setCycleModalOpen(true)}
                    />
                  </div>
                )}

                {!hasCycleIndicator && clientPhase && (
                  <div className="mb-3 flex min-h-[52px] items-center justify-between rounded-2xl border border-white/[0.04] bg-[#111111] px-3.5 py-2.5">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
                        {t('dashboard.phaseLabel')}
                      </p>
                      <p className="mt-1 text-[13px] font-bold uppercase leading-none tracking-[0.08em] text-white">
                        {getPhaseShortLabel(clientPhase)}
                      </p>
                    </div>
                    <p className="max-w-[55%] text-right text-[11px] font-medium leading-tight text-white/48">
                      {t(getPhaseLabel(clientPhase) as Parameters<typeof ct>[1]).replace(/ \(.*\)/, '')}
                    </p>
                  </div>
                )}

                {/* Progression Drawer (Accordion) */}
                {gamification && (
                  <div
                    className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                    style={{
                      maxHeight: isProgressionExpanded ? 200 : 0,
                      opacity: isProgressionExpanded ? 1 : 0,
                    }}
                  >
                    <div className="border-t border-white/[0.04] py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-white/[0.04] bg-[#111111]" style={{ color: gamification.levelColor }}>
                            {gamification.level}
                          </span>
                        </div>
                        <Link href="/client/profil/rewards" className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white transition-colors flex items-center gap-1">
                          {t('dashboard.shop')} <ChevronRight size={10} />
                        </Link>
                      </div>

                      <div className="w-full mt-3">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-[10px] font-medium text-white/40">
                            {gamification.isMaxLevel ? t('dashboard.maxLevel') : ct(lang, 'rewards.remainingPts', { n: gamification.nextLevelMin - gamification.total_points })}
                          </span>
                          {!gamification.isMaxLevel && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">
                              {t('dashboard.next')}: {gamification.nextLevelName}
                            </span>
                          )}
                        </div>
                        <div className="h-[5px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${gamification.progressPercent}%`, backgroundColor: gamification.levelColor }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Today strip — below the hero card, in the shell gradient zone */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: heroCollapsed && !isProgressionExpanded ? 0 : 60,
                    opacity: heroCollapsed && !isProgressionExpanded ? 0 : 1,
                  }}
                >
                  <div className="border-t border-white/[0.04] py-1.5 pb-2">
                    <ChatTodayStrip
                      data={todayStrip}
                      onCheckinClick={handleCheckinClick}
                      onWaterClick={() => setWaterOpen(true)}
                      onRefresh={() => router.refresh()}
                      className="bg-transparent"
                      surfaceClassName="border border-white/[0.04] bg-[#111111]"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── BODY ── */}
          <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28" style={{ paddingTop: `${heroHeight + 16}px` }}>

            {/* ── Action alert buttons ── */}
            {dashboardAlerts.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {dashboardAlerts.map((item) => (
                  <ActionAlertButton key={item.key} item={item} />
                ))}
              </div>
            )}

            {/* ── Transformation Score Widget ── */}
            <ClientTransformationWidget clientId={clientId} />

            {/* ── Upcoming Coaching Appointment Card ── */}
            {nextAppointment && (
              <div 
                onClick={() => router.push(`/client/rendez-vous/${nextAppointment.id}`)}
                className="premium-panel bg-[#09090a] border border-[#c6b48b]/20 hover:border-[#c6b48b]/40 rounded-[22px] p-5 flex items-center justify-between shadow-sm cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#c6b48b]/10 text-[#c6b48b]">
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c6b48b]">
                      {nextAppointment.status === 'awaiting_confirmation' 
                        ? '⏳ Confirmation requise' 
                        : '📅 Appel coach'}
                    </p>
                    <h3 className="mt-1 text-[15px] font-bold tracking-tight text-white truncate">
                      {nextAppointment.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-white/55 font-medium">
                      {new Intl.DateTimeFormat('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: nextAppointment.client_timezone || undefined
                      }).format(new Date(nextAppointment.starts_at))}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/20 group-hover:text-white/55 transition-colors shrink-0" />
              </div>
            )}

            {/* ── Progression & Rewards Widget removed from here (now in header) ── */}

            {/* ── Weekly Calories Balance Widget ── */}
            {(() => {
              const calTarget = todayStrip?.calories?.target ?? 0;
              const hasCalData = weeklyCalorieAvg != null && calTarget > 0;

              let calStatusLabel = t('dashboard.pending');
              let calStatusColor = "text-white/30 border-white/5 bg-white/[0.01]";
              let isCalGood = false;
              let desc = t('dashboard.energy.empty');

              if (hasCalData && weeklyCalorieAvg) {
                const isCut = clientPhase?.toLowerCase() === 'fat_loss' || clientPhase?.toLowerCase() === 'cut';
                const isBulk = clientPhase?.toLowerCase() === 'hypertrophy' || clientPhase?.toLowerCase() === 'bulk';

                if (isCut) {
                  isCalGood = weeklyCalorieAvg <= calTarget + 50;
                  desc = isCalGood
                    ? t('dashboard.energy.deficit.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.deficit.high', { avg: weeklyCalorieAvg, target: calTarget });
                } else if (isBulk) {
                  isCalGood = weeklyCalorieAvg >= calTarget - 50;
                  desc = isCalGood
                    ? t('dashboard.energy.surplus.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.surplus.low', { avg: weeklyCalorieAvg, target: calTarget });
                } else {
                  isCalGood = Math.abs(weeklyCalorieAvg - calTarget) <= 100;
                  desc = isCalGood
                    ? t('dashboard.energy.maintenance.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.maintenance.off', { avg: weeklyCalorieAvg, target: calTarget });
                }

                calStatusLabel = isCalGood ? t('dashboard.energy.onTarget') : t('dashboard.energy.offTarget');
                calStatusColor = isCalGood
                  ? "text-[#5dba87] border-[#5dba87]/15 bg-[#5dba87]/5"
                  : "text-[#ff8660] border-[#ff8660]/15 bg-[#ff8660]/5";
              }

              return (
                <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-5 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.03]">
                        <PhosphorFlame size={15} weight="fill" style={{ color: "#5dba87" }} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                        {t('dashboard.energy.balance')}
                      </p>
                    </div>
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", calStatusColor)}>
                      {calStatusLabel}
                    </span>
                  </div>

                  <div className="flex items-end gap-2.5 mt-1">
                    <span className="text-[32px] font-bold leading-none tracking-tight text-white tabular-nums">
                      {weeklyCalorieAvg ? `${weeklyCalorieAvg}` : "—"}
                    </span>
                    <span className="text-[12px] text-white/35 pb-1">
                      {t('dashboard.avgPerDay')}
                    </span>
                  </div>

                  <p className="text-[11px] text-white/50 leading-snug">
                    {desc}
                  </p>
                </SurfaceCard>
              );
            })()}

            {/* ── Steps and Volume Grid ── */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Steps Card */}
              {(() => {
                const targetSteps = stepTarget ?? 10000;
                const pct = weeklyStepAvg ? Math.min(100, Math.round((weeklyStepAvg / targetSteps) * 100)) : 0;

                return (
                  <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-4 flex flex-col justify-between h-[135px]">
                    <div>
                      <div className="flex items-center gap-2">
                        <PhosphorFootprints size={15} weight="fill" style={{ color: "#5dba87" }} />
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">
                          {t('dashboard.avgSteps')}
                        </p>
                      </div>
                      <p className="text-[20px] font-bold text-white mt-3 leading-none">
                        {weeklyStepAvg ? weeklyStepAvg.toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US') : "—"}
                      </p>
                      <p className="text-[10px] text-white/35 mt-1">
                        {t('dashboard.targetWord')} {targetSteps.toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US')}
                      </p>
                    </div>

                    <div className="w-full mt-3">
                      <div className="h-[4px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5dba87] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] text-white/30">{t('dashboard.avg7d')}</span>
                        <span className="text-[9px] font-bold text-[#5dba87]">{pct}%</span>
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })()}

              {/* Workout Volume Card */}
              <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-4 flex flex-col justify-between h-[135px]">
                <div>
                  <div className="flex items-center gap-2">
                    <PhosphorBarbell size={15} weight="fill" style={{ color: "#5dba87" }} />
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">
                      {t('dashboard.volume7d')}
                    </p>
                  </div>
                  <p className="text-[20px] font-bold text-white mt-3 leading-none">
                    {weeklyVolume ? `${weeklyVolume.toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US')} kg` : "—"}
                  </p>
                  <p className="text-[10px] text-white/35 mt-1">
                    {t('dashboard.totalLoad')}
                  </p>
                </div>

                <p className="text-[9px] text-white/40 leading-snug">
                  {t('dashboard.totalLoad.desc')}
                </p>
              </SurfaceCard>
            </div>

            {/* ── Weight & Body Fat Tracker Widget ── */}
            <WeightTrackerWidget />
          </main>
        </div>
      </div>
    </>
  );
}
