"use client";

import { useState } from "react";
import {
  Bell,
  Calendar,
  CaretDown,
  CaretUp,
  Checks,
  CreditCard,
  FileText,
  Moon,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import type { ElementType } from "react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import type { SignalTone } from "@/components/client/smart/DashboardSignalCard";
import {
  DASHBOARD_SIGNAL_COLORS,
  DashboardSectionIcon,
} from "@/components/client/DashboardSectionIcon";
import { useClientT } from "@/components/client/ClientI18nProvider";

export type HomeNotificationItem = {
  key: string;
  title: string;
  body?: string | null;
  eyebrow?: string;
  label: string;
  href?: string;
  onClick?: () => void;
  /** Database notification backing this row, when it is an inbox item. */
  notificationId?: string;
  /** True only for a task that must remain until resolved. */
  isPersistent?: boolean;
  /** Explicit removal is available only for informational notifications. */
  onDismiss?: () => void;
  icon: ElementType;
  tone: SignalTone;
};

const TONE_DOT: Record<SignalTone, string> = {
  success: "bg-[#5dba87]",
  warning: "bg-[#f2c94c]",
  attention: "bg-[#ff8660]",
  info: "bg-[#7aa7ff]",
  neutral: "bg-white/30",
};

function NotificationRow({
  item,
  onRequestDismiss,
}: {
  item: HomeNotificationItem;
  onRequestDismiss: (item: HomeNotificationItem) => void;
}) {
  const Icon = item.icon;
  const [startX, setStartX] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [didSwipe, setDidSwipe] = useState(false);
  const canDismiss = Boolean(item.onDismiss && !item.isPersistent);

  const resetSwipe = () => {
    setStartX(null);
    setSwipeOffset(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canDismiss || event.pointerType === "mouse") return;
    setStartX(event.clientX);
    setDidSwipe(false);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canDismiss || startX === null) return;
    const delta = Math.min(0, event.clientX - startX);
    if (delta < -8) setDidSwipe(true);
    setSwipeOffset(Math.max(-88, delta));
  };

  const onPointerUp = () => {
    if (!canDismiss || startX === null) return;
    const shouldConfirmDismiss = swipeOffset <= -56;
    resetSwipe();
    if (shouldConfirmDismiss) onRequestDismiss(item);
  };

  const onCardClick = (event: React.MouseEvent<HTMLElement>) => {
    if (didSwipe) {
      event.preventDefault();
      event.stopPropagation();
      setDidSwipe(false);
      return;
    }
    item.onClick?.();
  };

  const content = (
    <div className="relative overflow-hidden rounded-xl">
      {canDismiss ? (
        <div className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-[#ff8660]/15 text-[#ff8660]">
          <Trash size={18} weight="bold" />
        </div>
      ) : null}
      <div
        className="relative flex w-full touch-pan-y items-start gap-3 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-3.5 text-left transition-[transform,background-color] duration-150 active:bg-white/[0.05]"
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={resetSwipe}
      >
        <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
          <Icon size={16} className="text-white/70" />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full",
              TONE_DOT[item.tone],
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          {item.eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {item.eyebrow}
            </p>
          ) : null}
          <p
            className={cn(
              "font-medium leading-snug text-white text-[13px]",
              item.eyebrow && "mt-0.5",
            )}
          >
            {item.title}
          </p>
          {item.body ? (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/45">
              {item.body}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 self-center text-[11px] font-semibold text-[#5dba87]">
          {item.label}
        </span>
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} onClick={onCardClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onCardClick} className="block w-full">
      {content}
    </button>
  );
}

/**
 * Accueil notifications section: show latest, expand for full list.
 */
export default function HomeNotificationsSection({
  items,
  onMarkAllRead,
}: {
  items: HomeNotificationItem[];
  onMarkAllRead?: (notificationIds: string[]) => Promise<void>;
}) {
  const { t } = useClientT();
  const [expanded, setExpanded] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [dismissCandidate, setDismissCandidate] = useState<HomeNotificationItem | null>(null);

  if (items.length === 0) return null;

  const latest = items[0];
  const rest = items.slice(1);
  const hasMore = rest.length > 0;
  const markableNotificationIds = items
    .filter((item) => item.notificationId && !item.isPersistent)
    .map((item) => item.notificationId as string);

  const markAllRead = async () => {
    if (!onMarkAllRead || markingAllRead || markableNotificationIds.length === 0) return;
    setMarkingAllRead(true);
    try {
      await onMarkAllRead(markableNotificationIds);
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.04] bg-white/[0.02] p-3"
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <DashboardSectionIcon color={DASHBOARD_SIGNAL_COLORS.attention}>
            <Bell size={15} weight="fill" />
          </DashboardSectionIcon>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t('dashboard.notifications.title')}
          </p>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff8660]/15 px-1.5 text-[10px] font-bold tabular-nums text-[#ff8660]">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {expanded && markableNotificationIds.length > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAllRead}
              aria-label="Marquer les informations comme lues"
              title="Marquer les informations comme lues"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/75 disabled:opacity-40"
            >
              <Checks size={15} weight="bold" />
            </button>
          ) : null}
          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-white/45 transition-colors hover:text-white/70"
              aria-expanded={expanded}
            >
              {expanded
                ? t('dashboard.notifications.collapse')
                : t('dashboard.notifications.viewAll', { n: items.length })}
              {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <NotificationRow item={latest} onRequestDismiss={setDismissCandidate} />
        {expanded && hasMore
          ? rest.map((item) => (
              <NotificationRow
                key={item.key}
                item={item}
                onRequestDismiss={setDismissCandidate}
              />
            ))
          : null}
      </div>

      {dismissCandidate ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/55 p-4 sm:items-center sm:justify-center" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dismiss-notification-title"
            className="w-full max-w-sm rounded-2xl border-[0.3px] border-white/[0.08] bg-[#181818] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            <p id="dismiss-notification-title" className="text-[15px] font-semibold text-white">
              Supprimer cette notification ?
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              Cette mise à jour ne s’affichera plus dans ton centre de notifications.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDismissCandidate(null)}
                className="min-h-11 rounded-xl bg-white/[0.05] px-3 text-[12px] font-semibold text-white/70"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissCandidate.onDismiss?.();
                  setDismissCandidate(null);
                }}
                className="min-h-11 rounded-xl bg-[#ff8660]/15 px-3 text-[12px] font-semibold text-[#ffad94]"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// Re-export icons helpers for dashboard mapping convenience
export const HomeNotifIcons = {
  Bell,
  Calendar,
  CreditCard,
  FileText,
  MoonStar: Moon,
  Sparkles: Sparkle,
};
