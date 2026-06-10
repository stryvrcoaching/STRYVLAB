"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  CheckCircle2,
  AlertCircle,
  Search,
  MessageSquareWarning,
  MessageCircle,
  CornerDownRight,
  ShieldAlert,
  Loader2,
  X,
  Send,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDock } from "@/components/layout/DockContext";

type Notification = {
  id: string;
  clientId: string;
  clientName: string;
  chatMessageId: string | null;
  messageExcerpt: string | null;
  category: string;
  subcategory: string | null;
  priority: number;
  status: string;
  emailSent: boolean;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  safety:           { label: "Urgence / Santé",  icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
  out_of_scope:     { label: "Hors scope IA",    icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10" },
  pattern_inquiry:  { label: "Incompréhension",  icon: MessageSquareWarning, color: "text-blue-400", bg: "bg-blue-500/10" },
  engagement:       { label: "Baisse engagement", icon: AlertCircle, color: "text-purple-400", bg: "bg-purple-500/10" },
  weight_off_track: { label: "Poids stagnant",   icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-500/10" },
};

export default function InboxPage() {
  const router = useRouter();
  const { openClient } = useDock();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "safety" | "out_of_scope" | "engagement">("all");

  const [replyingTo, setReplyingTo] = useState<Notification | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

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
      const res = await fetch("/api/coach/inbox");
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  async function handleAcknowledge(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/coach/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "acknowledged" }),
    });
  }

  async function handleReplySubmit() {
    if (!replyingTo || !replyContent.trim()) return;
    setSendingReply(true);

    try {
      const res = await fetch(`/api/coach/clients/${replyingTo.clientId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });
      if (res.ok) {
        // Enlève toutes les notifs de ce client car le reply résout tout
        setNotifs((prev) => prev.filter((n) => n.clientId !== replyingTo.clientId));
        setReplyingTo(null);
        setReplyContent("");
      }
    } catch (e) {
      console.error(e);
    }
    setSendingReply(false);
  }

  const filtered = notifs.filter((n) => {
    if (filter === "all") return true;
    if (filter === "safety") return n.category === "safety";
    if (filter === "out_of_scope") return n.category === "out_of_scope" || n.category === "pattern_inquiry";
    if (filter === "engagement") return n.category === "engagement" || n.category === "weight_off_track";
    return true;
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
            Les conversations que l'IA vous a transférées
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "all", label: "Toutes" },
            { id: "safety", label: "Urgences 🔴" },
            { id: "out_of_scope", label: "Hors scope" },
            { id: "engagement", label: "Engagement" },
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
                const config = CATEGORY_LABELS[notif.category] || CATEGORY_LABELS.out_of_scope;
                const Icon = config.icon;
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
                            <span className="text-[9px] font-bold uppercase tracking-wider">{config.label}</span>
                          </div>
                          {notif.subcategory && (
                            <span className="ml-2 text-[10px] text-white/40">→ {notif.subcategory}</span>
                          )}

                          {notif.messageExcerpt && (
                            <div className="mt-3 bg-white/[0.03] p-3 rounded-xl border border-white/[0.05]">
                              <p className="text-[12px] text-white/80 leading-relaxed italic">
                                "{notif.messageExcerpt}"
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
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Reply Drawer / Modal */}
      <AnimatePresence>
        {replyingTo && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
              onClick={() => !sendingReply && setReplyingTo(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 z-[75] bg-[#181818] border-t border-white/[0.1] rounded-t-3xl shadow-2xl p-6 md:p-8 md:max-w-2xl md:mx-auto md:bottom-10 md:rounded-3xl md:border"
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">Répondre à {replyingTo.clientName}</h3>
                  <p className="text-white/40 text-xs mt-1">Le client recevra ce message dans son chat.</p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  disabled={sendingReply}
                  className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.1]"
                >
                  <X size={16} />
                </button>
              </div>

              {replyingTo.messageExcerpt && (
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.05] mb-4">
                  <p className="text-[12px] text-white/70 italic line-clamp-2">
                    "{replyingTo.messageExcerpt}"
                  </p>
                </div>
              )}

              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Écrivez votre réponse..."
                rows={4}
                className="w-full bg-[#0a0a0a] border border-white/[0.1] rounded-xl p-4 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#1f8a65]/50 resize-none mb-4"
                autoFocus
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReplyingTo(null)}
                  disabled={sendingReply}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReplySubmit}
                  disabled={sendingReply || !replyContent.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1f8a65] text-white text-xs font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
                >
                  {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Envoyer au client
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
