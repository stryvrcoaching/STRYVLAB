"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Salad, Dumbbell, ClipboardList, HeartPulse, Activity, MessageSquare, CreditCard, ShieldAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  source: "coach" | "legacy" | "shared";
  clientId: string;
  clientName: string;
  title: string | null;
  body: string | null;
  category: string;
  categoryLabel: string;
  eventLabel: string | null;
  actionUrl: string;
  createdAt: string;
};

const ICONS: Record<string, typeof Bell> = {
  nutrition: Salad,
  training: Dumbbell,
  assessment: ClipboardList,
  recovery: HeartPulse,
  progress: Activity,
  feedback: MessageSquare,
  engagement: Dumbbell,
  admin: CreditCard,
  critical: ShieldAlert,
  system: Bell,
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

export default function NotificationBell(_props: { topBarMode?: boolean } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function fetchNotifications() {
    const res = await fetch("/api/coach/inbox", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({ notifications: [] }));
    setNotifications(data.notifications ?? []);
  }

  useEffect(() => {
    void fetchNotifications();
    const iv = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markMany(ids?: string[]) {
    const body = ids?.length ? { ids } : { markAll: true };
    await fetch("/api/coach/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setNotifications((prev) => ids?.length ? prev.filter((n) => !ids.includes(n.id)) : []);
  }

  function handleOpenNotification(notification: Notification) {
    router.push(notification.actionUrl);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void fetchNotifications()
        }}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
          open ? "bg-white/[0.08] text-white/80" : "text-white/35 hover:bg-white/[0.06] hover:text-white/70"
        }`}
        title="Notifications"
      >
        <Bell size={15} strokeWidth={1.75} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[30rem] max-w-[calc(100vw-1.5rem)] bg-[#181818] border-subtle rounded-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] font-bold text-white">
              Notifications
              {notifications.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                  {notifications.length}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={() => void markMany(notifications.map((notification) => notification.id))}
                  className="flex items-center gap-1 text-[11px] text-[#1f8a65] font-medium hover:text-white transition-colors"
                >
                  <CheckCheck size={11} />
                  Tout marquer comme lu
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={18} className="text-white/20" />
                <p className="text-[12px] text-white/30">Aucune notification</p>
              </div>
            ) : (
              notifications.map((notification, index) => {
                const Icon = ICONS[notification.category] ?? Bell;
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 flex items-start gap-3 ${
                      index < notifications.length - 1 ? "border-b border-white/[0.05]" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 shrink-0">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                          {notification.categoryLabel}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-white/90 whitespace-normal break-words">
                        {notification.title ?? "Notification"}
                      </p>
                      {notification.body ? (
                        <p className="mt-1 text-[10.5px] leading-relaxed text-white/55 whitespace-normal break-words">
                          {notification.body}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/30">
                        <span>{notification.clientName}</span>
                        <span>•</span>
                        <span>{timeAgo(notification.createdAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => handleOpenNotification(notification)}
                        className="rounded-lg bg-white/[0.06] px-2 py-1 text-[9.5px] font-semibold text-white/80 hover:bg-white/[0.1]"
                      >
                        Ouvrir
                      </button>
                      <button
                        onClick={() => void markMany([notification.id])}
                        className="rounded-lg bg-[#1f8a65]/14 px-2 py-1 text-[9.5px] font-semibold text-[#8ef0c7] hover:bg-[#1f8a65]/22"
                      >
                        Marquer lu
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
