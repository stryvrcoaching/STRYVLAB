"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"
import ChatTodayStrip from "./ChatTodayStrip"
import ChatConversation from "./ChatConversation"
import ChatInputBar from "./ChatInputBar"
import { type ChatMessage, type InteractiveMetadata } from "./ChatBubble"
import { ActiveCheckinFlow, type CheckinFlowHandle } from "./checkin/CheckinFlow"
import { MORNING_FLOW, EVENING_FLOW, type CheckinData } from "@/lib/client/checkin/flows"
import { determineSlotForClick } from "@/lib/client/checkin/checkinEngine"
import { getPendingSlots, type PendingSlot } from "@/lib/client/checkin/pendingCheckins"
import { emitClientInboxUpdated } from "@/lib/client/inboxEvents"
import {
  clearCheckinDraft,
  loadCheckinDraft,
  saveCheckinDraft,
  type CheckinDraftState,
} from "@/lib/client/checkin/draftStorage"

function CoachAvatarHero({ url, initial }: { url?: string | null; initial: string }) {
  const [photoReady, setPhotoReady] = useState(false)

  useEffect(() => {
    if (!url) return
    const img = new window.Image()
    img.onload = () => setPhotoReady(true)
    img.onerror = () => setPhotoReady(false)
    img.src = url
  }, [url])

  return (
    <div className="w-[72px] h-[72px] rounded-full bg-[#1a1a1a] flex items-center justify-center relative overflow-hidden">
      <span className="text-[26px] font-barlow-condensed font-bold text-white select-none">
        {initial}
      </span>
      {photoReady && url && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
    </div>
  )
}

interface ChatPageProps {
  coachAvatarUrl?: string | null
  coachInitial?: string | null
  clientFirstName?: string | null
  lang?: ClientLang
}

type TodayData = {
  sessions: { id: string; name: string }[]
  timezone?: string
  checkin: {
    morning: boolean
    evening: boolean
    pendingCount?: number
    activeWindow?: 'morning' | 'evening' | null
    sessions?: { flow_type: string; completed_at: string | null; date?: string }[]
  }
  calories: { logged: number; target: number }
  water: { logged: number; target: number }
}

export default function ChatPage({ coachAvatarUrl: initialAvatarUrl, coachInitial: initialCoachInitial, clientFirstName, lang = 'fr' }: ChatPageProps) {
  const QUICK_SUGGESTIONS = [
    ct(lang, 'chat.qs1'),
    ct(lang, 'chat.qs2'),
    ct(lang, 'chat.qs3'),
  ]

  // Client-side fetch overrides SSR props — ensures fresh signed URL and avoids stale data
  const [coachAvatarUrl, setCoachAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null)
  const [coachInitial, setCoachInitial] = useState<string | null>(initialCoachInitial ?? null)

  useEffect(() => {
    fetch('/api/client/coach-info')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.avatarUrl) setCoachAvatarUrl(data.avatarUrl)
        if (data.initial)   setCoachInitial(data.initial)
      })
      .catch(() => {})
  }, [])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [remaining, setRemaining] = useState(20)
  const [initialized, setInitialized] = useState(false)
  const [todayData, setTodayData] = useState<TodayData | null>(null)
  const [activeSlot, setActiveSlot] = useState<PendingSlot | null>(null)
  const [draftProgress, setDraftProgress] = useState<CheckinDraftState | null>(null)
  const [flowKey, setFlowKey] = useState(0)
  const [flowHandle, setFlowHandle] = useState<CheckinFlowHandle | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const activeSlotRef = useRef<PendingSlot | null>(null)

  useEffect(() => {
    activeSlotRef.current = activeSlot
  }, [activeSlot])

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const updateMessage = useCallback((id: string, metaPatch: Partial<InteractiveMetadata>) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m
      return { ...m, metadata: { ...(m.metadata ?? {}), ...metaPatch } as InteractiveMetadata }
    }))
  }, [])

  const handleFlowComplete = useCallback(async (
    data: CheckinData,
    summary: string,
    flowType: 'morning' | 'evening',
    slotDate: string,
  ) => {
    setActiveSlot(null)
    setDraftProgress(null)
    clearCheckinDraft()
    setIsLoading(true)

    try {
      const res = await fetch('/api/client/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow_type: flowType, date: slotDate, data, summary }),
      })
      const json = await res.json()
      if (json.botMessage) {
        setMessages(prev => [...prev, json.botMessage])
      }
      if (json.remaining !== undefined) setRemaining(json.remaining)
      // Refresh today strip to update check-in status
      fetch('/api/client/chat/today-strip').then(r => r.json()).then(setTodayData).catch(() => {})
    } catch {
      // Silent fail — check-in was saved
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleMessagesSeen = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return

    setMessages((prev) => prev.map((message) => (
      messageIds.includes(message.id)
        ? { ...message, seen_at: message.seen_at ?? new Date().toISOString() }
        : message
    )))

    emitClientInboxUpdated()

    try {
      await fetch('/api/client/inbox/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatMessageIds: messageIds }),
      })
      emitClientInboxUpdated()
    } catch {
      // Silent fail — local optimistic state is enough until next refresh.
    }
  }, [])

  const refreshChatData = useCallback(() => {
    return Promise.all([
      fetch('/api/client/chat/messages').then(r => r.json()),
      fetch('/api/client/chat/today-strip').then(r => r.json()),
    ]).then(([msgData, todayRaw]) => {
      setMessages(msgData.messages ?? [])
      setTodayData(todayRaw)
      setInitialized(true)
    }).catch(() => setInitialized(true))
  }, [])

  // Load on mount + refetch when the PWA returns to foreground.
  // Fixes stale morning state on resume: GET /messages re-runs the proactive init
  // server-side (creates the morning greeting) and today-strip reflects real pending state.
  useEffect(() => {
    const draft = loadCheckinDraft()
    if (draft) {
      setActiveSlot(draft.slot)
      setDraftProgress(draft)
    }
    refreshChatData()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !activeSlotRef.current) refreshChatData()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refreshChatData])

  const startCheckinSlot = useCallback((slot: PendingSlot) => {
    setActiveSlot(slot)
    const draft = {
      slot,
      collected: {},
      stepIndex: 0,
    } satisfies CheckinDraftState
    setDraftProgress(draft)
    saveCheckinDraft(draft)
    setFlowKey(k => k + 1)
  }, [])

  const handleCheckinClick = useCallback(() => {
    if (!todayData) return
    const timezone = todayData.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const sessionRows = todayData.checkin?.sessions ?? [
      { flow_type: 'morning', completed_at: todayData.checkin?.morning ? 'done' : null },
      { flow_type: 'evening', completed_at: todayData.checkin?.evening ? 'done' : null },
    ]

    const slot = determineSlotForClick(new Date(), timezone, sessionRows)
    if (!slot) {
      setMessages(prev => [...prev, {
        id: `done-${Date.now()}`,
        role: 'assistant',
        content: 'Check-ins à jour ✓ Reviens plus tard !',
        message_type: 'text',
        created_at: new Date().toISOString(),
      }])
      return
    }
    startCheckinSlot(slot)
  }, [todayData, startCheckinSlot])

  const hasSessionToday = Boolean(todayData?.sessions?.length)

  const handleInteract = useCallback(async (messageId: string, key: string, value: number) => {
    if (key === 'checkin_ready') {
      const msg = messages.find(m => m.id === messageId)
      const meta = msg?.metadata as InteractiveMetadata | undefined
      const flowType = meta?.flow_type

      if (value === 2) {
        updateMessage(messageId, { answered: true })
        const res = await fetch('/api/client/chat/checkin-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId, action: 'defer' }),
        }).catch(() => {})
        const payload = res && 'json' in res ? await res.json().catch(() => null) : null
        const persisted = Array.isArray(payload?.messages) ? payload.messages as ChatMessage[] : []
        if (persisted.length > 0) {
          persisted.forEach(addMessage)
        } else {
          addMessage({
            id: `defer-${Date.now()}`,
            role: 'user',
            content: 'Plus tard',
            message_type: 'quick_reply',
            created_at: new Date().toISOString(),
          })
          addMessage({
            id: `defer-followup-${Date.now()}`,
            role: 'assistant',
            content: meta?.defer_message || 'Très bien. Quand tu es prêt, clique sur le bouton Check-in juste au-dessus.',
            message_type: 'text',
            created_at: new Date().toISOString(),
          })
        }
        return
      }

      if (value === 1 && flowType) {
        updateMessage(messageId, { answered: true })
        const res = await fetch('/api/client/chat/checkin-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId, action: 'mark_answered' }),
        }).catch(() => {})
        const payload = res && 'json' in res ? await res.json().catch(() => null) : null
        const persisted = Array.isArray(payload?.messages) ? payload.messages as ChatMessage[] : []
        if (persisted.length > 0) {
          persisted.forEach(addMessage)
        } else {
          addMessage({
            id: `ready-${Date.now()}`,
            role: 'user',
            content: 'Oui',
            message_type: 'quick_reply',
            created_at: new Date().toISOString(),
          })
        }
        const timezone = todayData?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
        const sessions = todayData?.checkin?.sessions ?? []
        const pending = getPendingSlots(new Date(), timezone, sessions)
        const slot = pending.find(p => p.flow_type === flowType) ?? pending[0]
        if (slot) startCheckinSlot(slot)
        return
      }
    }

    if (key === 'trigger_checkin') {
      updateMessage(messageId, { answered: true })
      handleCheckinClick()
      return
    }
    flowHandle?.handleInteract(messageId, key, value)
  }, [flowHandle, handleCheckinClick, updateMessage, messages, addMessage, startCheckinSlot, todayData])

  const handleSkip = useCallback((messageId: string, key: string) => {
    flowHandle?.handleSkip(messageId, key)
  }, [flowHandle])

  const handleEdit = useCallback((messageId: string) => {
    const msg = messages.find(m => m.id === messageId)
    if (msg) setEditingMessage(msg)
  }, [messages])

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/client/chat/messages/${messageId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === messageId)
          if (idx === -1) return prev
          return prev.filter((m, i) => {
            if (m.id === messageId) return false
            if (i === idx + 1 && m.role === 'assistant') return false
            return true
          })
        })
      }
    } catch (e) {
      console.error("Error deleting message:", e)
    }
  }, [])

  const handleSend = useCallback(async (content: string, type = "text") => {
    if (isLoading) return

    if (editingMessage) {
      const msgId = editingMessage.id
      setIsLoading(true)
      try {
        const res = await fetch(`/api/client/chat/messages/${msgId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        })
        const data = await res.json()
        if (res.ok) {
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === msgId)
            if (idx === -1) return prev
            const newMsgs = prev.filter((m, i) => {
              if (i === idx + 1 && m.role === 'assistant') return false
              return true
            })
            const finalMsgs = [...newMsgs]
            finalMsgs[idx] = data.userMessage
            if (data.botMessage) {
              finalMsgs.splice(idx + 1, 0, data.botMessage)
            }
            return finalMsgs
          })
          setEditingMessage(null)
        }
      } catch (e) {
        console.error("Error editing message:", e)
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (remaining <= 0) return

    const tempId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId,
      role: "user",
      content,
      message_type: type,
      created_at: new Date().toISOString(),
    }])
    setIsLoading(true)

    try {
      const res = await fetch("/api/client/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, message_type: type }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempId),
          data.userMessage,
          data.botMessage,
        ])
        setRemaining(data.remaining ?? 0)
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, remaining, editingMessage])

  const isEmpty = initialized && messages.length === 0

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col bg-[#0d0d0d]"
      style={{ bottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
    >
      {/* Active flow — renders null, manages flow state */}
      {activeSlot && (
        <ActiveCheckinFlow
          key={flowKey}
          flow={activeSlot.flow_type === 'morning' ? MORNING_FLOW : EVENING_FLOW}
          hasSessionToday={hasSessionToday}
          clientFirstName={clientFirstName}
          initialProgress={draftProgress?.slot.date === activeSlot.date && draftProgress?.slot.flow_type === activeSlot.flow_type
            ? { collected: draftProgress.collected, stepIndex: draftProgress.stepIndex }
            : null}
          onAddMessage={addMessage}
          onUpdateMessage={updateMessage}
          onComplete={(data, summary, flowType) =>
            handleFlowComplete(data, summary, flowType, activeSlot.date)
          }
          onHandle={setFlowHandle}
          onProgress={(progress) => {
            const nextDraft = {
              slot: activeSlot,
              collected: progress.collected,
              stepIndex: progress.stepIndex,
            } satisfies CheckinDraftState
            setDraftProgress(nextDraft)
            saveCheckinDraft(nextDraft)
          }}
        />
      )}

      <ChatTodayStrip onCheckinClick={handleCheckinClick} />

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 overflow-hidden">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <CoachAvatarHero
              url={coachAvatarUrl}
              initial={(coachInitial || "C").trim().charAt(0).toUpperCase() || "C"}
            />
          </motion.div>

          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <p className="text-[17px] font-barlow font-semibold text-white leading-snug">
              {clientFirstName
                ? ct(lang, 'chat.greeting', { name: clientFirstName })
                : ct(lang, 'chat.greetingAnon')}
            </p>
            <p className="text-[13px] text-[#5a5a5a] font-barlow mt-1">
              {ct(lang, 'chat.subtitle')}
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="flex flex-wrap gap-2 justify-center w-full max-w-[320px]"
          >
            {QUICK_SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="px-3 py-2 bg-[#1a1a1a] rounded-xl text-[12px] font-barlow text-[#808080] active:bg-[#222222] active:text-[#e0e0e0] transition-all"
              >
                {s}
              </button>
            ))}
          </motion.div>
        </div>
      ) : (
        <ChatConversation
          messages={messages}
          coachAvatarUrl={coachAvatarUrl}
          coachInitial={coachInitial}
          isLoading={isLoading}
          onInteract={handleInteract}
          onSkip={handleSkip}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMessagesSeen={handleMessagesSeen}
        />
      )}

      <AnimatePresence>
        {remaining <= 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="px-4 py-2 text-center text-[11px] text-[#5a5a5a] font-barlow bg-[#111111]">
              Limite journalière atteinte · Reviens demain
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatInputBar
        onSend={handleSend}
        disabled={isLoading || (remaining <= 0 && !editingMessage) || activeSlot !== null}
        editContent={editingMessage?.content}
        onCancelEdit={() => setEditingMessage(null)}
      />
    </div>
  )
}
