"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { DashboardSignalCard, type SignalTone } from "@/components/client/smart/DashboardSignalCard";
import ChatTodayStrip from "@/components/client/ChatTodayStrip";
import dynamic from "next/dynamic";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import StrivrToken from "@/components/client/StrivrToken";
import { getProgressionSummary, PROGRESSION_LEVEL_COLORS } from "@/lib/rewards/progression";

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false });
const CyclePhaseModal = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'), { ssr: false });
const CheckinModal = dynamic(() => import("@/components/client/CheckinModal"), { ssr: false });
const QuickWaterModal = dynamic(() => import("@/components/client/QuickWaterModal"), { ssr: false });
const CoachMessageSheet = dynamic(() => import("@/components/client/CoachMessageSheet"), { ssr: false });
const WeightTrackerWidget = dynamic(() => import("@/components/client/WeightTrackerWidget"), {
  ssr: false,
  loading: () => (
    <div className="h-[120px] animate-pulse rounded-2xl bg-white/[0.02]" />
  ),
});
const ClientTransformationWidget = dynamic(
  () => import("@/components/client/ClientTransformationWidget"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[140px] animate-pulse rounded-2xl bg-white/[0.02]" />
    ),
  },
);

import { determineSlotForClick } from "@/lib/client/checkin/checkinEngine";
import { cn } from "@/app/lib/utils";
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations";
import {
  isHomeSystemNotification,
  isPersistentHomeAction,
  type ClientNotificationItem,
} from "@/lib/client/inbox";
import HomeNotificationsSection, {
  type HomeNotificationItem,
} from "@/components/client/HomeNotificationsSection";
import type { ChatTodayStripData } from "@/lib/client/chat/today-strip";
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents";
import { sendClientMutation } from "@/lib/client/offline-mutations";
import { useInboxUnreadCount } from "@/lib/client/useInboxUnreadCount";
import {
  DASHBOARD_SIGNAL_COLORS,
  DashboardSectionIcon,
} from "@/components/client/DashboardSectionIcon";

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
  body?: string | null;
  eyebrow?: string;
  label: string;
  href?: string;
  onClick?: () => void;
  notificationId?: string;
  isPersistent?: boolean;
  icon: React.ElementType;
  tone: SignalTone;
};

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

function colorForSteps(average: number | null | undefined, target: number) {
  if (average == null || target <= 0) return DASHBOARD_SIGNAL_COLORS.neutral;
  const ratio = average / target;
  if (ratio >= 1) return DASHBOARD_SIGNAL_COLORS.success;
  if (ratio >= 0.8) return DASHBOARD_SIGNAL_COLORS.warning;
  if (ratio >= 0.6) return DASHBOARD_SIGNAL_COLORS.attention;
  return DASHBOARD_SIGNAL_COLORS.critical;
}

function colorForEnergyGap(gap: number | null, target: number) {
  if (gap == null || target <= 0) return DASHBOARD_SIGNAL_COLORS.neutral;
  const ratio = gap / target;
  if (ratio <= 0) return DASHBOARD_SIGNAL_COLORS.success;
  if (ratio <= 0.05) return DASHBOARD_SIGNAL_COLORS.warning;
  if (ratio <= 0.1) return DASHBOARD_SIGNAL_COLORS.attention;
  return DASHBOARD_SIGNAL_COLORS.critical;
}

function formatLongDate(lang: ClientLang, timezone?: string | null) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  };
  try {
    return new Intl.DateTimeFormat(localeFor(lang), {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(localeFor(lang), options).format(new Date());
  }
}

function getTimeGreeting(lang: ClientLang, timezone?: string | null, now = new Date()) {
  let hour = now.getHours();
  if (timezone) {
    try {
      const value = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: timezone,
      }).formatToParts(now).find((part) => part.type === "hour")?.value;
      if (value) hour = Number(value);
    } catch {
      // Use the device clock when the saved timezone is invalid.
    }
  }

  const key = hour < 5
    ? 'dashboard.greeting.night'
    : hour < 12
      ? 'dashboard.greeting.morning'
      : hour < 18
        ? 'dashboard.greeting.afternoon'
        : 'dashboard.greeting.evening';
  return ct(lang, key);
}

function notificationHref(notification: ClientNotificationItem): string {
  const actionUrl =
    typeof notification.payload?.action_url === "string"
      ? notification.payload.action_url
      : null

  // Never navigate the PWA to a raw Stripe Checkout URL (expires + breaks in standalone).
  if (actionUrl) {
    const isExternal =
      actionUrl.startsWith("http://") || actionUrl.startsWith("https://");
    const looksLikeStripe =
      isExternal &&
      (actionUrl.includes("checkout.stripe.com") ||
        actionUrl.includes("stripe.com/c/pay"));
    if (looksLikeStripe) {
      const params = new URLSearchParams();
      if (typeof notification.payload?.payment_id === "string") {
        params.set("payment_id", notification.payload.payment_id);
      }
      if (typeof notification.payload?.subscription_id === "string") {
        params.set("subscription_id", notification.payload.subscription_id);
      }
      if (typeof notification.payload?.formula_id === "string") {
        params.set("formula_id", notification.payload.formula_id);
      }
      const qs = params.toString();
      return qs ? `/client/paiement?${qs}` : "/client/paiement";
    }
    return actionUrl;
  }

  if (
    notification.payload?.event === "payment_reminder" ||
    typeof notification.payload?.payment_id === "string"
  ) {
    const params = new URLSearchParams();
    if (typeof notification.payload?.payment_id === "string") {
      params.set("payment_id", notification.payload.payment_id);
    }
    if (typeof notification.payload?.subscription_id === "string") {
      params.set("subscription_id", notification.payload.subscription_id);
    }
    if (typeof notification.payload?.formula_id === "string") {
      params.set("formula_id", notification.payload.formula_id);
    }
    const qs = params.toString();
    return qs ? `/client/paiement?${qs}` : "/client/paiement";
  }

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

function ClientAvatar({
  firstName,
  avatarUrl,
}: {
  firstName: string | null;
  avatarUrl: string | null | undefined;
}) {
  const initial = (firstName?.trim().charAt(0) ?? "C").toUpperCase();

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[20px] bg-white/[0.04] p-0">
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
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white/[0.02] p-4",
        className,
      )}
    >
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

function notificationEyebrow(notification: ClientNotificationItem, lang: ClientLang): string {
  const event =
    typeof notification.payload?.event === "string"
      ? notification.payload.event
      : null;
  if (event === "payment_reminder") return ct(lang, 'dashboard.notifications.category.payment');
  if (event === "level_up") return ct(lang, 'dashboard.notifications.category.progress');
  if (notification.type === "bilan_pending") return ct(lang, 'dashboard.notifications.category.assessment');
  if (
    notification.type === "coach_message" ||
    notification.type === "coach_feedback" ||
    notification.type === "coach_note"
  ) {
    return ct(lang, 'dashboard.notifications.category.coach');
  }
  if (notification.type === "program_assigned" || notification.type === "program_updated") {
    return ct(lang, 'dashboard.notifications.category.program');
  }
  if (notification.type === "tdee_updated") return ct(lang, 'dashboard.notifications.category.nutrition');
  if (notification.type === "system_reminder") return ct(lang, 'dashboard.notifications.category.reminder');
  return ct(lang, 'dashboard.notifications.category.alert');
}

function notificationAlertItem(notification: ClientNotificationItem, lang: ClientLang): PriorityItem {
  const isCoachMessage = isCoachMessageNotification(notification);
  const isLevelUp = notification.payload?.event === "level_up";
  const isPaymentReminder = notification.payload?.event === "payment_reminder";
  const localizePaymentCopy = (value: string | null | undefined) => {
    if (!value || lang !== 'es') return value ?? null;
    return value
      .replace(/^Rappel de paiement$/i, 'Recordatorio de pago')
      .replace(/\b(\d+)\s+jours?\b/gi, '$1 días')
      .replace(/\béchéance\b/gi, 'vence')
      .replace(/\bjours?\b/gi, 'días');
  };
  const priority = typeof notification.payload?.priority === "string"
    ? notification.payload.priority
    : null;
  const tone: SignalTone = priority === "urgent"
    ? "attention"
    : priority === "important" || isPaymentReminder
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
    : isPaymentReminder
      ? CreditCard
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
    eyebrow: notificationEyebrow(notification, lang),
    title: isCoachMessage ? (notification.body ?? notification.title) : isPaymentReminder ? localizePaymentCopy(notification.title) : notification.title,
    body: isCoachMessage ? null : isPaymentReminder ? localizePaymentCopy(notification.body) : notification.body,
    label: isPaymentReminder
      ? ct(lang, 'dashboard.notifications.view')
      : ct(lang, 'dashboard.notifications.open'),
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
  const searchParams = useSearchParams();
  const stripeParam = (searchParams as any)?.get("stripe") ?? null;
  const [stripeStatus, setStripeStatus] = useState<string | null>(stripeParam);

  useEffect(() => {
    if (stripeParam) {
      setStripeStatus(stripeParam);
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [stripeParam]);

  const {
    chat: unreadCoachMessages,
    refresh: refreshInboxBadge,
  } = useInboxUnreadCount();
  // Messagerie badge = chat only (not home system alerts)
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
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const dismissNotifications = useCallback((notificationIds: string[]) => {
    const uniqueIds = [...new Set(notificationIds)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      uniqueIds.forEach((id) => next.add(id));
      return next;
    });
    uniqueIds.forEach((id) => {
      void (async () => {
        try {
          const result = await sendClientMutation({
            kind: "notification",
            url: `/api/client/notifications/${id}`,
            method: "PATCH",
          });
          if (result.queued) return;
          if (!result.response?.ok) throw new Error("dismiss_notification_failed");

          emitClientInboxUpdated();
          await refreshInboxBadge();
          router.refresh();
        } catch {
          setDismissedNotificationIds((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
          emitClientInboxUpdated();
        }
      })();
    });
  }, [refreshInboxBadge, router]);

  const markNotificationsAsRead = useCallback(async (notificationIds: string[]) => {
    const uniqueIds = [...new Set(notificationIds)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    setDismissedNotificationIds((current) => {
      const next = new Set(current);
      uniqueIds.forEach((id) => next.add(id));
      return next;
    });
    try {
      const result = await sendClientMutation({
        kind: "notification",
        url: "/api/client/notifications",
        method: "PATCH",
        body: { notificationIds: uniqueIds },
      });
      if (!result.queued && !result.response?.ok) {
        throw new Error("mark_notifications_read_failed");
      }
      if (!result.queued) {
        emitClientInboxUpdated();
        await refreshInboxBadge();
        router.refresh();
      }
    } catch (error) {
      setDismissedNotificationIds((current) => {
        const next = new Set(current);
        uniqueIds.forEach((id) => next.delete(id));
        return next;
      });
      emitClientInboxUpdated();
      throw error;
    }
  }, [refreshInboxBadge, router]);

  // Non-critical: defer cycle status so it doesn't contend with first paint.
  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const load = () => {
      fetch("/api/client/cycle/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data?.cycleState) setCycleState(data.cycleState);
        })
        .catch(() => {});
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(load, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(load, 900);
    }

    return () => {
      cancelled = true;
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
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
      if (scrollParent.tagName === "MAIN") {
        break;
      }
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

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedNotificationIds.has(notification.id)),
    [dismissedNotificationIds, notifications],
  );

  // Home system notifications — persist until action done (don't require unread only
  // for bilan/payment; still hide dismissed-for-session noise).
  const homeSystemNotifications = useMemo(
    () =>
      visibleNotifications.filter((notification) => {
        if (!isHomeSystemNotification(notification)) return false;
        if (isPersistentHomeAction(notification)) return true;
        return !notification.read_at;
      }),
    [visibleNotifications],
  );

  const homeNotificationItems = useMemo((): HomeNotificationItem[] => {
    const items: HomeNotificationItem[] = [];

    // Pending bilans (always until completed)
    for (const assessment of assessments.pending) {
      items.push({
        key: `assessment-${assessment.id}`,
        eyebrow: t('dashboard.notifications.category.assessment'),
        title: assessment.name,
        body: t('dashboard.notifications.assessment.body'),
        label: copy.openAssessment,
        href: assessment.token
          ? `/bilan/${assessment.token}`
          : "/client/bilans",
        icon: FileText,
        tone: "attention",
      });
    }

    // Check-in pending
    if ((todayStrip?.checkin?.pendingCount ?? 0) > 0) {
      items.push({
        key: "checkin-pending",
        eyebrow: t('dashboard.notifications.checkin'),
        title:
          todayStrip!.checkin.pendingCount === 2
            ? t('dashboard.notifications.checkin.two')
            : t('dashboard.notifications.checkin.one'),
        body: t('dashboard.notifications.checkin.body'),
        label: t('dashboard.notifications.open'),
        onClick: handleCheckinClick,
        icon: MoonStar,
        tone: "warning",
      });
    }

    // Planned workout session pending for today
    const pendingTodaySession = (todayStrip?.sessions ?? []).find((s) => !s.completed);
    if (pendingTodaySession) {
      items.push({
        key: `session-pending-${pendingTodaySession.id}`,
        eyebrow: t('dashboard.notifications.workout'),
        title: t('dashboard.notifications.workout.pending'),
        body: pendingTodaySession.name
          ? t('dashboard.notifications.workout.session', { name: pendingTodaySession.name })
          : t('dashboard.notifications.workout.body'),
        label: t('dashboard.notifications.start'),
        href: `/client/programme/session/${pendingTodaySession.id}`,
        icon: Dumbbell,
        tone: "attention",
      });
    }

    // Appointment awaiting confirmation (or next appointment as soft signal)
    if (nextAppointment) {
      const needsConfirm =
        nextAppointment.status === "awaiting_confirmation";
      items.push({
        key: `appointment-${nextAppointment.id}`,
        eyebrow: needsConfirm
          ? t('dashboard.notifications.confirmationRequired')
          : t('dashboard.notifications.appointment'),
        title: nextAppointment.title,
        body: new Intl.DateTimeFormat(localeFor(lang), {
          weekday: "long",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: nextAppointment.client_timezone || undefined,
        }).format(new Date(nextAppointment.starts_at)),
        label: needsConfirm
          ? t('dashboard.notifications.confirm')
          : t('dashboard.notifications.open'),
        href: `/client/rendez-vous/${nextAppointment.id}`,
        icon: Calendar,
        tone: needsConfirm ? "warning" : "info",
      });
    }

    // Inbox rows (payments, programme, etc.)
    for (const notification of homeSystemNotifications) {
      // Skip bilan notifs if already listed from assessments.pending
      if (
        notification.type === "bilan_pending" &&
        assessments.pending.length > 0
      ) {
        continue;
      }
      const item = notificationAlertItem(notification, lang);
      const persistent = isPersistentHomeAction(notification);
      items.push({
        key: item.key,
        eyebrow: item.eyebrow,
        title: item.title,
        body: item.body,
        label: item.label,
        href: item.href,
        icon: item.icon,
        tone: item.tone,
        notificationId: notification.id,
        isPersistent: persistent,
        onDismiss: persistent
          ? undefined
          : () => dismissNotifications([notification.id]),
        onClick: () => {
          // Persistent actions: navigate without dismissing until truly done
          if (!persistent) {
            dismissNotifications([notification.id]);
          }
          if (isCoachMessageNotification(notification)) {
            setOpenCoachMessage(notification);
          }
        },
      });
    }

    return items;
  }, [
    assessments.pending,
    copy.openAssessment,
    dismissNotifications,
    handleCheckinClick,
    homeSystemNotifications,
    nextAppointment,
    todayStrip,
    t,
    lang,
  ]);

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
  const greeting = getTimeGreeting(
    lang,
    todayStrip?.timezone,
    new Date(currentTime),
  );

  // ── Gamification Logic ────────────────────────────────────────────────────
  let gamification = null;
  if (streak) {
    const progression = getProgressionSummary(streak.total_points);
    const availablePoints = Math.max(0, streak.available_points ?? streak.total_points);
    const levelColor = PROGRESSION_LEVEL_COLORS[progression.level];

    gamification = {
      ...streak,
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

      <div
        ref={rootRef}
        className="relative isolate min-h-full bg-[#0a0a0a] text-white"
      >
          {/* ── FIXED HEADER — logo → strip du jour ── */}
          <div
            ref={heroRef}
            className="fixed top-0 left-1/2 z-30 w-full max-w-xl -translate-x-1/2"
          >
            <div data-client-home-hero className="w-full rounded-b-[32px] border-x-[0.3px] border-b-[0.3px] border-white/[0.06] bg-[#0a0a0a] pt-1 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
              <div
                className="mx-auto w-full max-w-xl px-4"
                style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
              >
                <div className="flex items-center justify-between gap-3 pb-3 pt-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Image
                      src="/logo/logo-stryvr-silver.png"
                      alt="STRYVR Logo"
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                    />
                    <span className="text-[12px] font-bold tracking-[0.25em] text-white/90">
                      STRYVR
                    </span>
                  </div>
                  {coach.fullName?.trim() && (
                    <p className="max-w-[48%] truncate text-right text-[11px] font-medium tracking-wide text-white/40">
                      <span className="text-white/25">{t('dashboard.coach')} </span>
                      {coach.fullName.trim()}
                    </p>
                  )}
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
                        {formatLongDate(lang, todayStrip?.timezone)}
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
                        className="flex h-12 min-w-[88px] flex-col justify-center rounded-2xl bg-white/[0.04] px-3 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
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
                      className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-white/75 transition-colors hover:bg-white/[0.06] active:scale-[0.96]"
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
                  <div className="mb-3 flex min-h-[58px] w-full items-center justify-between rounded-2xl bg-[#181818] px-3.5 py-2 text-left">
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
                  <div className="mb-3 flex min-h-[52px] items-center justify-between rounded-2xl bg-[#181818] px-3.5 py-2.5">
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
                          <span className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: gamification.levelColor }}>
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

                {/* Today strip — directly on the hero surface */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: heroCollapsed && !isProgressionExpanded ? 0 : 60,
                    opacity: heroCollapsed && !isProgressionExpanded ? 0 : 1,
                  }}
                >
                  <ChatTodayStrip
                    data={todayStrip}
                    onCheckinClick={handleCheckinClick}
                    onWaterClick={() => setWaterOpen(true)}
                    onRefresh={() => router.refresh()}
                    className="bg-[#0a0a0a]"
                    surfaceClassName="bg-white/[0.03]"
                  />
                </div>

              </div>
            </div>
          </div>

          {/* ── BODY ── */}
          <main className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28" style={{ paddingTop: `${heroHeight + 16}px` }}>

            {/* ── Stripe payment status banners ── */}
            {stripeStatus === "success" && (
              <DashboardSignalCard
                body={t('dashboard.payment.success.body')}
                eyebrow={t('dashboard.notifications.category.payment')}
                icon={CheckCircle}
                label="OK"
                onDismiss={() => setStripeStatus(null)}
                title={t('dashboard.payment.success.title')}
                tone="success"
              />
            )}

            {stripeStatus === "cancelled" && (
              <DashboardSignalCard
                body={t('dashboard.payment.cancelled.body')}
                eyebrow={t('dashboard.notifications.category.payment')}
                icon={AlertCircle}
                label={t('dashboard.payment.cancelled.label')}
                onDismiss={() => setStripeStatus(null)}
                title={t('dashboard.payment.cancelled.title')}
                tone="warning"
              />
            )}

            {/* ── Notifications (compact + expandable) — system actions only ── */}
            <HomeNotificationsSection
              items={homeNotificationItems}
              onMarkAllRead={markNotificationsAsRead}
            />

            {/* ── Transformation Score → Balance énergétique (paired, nothing between) ── */}
            <ClientTransformationWidget clientId={clientId} />

            {/* ── Weekly Calories Balance Widget ── */}
            {(() => {
              const calTarget = todayStrip?.calories?.target ?? 0;
              const hasCalData = weeklyCalorieAvg != null && calTarget > 0;

              let calStatusLabel = t('dashboard.pending');
              let isCalGood = false;
              let calGap: number | null = null;
              let desc = t('dashboard.energy.empty');

              if (hasCalData && weeklyCalorieAvg) {
                const isCut = clientPhase?.toLowerCase() === 'fat_loss' || clientPhase?.toLowerCase() === 'cut';
                const isBulk = clientPhase?.toLowerCase() === 'hypertrophy' || clientPhase?.toLowerCase() === 'bulk';

                if (isCut) {
                  isCalGood = weeklyCalorieAvg <= calTarget + 50;
                  calGap = Math.max(0, weeklyCalorieAvg - (calTarget + 50));
                  desc = isCalGood
                    ? t('dashboard.energy.deficit.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.deficit.high', { avg: weeklyCalorieAvg, target: calTarget });
                } else if (isBulk) {
                  isCalGood = weeklyCalorieAvg >= calTarget - 50;
                  calGap = Math.max(0, (calTarget - 50) - weeklyCalorieAvg);
                  desc = isCalGood
                    ? t('dashboard.energy.surplus.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.surplus.low', { avg: weeklyCalorieAvg, target: calTarget });
                } else {
                  isCalGood = Math.abs(weeklyCalorieAvg - calTarget) <= 100;
                  calGap = Math.max(0, Math.abs(weeklyCalorieAvg - calTarget) - 100);
                  desc = isCalGood
                    ? t('dashboard.energy.maintenance.ok', { avg: weeklyCalorieAvg, target: calTarget })
                    : t('dashboard.energy.maintenance.off', { avg: weeklyCalorieAvg, target: calTarget });
                }

                calStatusLabel = isCalGood ? t('dashboard.energy.onTarget') : t('dashboard.energy.offTarget');
              }
              const calSignalColor = colorForEnergyGap(calGap, calTarget);

              return (
                <SurfaceCard className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DashboardSectionIcon color={calSignalColor}>
                        <Flame size={15} fill="currentColor" />
                      </DashboardSectionIcon>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                        {t('dashboard.energy.balance')}
                      </p>
                    </div>
                    <span
                      className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: `${calSignalColor}18`, color: calSignalColor }}
                    >
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
                const stepsColor = colorForSteps(weeklyStepAvg, targetSteps);

                return (
                  <SurfaceCard className="h-[152px] p-5">
                    <div className="flex h-full flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <DashboardSectionIcon color={stepsColor}>
                            <Footprints size={15} />
                          </DashboardSectionIcon>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
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

                      <div className="w-full pt-3">
                        <div className="h-[4px] w-full bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: stepsColor }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] text-white/30">{t('dashboard.avg7d')}</span>
                          <span className="text-[9px] font-bold" style={{ color: stepsColor }}>{pct}%</span>
                        </div>
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })()}

              {/* Workout Volume Card */}
              <SurfaceCard className="h-[152px] p-5">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <DashboardSectionIcon color={DASHBOARD_SIGNAL_COLORS.success}>
                        <Dumbbell size={15} />
                      </DashboardSectionIcon>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
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

                  <p className="pt-3 text-[9px] leading-snug text-white/40">
                    {t('dashboard.totalLoad.desc')}
                  </p>
                </div>
              </SurfaceCard>
            </div>

            {/* ── Weight & Body Fat Tracker Widget ── */}
            <WeightTrackerWidget />
          </main>
      </div>
    </>
  );
}
