"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, X } from "lucide-react";

import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  client_id: string | null;
  submission_id?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  assessment_completed: "📋",
  assessment_sent: "📤",
  program_updated: "💪",
  program_assigned: "💪",
  session_reminder: "🏋️",
  bilan_received: "📋",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}j`;
}

export default function NotificationBell(_props: { topBarMode?: boolean } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const router = useRouter();

  const unread = notifications.filter((n) => !n.read);

  async function fetchNotifications() {
    // Debounce: skip if already fetching
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const res = await fetch("/api/assessments/notify");
      if (res.ok) {
        const data = await res.json();
        // On mappe pour inclure submission_id si présent
        setNotifications(
          (data.notifications ?? []).map((n: any) => ({
            ...n,
            submission_id: n.submission_id ?? null,
          })),
        );
      }
    } finally {
      isFetchingRef.current = false;
    }
  }

  useEffect(() => {
    fetchNotifications();

    // Polling interval: 60 seconds instead of 30
    const iv = setInterval(fetchNotifications, 60_000);

    // Stop polling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(iv);
      } else {
        fetchNotifications();
        // Resume polling when tab becomes visible
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    const ids = unread.map((n) => n.id);
    if (!ids.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/assessments/notify", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    await fetch("/api/assessments/notify", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
          open
            ? "bg-white/[0.08] text-white/80"
            : "text-white/35 hover:bg-white/[0.06] hover:text-white/70"
        }`}
        title="Notifications"
      >
        <Bell size={15} strokeWidth={1.75} />
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#181818] border-subtle rounded-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[12px] font-bold text-white">
              Notifications
              {unread.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full">
                  {unread.length}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-[#1f8a65] font-medium hover:text-white transition-colors"
                >
                  <CheckCheck size={11} />
                  Tout lire
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

          {/* Liste */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={18} className="text-white/20" />
                <p className="text-[12px] text-white/30">Aucune notification</p>
              </div>
            ) : (
              notifications.map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    // Redirection selon le type et l’id de ressource
                    if (n.type === "session_reminder" && n.client_id) {
                      router.push(`/coach/clients/${n.client_id}/data/performances`);
                    } else if (n.submission_id) {
                      if (n.type === "assessment_completed") {
                        if (n.client_id) {
                          router.push(`/coach/clients/${n.client_id}/bilans/${n.submission_id}`);
                        } else {
                          router.push(`/coach/clients`);
                        }
                      } else if (n.type === "payment_received") {
                        router.push(`/coach/paiements/${n.submission_id}`);
                      } else if (n.type === "program_assigned") {
                        router.push(`/coach/programmes/${n.submission_id}`);
                      }
                    }
                  }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    i < notifications.length - 1
                      ? "border-b border-white/[0.05]"
                      : ""
                  } ${n.read ? "opacity-40" : "hover:bg-white/[0.04]"}`}
                >
                  <span className="text-base shrink-0 mt-0.5 leading-none">
                    {TYPE_ICONS[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[12px] leading-snug ${n.read ? "text-white/50" : "text-white/90 font-medium"}`}
                    >
                      {n.message}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1f8a65] shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
