"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import ChatConversation from "@/components/client/ChatConversation";
import ChatInputBar from "@/components/client/ChatInputBar";
import type { ChatMessage } from "@/components/client/ChatBubble";
import type { ClientNotificationItem } from "@/lib/client/inbox";
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents";
import { sendClientMutation } from "@/lib/client/offline-mutations";
import useBodyScrollLock from "@/components/client/useBodyScrollLock";
import { useClientT } from "@/components/client/ClientI18nProvider";

export default function CoachMessageSheet({
  notification,
  onClose,
  coachAvatarUrl,
  coachInitial,
  clientAvatarUrl,
  clientInitial,
}: {
  notification: ClientNotificationItem | null;
  onClose: () => void;
  coachAvatarUrl?: string | null;
  coachInitial?: string | null;
  clientAvatarUrl?: string | null;
  clientInitial?: string | null;
}) {
  const { t } = useClientT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [attachmentSending, setAttachmentSending] = useState(false);

  useBodyScrollLock(Boolean(notification));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!notification || notification.id === "header-coach-message") return;
    void sendClientMutation({ kind: "notification", url: `/api/client/notifications/${encodeURIComponent(notification.id)}`, method: "PATCH" })
      .then(() => emitClientInboxUpdated())
      .catch(() => {});
  }, [notification]);

  const fallbackMessage = useMemo<ChatMessage | null>(() => {
    if (!notification) return null;
    return {
      id: String(notification.payload?.chat_message_id ?? notification.id),
      role: "assistant",
      content: notification.body ?? notification.title,
      message_type: "text",
      from_coach_human: true,
      created_at: notification.created_at,
    };
  }, [notification]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/client/chat/messages");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? t("common.error"));
      const loaded = Array.isArray(data?.messages) ? data.messages : [];
      const humanThread = loaded.filter((message: ChatMessage) => message.role === "user" || message.from_coach_human);
      setMessages(humanThread.length > 0 ? humanThread : fallbackMessage ? [fallbackMessage] : []);
      const unseenCoachMessageIds = loaded
        .filter((message: ChatMessage) => message.role === "assistant" && message.from_coach_human && !message.seen_at)
        .map((message: ChatMessage) => message.id)
        .filter((id): id is string => /^[0-9a-f-]{36}$/i.test(id));
      if (unseenCoachMessageIds.length > 0) {
        await sendClientMutation({
          kind: "notification",
          url: "/api/client/inbox/seen",
          method: "POST",
          body: { chatMessageIds: unseenCoachMessageIds },
        });
        emitClientInboxUpdated();
      }
    } catch (caught) {
      setMessages(fallbackMessage ? [fallbackMessage] : []);
      setError(caught instanceof Error ? caught.message : t('feedback.conversationUnavailable'));
    } finally {
      setLoading(false);
    }
  }, [fallbackMessage, t]);

  useEffect(() => {
    if (notification) void loadMessages();
    if (!notification) return;
    const interval = window.setInterval(() => void loadMessages(true), 3500);
    return () => window.clearInterval(interval);
  }, [loadMessages, notification]);

  const sendMessage = async (content: string) => {
    setSending(true);
    setError("");
    const optimisticId = `pending-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      role: "user",
      content,
      message_type: "text",
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);
    try {
      const response = await fetch("/api/client/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          message_type: "text",
          force_coach_notification: true,
          responds_to_message_id: notification?.payload?.chat_message_id ?? undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? t('feedback.replyError'));
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticId),
        ...(data?.userMessage ? [data.userMessage] : [optimisticMessage]),
      ]);
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));
      setError(caught instanceof Error ? caught.message : t('feedback.replyError'));
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file: File) => {
    setAttachmentSending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/client/chat/attachments", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? t("feedback.attachmentError"));
      if (data?.message) setMessages((current) => [...current, data.message]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("feedback.attachmentError"));
    } finally {
      setAttachmentSending(false);
    }
  };

  if (!notification || !mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("feedback.coachDialog")}
        className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] mx-auto flex max-h-[88dvh] min-h-[420px] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#0d0d0d] pb-[var(--client-modal-bottom-padding)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 pt-5 pb-4">
          <div>
            <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">{t("feedback.coachMessage")}</p>
            <p className="mt-1 text-[11px] text-white/40">{t("feedback.coachSubtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("ui.close")} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 transition-colors active:bg-white/[0.08]">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-white/45">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <ChatConversation
            messages={messages.slice(-20)}
            coachAvatarUrl={coachAvatarUrl}
            coachInitial={coachInitial}
            clientAvatarUrl={clientAvatarUrl}
            clientInitial={clientInitial}
          />
        )}

        {error && <p className="shrink-0 bg-red-500/10 px-4 py-2 text-xs text-red-200">{error}</p>}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0d0d0d] px-4 py-3">
          <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendAttachment(file); event.currentTarget.value = ""; }} />
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1.5 shadow-inner shadow-black/20">
            <button type="button" aria-label={t("feedback.attachFile")} onClick={() => attachmentInputRef.current?.click()} disabled={attachmentSending || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/55 transition-colors active:bg-white/[0.1] disabled:opacity-40"><Paperclip size={16} /></button>
            <div className="min-w-0 flex-1"><ChatInputBar compact onSend={sendMessage} disabled={loading || sending || attachmentSending} /></div>
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}
