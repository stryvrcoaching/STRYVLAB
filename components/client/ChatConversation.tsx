"use client"

import { useEffect, useRef, useState } from "react"
import ChatBubble, { type ChatMessage } from "./ChatBubble"
import { useClientT } from "@/components/client/ClientI18nProvider"
import MessageScroller from "@/components/ui/MessageScroller"

interface ChatConversationProps {
  messages: ChatMessage[]
  coachAvatarUrl?: string | null
  coachInitial?: string | null
  clientAvatarUrl?: string | null
  clientInitial?: string | null
  isLoading?: boolean
  onInteract?: (messageId: string, key: string, value: number) => void
  onSkip?: (messageId: string, key: string) => void
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onMessagesSeen?: (messageIds: string[]) => void
}

function LoadingAvatar({ url, initial }: { url?: string | null; initial: string }) {
  const [photoReady, setPhotoReady] = useState(false)

  useEffect(() => {
    if (!url) return
    const img = new window.Image()
    img.onload = () => setPhotoReady(true)
    img.onerror = () => setPhotoReady(false)
    img.src = url
  }, [url])

  return (
    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#1a1a1a] flex items-center justify-center relative">
      <span className="text-[11px] font-bold text-white leading-none" style={{ fontFamily: 'Arial, sans-serif' }}>
        {initial}
      </span>
      {photoReady && url && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
    </div>
  )
}

function formatDateSeparator(dateStr: string, lang: "fr" | "en" | "es", t: ReturnType<typeof useClientT>["t"]): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return t("common.today")
  if (sameDay(d, yesterday)) return t("common.yesterday")
  return d.toLocaleDateString(lang === "es" ? "es-ES" : lang === "en" ? "en-US" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

export default function ChatConversation({
  messages,
  coachAvatarUrl,
  coachInitial,
  clientAvatarUrl,
  clientInitial,
  isLoading,
  onInteract,
  onSkip,
  onEdit,
  onDelete,
  onMessagesSeen,
}: ChatConversationProps) {
  const { t, lang } = useClientT()
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const locallySeenIdsRef = useRef<Set<string>>(new Set())

  const displayMessages = messages.filter((message) => message?.message_type !== "checkin_summary")

  useEffect(() => {
    for (const message of displayMessages) {
      if (message.seen_at) locallySeenIdsRef.current.add(message.id)
    }
  }, [displayMessages])

  useEffect(() => {
    if (!onMessagesSeen) return
    const root = containerRef.current?.closest<HTMLDivElement>('[data-message-scroller-viewport="true"]')
    if (!root) return

    const timers = new Map<string, number>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement
        const id = target.dataset.chatMessageId
        if (!id || locallySeenIdsRef.current.has(id)) continue

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (timers.has(id)) continue
          const timer = window.setTimeout(() => {
            locallySeenIdsRef.current.add(id)
            timers.delete(id)
            onMessagesSeen([id])
          }, 400)
          timers.set(id, timer)
        } else {
          const timer = timers.get(id)
          if (timer) {
            window.clearTimeout(timer)
            timers.delete(id)
          }
        }
      }
    }, { root, threshold: [0.6] })

    const elements = root.querySelectorAll<HTMLElement>('[data-observe-visible="true"]')
    elements.forEach((element) => observer.observe(element))

    return () => {
      observer.disconnect()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [messages, onMessagesSeen])

  // Click outside to close active menu
  useEffect(() => {
    if (!activeMenuId) return

    const handleOutsideClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.message-options-container')) {
        setActiveMenuId(null)
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [activeMenuId])

  type Item =
    | { type: "separator"; label: string; key: string }
    | { type: "message"; msg: ChatMessage }

  const items: Item[] = []
  let lastDate = ""
  // Safely iterate over messages, ignoring any null/undefined entries or those missing created_at
  for (const msg of displayMessages) {
    if (!msg || typeof msg.created_at !== "string") {
      continue; // skip malformed message
    }
    const day = msg.created_at.split("T")[0]
    if (day !== lastDate) {
      items.push({ type: "separator", label: formatDateSeparator(msg.created_at, lang, t), key: `sep-${day}` })
      lastDate = day
    }
    items.push({ type: "message", msg })
  }

  const latestUserMessageId = [...displayMessages].reverse().find((message) => message?.role === "user")?.id
  const transcriptKey = `${displayMessages.map((message) => message?.id ?? "missing").join(",")}:${isLoading ? "loading" : "ready"}`

  return (
    <MessageScroller
      contentKey={transcriptKey}
      anchorId={latestUserMessageId}
      className="px-4 py-3"
      label={t("chat.scrollToLatest")}
      newMessagesLabel={t("chat.newMessages")}
    >
      <div ref={containerRef} className="flex flex-col gap-3" style={{ overscrollBehaviorY: 'contain' }}>
      {items.map(item =>
        item.type === "separator" ? (
          <div key={item.key} className="flex items-center justify-center py-2">
            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#5a5a5a]">
              {item.label}
            </span>
          </div>
        ) : (
          <div key={item.msg.id} data-message-scroller-id={item.msg.id}>
            <ChatBubble
              message={item.msg}
              coachAvatarUrl={coachAvatarUrl}
              coachInitial={coachInitial}
              clientAvatarUrl={clientAvatarUrl}
              clientInitial={clientInitial}
              onInteract={onInteract}
              onSkip={onSkip}
              onEdit={onEdit}
              onDelete={onDelete}
              isMenuOpen={activeMenuId === item.msg.id}
              onMenuToggle={(isOpen) => setActiveMenuId(isOpen ? item.msg.id : null)}
            />
          </div>
        )
      )}

      {isLoading && (
        <div className="flex items-start gap-2">
          <LoadingAvatar
            url={coachAvatarUrl}
            initial={(coachInitial || "C").trim().charAt(0).toUpperCase() || "C"}
          />
          <div className="bg-[#111111] rounded-2xl rounded-tl-sm px-3.5 py-3 flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#222222] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      </div>
    </MessageScroller>
  )
}
