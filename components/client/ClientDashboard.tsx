"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle,
  ChevronRight,
  Droplets,
  Dumbbell,
  FileText,
  MessageSquareText,
  MoonStar,
  Apple,
  Flame,
  Footprints,
} from "lucide-react";
import CheckinModal from "@/components/client/CheckinModal";
import QuickWaterModal from "@/components/client/QuickWaterModal";
import ChatTodayStrip from "@/components/client/ChatTodayStrip";
import { determineSlotForClick } from "@/lib/client/checkin/checkinEngine";
import { cn } from "@/app/lib/utils";
import type { ClientLang } from "@/lib/i18n/clientTranslations";
import type { ClientNotificationItem } from "@/lib/client/inbox";
import type { ChatTodayStripData } from "@/lib/client/chat/today-strip";

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
  lang: ClientLang;
  todayStrip: ChatTodayStripData | null;
  notifications: ClientNotificationItem[];
  assessments: {
    pending: AssessmentSummary[];
    recent: AssessmentSummary[];
  };
  coach: {
    fullName: string | null;
  };
  weeklyStepAvg?: number | null;
  stepTarget?: number | null;
  weeklyCalorieAvg?: number | null;
  weeklyVolume?: number;
};

type PriorityItem = {
  key: string;
  title: string;
  body?: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon: React.ElementType;
  accent?: boolean;
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
    pendingCheckins: "check-ins du jour à faire",
    completedCheckins: "check-ins du jour complétés",
    sessionsToday: "sessions prévues",
    coachSignals: "signaux coach",
    coachSpace: "Espace coach",
    open: "Ouvrir",
    coachEmpty: "Aucun nouveau message coach.",
    hydration: "Hydratation",
    nutrition: "Nutrition",
    checkinNow: "Faire mon check-in",
    openProgram: "Voir ma séance",
    openAssessment: "Remplir le bilan",
    allGood: "Tout est en ordre",
    allGoodSub: "Beau travail aujourd'hui",
  },
  en: {
    greetingFallback: "Hello",
    pendingCheckins: "daily check-ins pending",
    completedCheckins: "daily check-ins completed",
    sessionsToday: "sessions today",
    coachSignals: "coach signals",
    coachSpace: "Coach space",
    open: "Open",
    coachEmpty: "No new coach message.",
    hydration: "Hydration",
    nutrition: "Nutrition",
    checkinNow: "Do my check-in",
    openProgram: "Open workout",
    openAssessment: "Complete assessment",
    allGood: "Everything is up to date",
    allGoodSub: "Great work today",
  },
  es: {
    greetingFallback: "Hola",
    pendingCheckins: "check-ins del día pendientes",
    completedCheckins: "check-ins del día completados",
    sessionsToday: "sesiones previstas",
    coachSignals: "señales del coach",
    coachSpace: "Espacio coach",
    open: "Abrir",
    coachEmpty: "No hay mensaje nuevo del coach.",
    hydration: "Hidratación",
    nutrition: "Nutrición",
    checkinNow: "Hacer mi check-in",
    openProgram: "Ver sesión",
    openAssessment: "Completar balance",
    allGood: "Todo está al día",
    allGoodSub: "Buen trabajo hoy",
  },
};

function dashboardCopy(lang: ClientLang) {
  return copyByLang[lang] ?? copyByLang.fr;
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

function formatShortDate(date: string, lang: ClientLang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

function notificationHref(notification: ClientNotificationItem): string {
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
    case "program_assigned":
      return "/client/programme";
    default:
      return "/client/profil";
  }
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
  if (!phase) return 'Général';
  // Standardize the phase labels
  switch (phase.toLowerCase()) {
    case 'fat_loss':
    case 'cut': return 'Perte de gras (Cut)';
    case 'hypertrophy':
    case 'bulk': return 'Prise de masse (Bulk)';
    case 'recomp': return 'Recomposition';
    case 'maintenance': return 'Maintien';
    case 'strength': return 'Force maximale';
    default: return phase;
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

/** Sleek minimalist action alert button for priority tasks. */
function ActionAlertButton({ item }: { item: PriorityItem }) {
  const isBilan = item.key.startsWith('assessment-');
  const bgStyle = isBilan ? "bg-[#ff8660]/5 border-[#ff8660]/15" : "bg-[#5dba87]/5 border-[#5dba87]/15";
  const textStyle = isBilan ? "text-[#ff8660]" : "text-[#5dba87]";

  const content = (
    <div className={cn("flex items-center justify-between gap-3 w-full px-4 py-3.5 border rounded-2xl text-left active:scale-[0.98] transition shadow-sm", bgStyle)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <item.icon size={16} className={cn("shrink-0", textStyle)} />
        <span className="text-[13px] font-medium text-white/90 truncate">
          {item.title}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", textStyle)}>
          {item.label}
        </span>
        <ChevronRight size={12} className={textStyle} />
      </div>
    </div>
  );

  if (item.href) {
    return <Link href={item.href} className="block w-full">{content}</Link>;
  }
  return <button onClick={item.onClick} className="block w-full">{content}</button>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientDashboard({
  clientId,
  clientFirstName,
  clientAvatarUrl,
  clientGoal,
  clientPhase,
  clientCreatedAt,
  lang,
  todayStrip,
  notifications,
  assessments,
  coach,
  weeklyStepAvg = null,
  stepTarget = null,
  weeklyCalorieAvg = null,
  weeklyVolume = 0,
}: DashboardProps) {
  const router = useRouter();
  const copy = dashboardCopy(lang);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [checkinMoment, setCheckinMoment] = useState<"morning" | "evening" | null>(null);
  const [checkinDate, setCheckinDate] = useState<string | null>(null);
  const [waterOpen, setWaterOpen] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(false);

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
    const onScroll = () => setHeroCollapsed(target.scrollTop > 24);

    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  const plannedSessions = useMemo(() => todayStrip?.sessions ?? [], [todayStrip]);
  const pendingCheckins = todayStrip?.checkin.pendingCount ?? 0;
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const coachSignals = notifications.filter(
    (n) => n.type === "coach_note" || n.type === "coach_feedback",
  );

  // ── Check-in handler ──────────────────────────────────────────────────────
  const handleCheckinClick = useCallback(() => {
    if (!todayStrip) return;

    setCheckinDate(null);

    const slot = determineSlotForClick(
      new Date(),
      todayStrip.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      todayStrip.checkin.sessions,
    );

    if (slot?.flow_type === "morning" || slot?.flow_type === "evening") {
      setCheckinMoment(slot.flow_type);
      setCheckinDate(slot.date ?? null);
      return;
    }

    if (!todayStrip.checkin.morning) {
      setCheckinMoment("morning");
      return;
    }

    if (!todayStrip.checkin.evening) {
      setCheckinMoment("evening");
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
        accent: true,
      });
    }

    const missed = (todayStrip?.checkin as any)?.missed_checkins ?? [];
    if (missed.length > 0) {
      for (const m of missed) {
        const title = `${m.flow_type === "morning" ? "Check-in matin" : "Check-in soir"} • ${formatShortDate(m.date, lang)}`;
        items.push({
          key: `checkin-${m.date}-${m.flow_type}`,
          title,
          label: copy.checkinNow,
          onClick: () => {
            setCheckinDate(m.date);
            setCheckinMoment(m.flow_type);
          },
          icon: MoonStar,
          accent: items.length === 0,
        });
      }
    } else if (pendingCheckins > 0) {
      items.push({
        key: "checkin",
        title:
          pendingCheckins > 1
            ? `${pendingCheckins} ${copy.pendingCheckins}`
            : copy.checkinNow,
        label: copy.checkinNow,
        onClick: handleCheckinClick,
        icon: MoonStar,
        accent: items.length === 0,
      });
    }

    if (plannedSessions[0]) {
      items.push({
        key: `session-${plannedSessions[0].id}`,
        title: plannedSessions[0].name,
        label: copy.openProgram,
        href: "/client/programme",
        icon: Dumbbell,
        accent: items.length === 0,
      });
    }

    return items;
  }, [assessments.pending, copy, handleCheckinClick, pendingCheckins, plannedSessions, lang, todayStrip]);

  const firstItem = priorityItems[0] ?? null;
  const secondaryItems = priorityItems.slice(1);

  // ── Data ──────────────────────────────────────────────────────────────────
  const heroName = clientFirstName?.trim() || copy.greetingFallback;
  const caloriesLogged = todayStrip?.calories.logged ?? 0;
  const caloriesTarget = todayStrip?.calories.target ?? 0;
  const waterLogged = todayStrip?.water.logged ?? 0;
  const waterTarget = todayStrip?.water.target ?? 0;
  const notifBadge = unreadCount + pendingCheckins;

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

      <div ref={rootRef} className="premium-dashboard-bg text-white">
        <div className="premium-dashboard-content">

          {/* ── STICKY HEADER — works inside ConditionalClientShell's scroll <main> ── */}
          <div ref={heroRef} className="sticky top-0 z-30">
            <div className="bg-[#09090a] w-full rounded-b-[32px]">
              <div
                className="mx-auto w-full max-w-xl px-4"
                style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
              >
                {/* Hero card: identity + date */}
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 pt-2 transition-all duration-300 ease-out",
                    heroCollapsed ? "pb-3" : "pb-4",
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ClientAvatar
                      firstName={clientFirstName}
                      avatarUrl={clientAvatarUrl}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5dba87]">
                          STRYVR
                        </p>
                      </div>
                      <h1 className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-white mt-0.5">
                        {heroName}
                      </h1>
                      {/* Date — fades out when collapsed */}
                      <div
                        className="overflow-hidden transition-all duration-300 ease-out"
                        style={{
                          maxHeight: heroCollapsed ? 0 : 32,
                          opacity: heroCollapsed ? 0 : 1,
                        }}
                      >
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[13px] font-medium text-white/60">
                            {formatLongDate(lang)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Phase Actuelle à droite */}
                  {clientPhase && (
                    <div className="flex flex-col items-end text-right transition-all duration-300 ease-out"
                         style={{ opacity: heroCollapsed ? 0 : 1 }}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30 mb-0.5">
                        Phase
                      </p>
                      <p className="text-[18px] font-bold tracking-tight text-white uppercase leading-none mb-1">
                        {clientPhase === 'fat_loss' ? 'CUT' : clientPhase === 'hypertrophy' ? 'BULK' : clientPhase}
                      </p>
                      <div className="bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.02]">
                        <p className="text-[9px] font-semibold uppercase text-white/50">
                          {getPhaseLabel(clientPhase).replace(/ \(.*\)/, '')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Today strip — below the hero card, in the shell gradient zone */}
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    maxHeight: heroCollapsed ? 0 : 60,
                    opacity: heroCollapsed ? 0 : 1,
                  }}
                >
                  <div className="border-t border-white/[0.04] py-1.5 pb-2">
                    <ChatTodayStrip
                      data={todayStrip}
                      onCheckinClick={handleCheckinClick}
                      onWaterClick={() => setWaterOpen(true)}
                      onRefresh={() => router.refresh()}
                      className="bg-transparent"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── BODY ── */}
          <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-28 pt-4">

            {/* ── Action alert buttons ── */}
            {priorityItems.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {priorityItems.map((item) => (
                  <ActionAlertButton key={item.key} item={item} />
                ))}
              </div>
            )}

            {/* ── Transformation Score Widget ── */}
            <ClientTransformationWidget clientId={clientId} />

            {/* ── Weekly Calories Balance Widget ── */}
            {(() => {
              const calTarget = todayStrip?.calories.target ?? 0;
              const hasCalData = weeklyCalorieAvg != null && calTarget > 0;
              
              let calStatusLabel = "En attente";
              let calStatusColor = "text-white/30 border-white/5 bg-white/[0.01]";
              let isCalGood = false;
              let desc = "Enregistre tes repas pour voir ta balance énergétique hebdomadaire.";

              if (hasCalData && weeklyCalorieAvg) {
                const isCut = clientPhase?.toLowerCase() === 'fat_loss' || clientPhase?.toLowerCase() === 'cut';
                const isBulk = clientPhase?.toLowerCase() === 'hypertrophy' || clientPhase?.toLowerCase() === 'bulk';
                
                if (isCut) {
                  isCalGood = weeklyCalorieAvg <= calTarget + 50;
                  desc = isCalGood 
                    ? `Ta moyenne (${weeklyCalorieAvg} kcal) respecte ton déficit cible de ${calTarget} kcal.`
                    : `Ta moyenne (${weeklyCalorieAvg} kcal) dépasse ton déficit cible de ${calTarget} kcal.`;
                } else if (isBulk) {
                  isCalGood = weeklyCalorieAvg >= calTarget - 50;
                  desc = isCalGood 
                    ? `Ta moyenne (${weeklyCalorieAvg} kcal) soutient ton surplus cible de ${calTarget} kcal.`
                    : `Ta moyenne (${weeklyCalorieAvg} kcal) est en dessous de ton surplus cible de ${calTarget} kcal.`;
                } else {
                  isCalGood = Math.abs(weeklyCalorieAvg - calTarget) <= 100;
                  desc = isCalGood 
                    ? `Ta moyenne (${weeklyCalorieAvg} kcal) est alignée avec ta maintenance (${calTarget} kcal).`
                    : `Ta moyenne (${weeklyCalorieAvg} kcal) dévie de ta maintenance (${calTarget} kcal).`;
                }

                calStatusLabel = isCalGood ? "Cible respectée" : "Hors cible";
                calStatusColor = isCalGood 
                  ? "text-[#5dba87] border-[#5dba87]/15 bg-[#5dba87]/5" 
                  : "text-[#ff8660] border-[#ff8660]/15 bg-[#ff8660]/5";
              }

              return (
                <SurfaceCard className="bg-[#09090a] border border-white/[0.04] p-5 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.03]">
                        <Flame size={14} className="text-white/60" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                        Balance énergétique
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
                      kcal / jour en moyenne
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
                        <Footprints size={14} className="text-white/50" />
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">
                          Pas moyen
                        </p>
                      </div>
                      <p className="text-[20px] font-bold text-white mt-3 leading-none">
                        {weeklyStepAvg ? weeklyStepAvg.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US') : "—"}
                      </p>
                      <p className="text-[10px] text-white/35 mt-1">
                        cible {targetSteps.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
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
                        <span className="text-[9px] text-white/30">Moyenne 7j</span>
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
                    <Dumbbell size={14} className="text-white/50" />
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">
                      Volume 7j
                    </p>
                  </div>
                  <p className="text-[20px] font-bold text-white mt-3 leading-none">
                    {weeklyVolume ? `${weeklyVolume.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} kg` : "—"}
                  </p>
                  <p className="text-[10px] text-white/35 mt-1">
                    charge totale cumulée
                  </p>
                </div>
                
                <p className="text-[9px] text-white/40 leading-snug">
                  Somme du travail effectué sur tes séances de la semaine.
                </p>
              </SurfaceCard>
            </div>

            {/* ── Coach signals (conditional — hidden when empty) ── */}
            {coachSignals.length > 0 && (
              <div className="bg-[#09090a] border border-white/[0.04] shadow-sm rounded-[22px] px-4 py-4">
                <SectionHeader
                  icon={MessageSquareText}
                  title={copy.coachSpace}
                />
                <div className="mt-3 flex flex-col gap-2">
                  {coachSignals.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={notificationHref(item)}
                      className="bg-[#141414] border border-white/[0.02] rounded-xl px-4 py-3.5 block"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={CARD_TITLE_CLASS}>{item.title}</p>
                          {item.body ? (
                            <p className={CARD_BODY_CLASS}>{item.body}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[11px] text-white/30">
                          {formatShortDate(item.created_at, lang)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
