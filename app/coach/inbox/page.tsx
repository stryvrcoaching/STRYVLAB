"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  ClipboardList,
  HeartPulse,
  CornerDownRight,
  Loader2,
  X,
  Send,
  Salad,
  Activity,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDock } from "@/components/layout/DockContext";
import CoachConversationSheet from "@/components/coach/CoachConversationSheet";

type Notification = {
  id: string;
  source: "coach" | "shared" | "legacy";
  clientId: string;
  clientName: string;
  chatMessageId: string | null;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  messageExcerpt: string | null;
  category: string;
  categoryLabel: string;
  subcategory: string | null;
  eventLabel: string | null;
  priority: number;
  status: string;
  read: boolean;
  emailSent: boolean;
  actionUrl: string;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  assessment: { label: "Bilans", icon: ClipboardList, color: "text-sky-300", bg: "bg-sky-500/10" },
  training: { label: "Entraînement", icon: Dumbbell, color: "text-violet-300", bg: "bg-violet-500/10" },
  nutrition: { label: "Nutrition", icon: Salad, color: "text-[#8ef0c7]", bg: "bg-[#1f8a65]/10" },
  recovery: { label: "Récupération", icon: HeartPulse, color: "text-amber-300", bg: "bg-amber-500/10" },
  progress: { label: "Évolution", icon: Activity, color: "text-cyan-300", bg: "bg-cyan-500/10" },
  feedback: { label: "Feedback", icon: MessageSquare, color: "text-pink-300", bg: "bg-pink-500/10" },
  engagement: { label: "Engagement", icon: AlertCircle, color: "text-orange-300", bg: "bg-orange-500/10" },
  admin: { label: "Administratif", icon: CreditCard, color: "text-emerald-300", bg: "bg-emerald-500/10" },
  critical: { label: "À traiter", icon: AlertCircle, color: "text-red-300", bg: "bg-red-500/10" },
  system: { label: "Suivi", icon: Inbox, color: "text-white/70", bg: "bg-white/[0.06]" },
};

export default function InboxPage() {
  const router = useRouter();
  const { openClient } = useDock();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "assessment" | "training" | "nutrition" | "recovery" | "progress" | "engagement" | "admin">("all");

  const [replyingTo, setReplyingTo] = useState<Notification | null>(null);

  const unreadCount = notifs.length;

  const topBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-semibold text-white leading-none">
          Inbox IA
        </p>
        {unreadCount > 0 && (
          <div className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black leading-none">
            {unreadCount}
          </div>
        )}
      </div>
    ),
    [unreadCount],
  );

  useSetTopBar(topBarLeft);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const url = clientFilter ? `/api/coach/inbox?client=${clientFilter}` : "/api/coach/inbox";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [clientFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setClientFilter(params.get("client"));
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  async function handleAcknowledge(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/coach/inbox`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }

  async function handleMarkAllRead() {
    const notificationIds = notifs.map((notification) => notification.id);
    setNotifs([]);
    if (notificationIds.length === 0) return;
    await fetch(`/api/coach/inbox`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: notificationIds }),
    });
  }

  const filtered = notifs.filter((n) => {
    if (filter === "all") return true;
    return n.category === filter;
  });

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-6 py-8 max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        ))}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-black text-white tracking-tight">Inbox IA</h1>
          <p className="text-[13px] text-white/40 mt-1">
            {clientFilter ? "Notifications filtrées pour cet athlète" : "Les conversations que l'IA vous a transférées"}
          </p>
        </div>

        {filtered.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => void handleMarkAllRead()}
              className="rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/[0.09]"
            >
              Tout marquer comme lu
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "all", label: "Toutes" },
            { id: "assessment", label: "Bilans" },
            { id: "training", label: "Entraînement" },
            { id: "engagement", label: "Engagement" },
            { id: "nutrition", label: "Nutrition" },
            { id: "recovery", label: "Récupération" },
            { id: "progress", label: "Évolution" },
            { id: "admin", label: "Administratif" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors ${
                filter === f.id
                  ? "bg-white text-black"
                  : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#181818] flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-[#1f8a65]" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Inbox Zero</p>
            <p className="text-xs text-white/45">
              Vous avez traité toutes les requêtes de l'IA.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((notif) => {
                const config = CATEGORY_LABELS[notif.category] || CATEGORY_LABELS.system;
                const Icon = config.icon;
                const isClientReply = notif.subcategory === "coach_message_reply";
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={notif.id}
                    className="bg-[#181818] border-subtle rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: "#333" }} // fallback color
                          onClick={() => {
                            openClient({ id: notif.clientId, firstName: notif.clientName.split(' ')[0], lastName: '' });
                            router.push(`/coach/clients/${notif.clientId}`);
                          }}
                        >
                          {notif.clientName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white cursor-pointer hover:underline"
                               onClick={() => {
                                 openClient({ id: notif.clientId, firstName: notif.clientName.split(' ')[0], lastName: '' });
                                 router.push(`/coach/clients/${notif.clientId}`);
                               }}>
                              {notif.clientName}
                            </p>
                            <span className="text-[10px] text-white/30">
                              {new Date(notif.createdAt).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${config.bg} ${config.color}`}>
                            <Icon size={10} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">{notif.categoryLabel}</span>
                          </div>

                          <p className="mt-3 text-sm font-semibold text-white">
                            {notif.title || "Notification coach"}
                          </p>

                          {(notif.body || notif.messageExcerpt) && (
                            <div className="mt-3 bg-white/[0.03] p-3 rounded-xl border border-white/[0.05]">
                              <p className="text-[12px] text-white/80 leading-relaxed">
                                {notif.body || notif.messageExcerpt}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => setReplyingTo(notif)}
                          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-[#1f8a65] text-white text-[11px] font-bold hover:bg-[#217356] transition-colors"
                        >
                          <CornerDownRight size={12} /> Répondre
                        </button>
                        <button
                          onClick={() => handleAcknowledge(notif.id)}
                          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.05] text-white/60 text-[11px] font-semibold hover:bg-white/[0.1] hover:text-white transition-colors"
                        >
                          <CheckCircle2 size={12} /> Marquer lu
                        </button>
                        <button
                          onClick={() => {
                            if (isClientReply) {
                              setReplyingTo(notif);
                              return;
                            }
                            openClient({ id: notif.clientId, firstName: notif.clientName.split(' ')[0], lastName: '' });
                            router.push(notif.actionUrl);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-white/[0.05] text-white/60 text-[11px] font-semibold hover:bg-white/[0.1] hover:text-white transition-colors"
                        >
                          {isClientReply ? "Ouvrir la conversation" : "Ouvrir"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CoachConversationSheet
        notification={replyingTo}
        onClose={() => setReplyingTo(null)}
        onSent={() => {
          if (replyingTo) setNotifs((prev) => prev.filter((n) => n.clientId !== replyingTo.clientId));
        }}
      />
    </main>
  );
}
