"use client";

import { useEffect, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { useRef } from "react";
import type { ChatAttachment } from "@/lib/chat/attachments";
import MessageScroller from "@/components/ui/MessageScroller";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";

type CoachThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_type?: string;
  from_coach_human?: boolean;
  metadata?: { attachment?: ChatAttachment } | null;
  created_at: string;
};

type CoachNotification = {
  clientId: string;
  clientName: string;
  messageExcerpt: string | null;
  /** Prefill composer (e.g. cockpit direction draft) */
  draftContent?: string | null;
};

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMessageDay(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (sameDay(date, today)) return "Aujourd’hui";
  if (sameDay(date, yesterday)) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export default function CoachConversationSheet({
  notification,
  onClose,
  onSent,
}: {
  notification: CoachNotification | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [messages, setMessages] = useState<CoachThreadMessage[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [attachmentSending, setAttachmentSending] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [participantAvatars, setParticipantAvatars] = useState<{ clientAvatarUrl: string | null; coachAvatarUrl: string | null }>({ clientAvatarUrl: null, coachAvatarUrl: null });

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "auto";
    composer.style.height = `${Math.min(composer.scrollHeight, 144)}px`;
  }, [content]);

  useEffect(() => {
    if (!notification) return;
    setLoading(true);
    setError("");
    if (notification.draftContent) {
      setContent(notification.draftContent);
    }
    const load = () => fetch(`/api/coach/clients/${notification.clientId}/reply`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Conversation indisponible.");
        const loaded = Array.isArray(data?.messages) ? data.messages : [];
        setParticipantAvatars({
          clientAvatarUrl: data?.participants?.clientAvatarUrl ?? null,
          coachAvatarUrl: data?.participants?.coachAvatarUrl ?? null,
        });
        setMessages(loaded.filter((message: CoachThreadMessage) =>
          (message.role === "user" || message.from_coach_human) && message.message_type !== "checkin_summary"
        ));
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Conversation indisponible.");
        if (notification.messageExcerpt) {
          setMessages([{
            id: `fallback-${notification.clientId}`,
            role: "user",
            content: notification.messageExcerpt,
            created_at: new Date().toISOString(),
          }]);
        }
      })
      .finally(() => setLoading(false));
    void load();
    const interval = window.setInterval(load, 3000);
    return () => window.clearInterval(interval);
  }, [notification]);

  const send = async () => {
    if (!notification || !content.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/coach/clients/${notification.clientId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Réponse impossible à envoyer.");
      if (data?.message) setMessages((current) => [...current, data.message]);
      setContent("");
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Réponse impossible à envoyer.");
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file: File) => {
    if (!notification || attachmentSending) return;
    setAttachmentSending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/coach/clients/${notification.clientId}/attachments`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Pièce jointe impossible à envoyer.");
      if (data?.message) setMessages((current) => [...current, data.message]);
      onSent();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pièce jointe impossible à envoyer.");
    } finally {
      setAttachmentSending(false);
    }
  };

  if (!notification) return null;

  const latestClientMessageId = [...messages].reverse().find((message) => message.role === "user" && !message.from_coach_human)?.id;
  const transcriptKey = `${messages.map((message) => message.id).join(",")}:${loading ? "loading" : "ready"}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Conversation avec ${notification.clientName}`}
        className="fixed inset-y-0 left-0 flex h-full w-full max-w-[440px] flex-col overflow-hidden rounded-r-[28px] border-r border-white/[0.08] bg-[#121212] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7fe0b8]">Conversation client</p>
            <h2 className="mt-1 text-base font-semibold text-white">{notification.clientName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 hover:text-white">
            <X size={17} />
          </button>
        </header>

        <MessageScroller contentKey={transcriptKey} anchorId={latestClientMessageId} className="space-y-3 px-5 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-white/40"><Loader2 size={18} className="animate-spin" /></div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-white/35">Aucun message dans cette conversation.</p>
          ) : messages.slice(-30).map((message, index, visibleMessages) => {
            const isCoach = message.role === "assistant" || message.from_coach_human;
            const previous = visibleMessages[index - 1];
            const showDay = !previous || formatMessageDay(previous.created_at) !== formatMessageDay(message.created_at);
            return (
              <div key={message.id} data-message-scroller-id={message.id}>
                {showDay && <div className="my-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">{formatMessageDay(message.created_at)}</div>}
                <Message align={isCoach ? "end" : "start"}>
                  <div aria-hidden="true" className="flex h-7 w-7 shrink-0 self-end items-center justify-center overflow-hidden rounded-full bg-[#1c1c1c] text-[10px] font-semibold text-white/65">
                    {(isCoach ? participantAvatars.coachAvatarUrl : participantAvatars.clientAvatarUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(isCoach ? participantAvatars.coachAvatarUrl : participantAvatars.clientAvatarUrl)!} alt="" className="h-full w-full object-cover" />
                    ) : (isCoach ? "C" : notification.clientName.trim().charAt(0).toUpperCase())}
                  </div>
                  <MessageContent className="max-w-[82%] gap-1.5">
                    <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-5 ${isCoach ? "rounded-br-sm bg-[#222222] text-white" : "rounded-bl-sm bg-[#181818] text-[#e0e0e0]"}`}>{message.content}</div>
                    {message.metadata?.attachment?.url && (
                      <a href={message.metadata.attachment.url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
                        {message.metadata.attachment.type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={message.metadata.attachment.url} alt={message.metadata.attachment.name} className="max-h-56 max-w-[240px] object-cover" />
                        ) : <span className="flex max-w-[240px] items-center gap-2 px-3 py-2 text-[11px] text-white/75">📎 {message.metadata.attachment.name}</span>}
                      </a>
                    )}
                    <MessageFooter className={`px-1 text-[9px] text-white/25 ${isCoach ? "justify-end" : "justify-start"}`}>{formatMessageTime(message.created_at)}</MessageFooter>
                  </MessageContent>
                </Message>
              </div>
            );
          })}
        </MessageScroller>

        {error && <p className="shrink-0 bg-red-500/10 px-5 py-2 text-xs text-red-200">{error}</p>}
        <div className="flex shrink-0 items-end gap-2 bg-[#0d0d0d] px-4 py-3">
          <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendAttachment(file); event.currentTarget.value = ""; }} />
          <button type="button" aria-label="Joindre un fichier" onClick={() => attachmentInputRef.current?.click()} disabled={attachmentSending || sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/55 disabled:opacity-40"><Paperclip size={16} /></button>
          <textarea
            value={content}
            ref={composerRef}
            onChange={(event) => setContent(event.target.value)}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send();
            }}
            rows={1}
            maxLength={2000}
            placeholder="Écrire une réponse…"
            disabled={sending || attachmentSending}
            className={`min-h-11 flex-1 resize-none rounded-xl px-3 py-3 text-sm leading-5 text-white outline-none placeholder:text-white/35 transition-colors disabled:opacity-50 ${composerFocused ? "bg-[#222222]" : "bg-[#181818]"}`}
            style={{ maxHeight: "144px", overflowY: "auto" }}
          />
          <button type="button" onClick={() => void send()} disabled={sending || !content.trim()} aria-label="Envoyer" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${content.trim() ? "bg-[#1f8a65] text-white" : "bg-[#222222] text-white/35"}`}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </section>
    </div>
  );
}
