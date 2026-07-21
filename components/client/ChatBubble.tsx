"use client"

import { useState, useEffect } from "react"
import { useClientT } from "@/components/client/ClientI18nProvider"
import { Message, MessageAvatar, MessageContent, MessageFooter } from "@/components/ui/message"
import type { ChatAttachment } from "@/lib/chat/attachments"
import { formatSleepHours, sleepPartsToHoursNumber, splitSleepHours } from "@/lib/client/checkin/sleepTimeFormat"

export interface InteractiveMetadata {
  component: 'chips' | 'slider' | 'number' | 'time'
  key: string
  question: string
  helperText?: string
  defer_message?: string
  flow_type?: 'morning' | 'evening'
  greeting?: string
  options?: { label: string; value: number; emoji?: string }[]
  min?: number
  max?: number
  step?: number
  unit?: string
  optional?: boolean
  answered?: boolean
  deferred_until?: string | null
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  message_type: string
  metadata?: (InteractiveMetadata & { attachment?: ChatAttachment }) | null
  from_coach_human?: boolean
  seen_at?: string | null
  created_at: string
}

interface ChatBubbleProps {
  message: ChatMessage
  coachAvatarUrl?: string | null
  coachInitial?: string | null
  clientAvatarUrl?: string | null
  clientInitial?: string | null
  onInteract?: (messageId: string, key: string, value: number) => void
  onSkip?: (messageId: string, key: string) => void
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  isMenuOpen: boolean
  onMenuToggle: (isOpen: boolean) => void
}

function SliderInput({
  meta,
  answered,
  onInteract,
}: {
  meta: InteractiveMetadata
  answered: boolean
  onInteract: (val: number) => void
}) {
  const min = meta.min ?? 0
  const max = meta.max ?? 10
  const step = meta.step ?? 1
  const mid = Math.round(((min + max) / 2) / step) * step
  const [val, setVal] = useState(mid)
  const pct = ((val - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-2 w-[220px]">
      <div className="flex justify-between text-[10px] text-[#5a5a5a] font-barlow">
        <span>{min}{meta.unit}</span>
        <span className="text-[#e0e0e0] font-semibold text-[13px]">{val}{meta.unit}</span>
        <span>{max}{meta.unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={val}
        disabled={answered}
        onChange={e => setVal(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer disabled:cursor-default"
        style={{
          background: `linear-gradient(to right, #f2f2f2 0%, #f2f2f2 ${pct}%, #2e2e2e ${pct}%, #2e2e2e 100%)`,
        }}
      />
      {!answered && (
        <button
          onClick={() => onInteract(val)}
          className="self-end px-3 py-1 bg-[#f2f2f2] text-[#080808] rounded-lg text-[12px] font-barlow font-semibold active:scale-95 transition-all"
        >
          Confirmer
        </button>
      )}
    </div>
  )
}

function NumberInput({
  meta,
  answered,
  onInteract,
}: {
  meta: InteractiveMetadata
  answered: boolean
  onInteract: (val: number) => void
}) {
  const [val, setVal] = useState('')
  const parsed = parseFloat(val)
  const isValid = !isNaN(parsed) && val.trim() !== ''

  return (
    <>
      <input
        type="number"
        value={val}
        disabled={answered}
        onChange={e => setVal(e.target.value)}
        placeholder="0"
        min={meta.min}
        max={meta.max}
        className="w-20 bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2 text-[14px] font-barlow text-[#e0e0e0] text-center outline-none disabled:opacity-50"
      />
      {meta.unit && (
        <span className="text-[12px] text-[#5a5a5a] font-barlow">{meta.unit}</span>
      )}
      {!answered && isValid && (
        <button
          onClick={() => onInteract(parsed)}
          className="px-3 py-1.5 bg-[#f2f2f2] text-[#080808] rounded-lg text-[12px] font-barlow font-semibold active:scale-95 transition-all"
        >
          OK
        </button>
      )}
    </>
  )
}

function TimeInput({
  meta,
  answered,
  onInteract,
}: {
  meta: InteractiveMetadata
  answered: boolean
  onInteract: (val: number) => void
}) {
  const minHours = meta.min ?? 0
  const maxHours = meta.max ?? 12
  const initialParts = splitSleepHours(Math.max(minHours, 8))
  const [hours, setHours] = useState(initialParts.hours)
  const [minutes, setMinutes] = useState(initialParts.minutes)
  const parsed = sleepPartsToHoursNumber(hours, minutes)
  const isValid = parsed != null && parsed >= minHours && parsed <= maxHours
  const hourOptions = Array.from(
    { length: Math.max(0, Math.floor(maxHours) - Math.ceil(minHours) + 1) },
    (_, index) => Math.ceil(minHours) + index,
  )
  const minuteOptions = Array.from({ length: 60 }, (_, index) => index)

  return (
    <div className="flex flex-col gap-2 w-[220px]">
      <div className="flex items-center justify-between text-[10px] text-[#5a5a5a] font-barlow">
        <span>{formatSleepHours(minHours)}</span>
        <span className="text-[#e0e0e0] font-semibold text-[13px]">
          {parsed != null ? formatSleepHours(parsed) : '--'}
        </span>
        <span>{formatSleepHours(maxHours)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[#5a5a5a] font-barlow uppercase tracking-[0.12em]">Heures</span>
          <select
            value={String(hours)}
            disabled={answered}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-3 text-[16px] font-barlow text-[#e0e0e0] text-center outline-none disabled:opacity-50"
          >
            {hourOptions.map((option) => (
              <option key={option} value={option}>
                {String(option).padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-[#5a5a5a] font-barlow uppercase tracking-[0.12em]">Minutes</span>
          <select
            value={String(minutes)}
            disabled={answered}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-3 text-[16px] font-barlow text-[#e0e0e0] text-center outline-none disabled:opacity-50"
          >
            {minuteOptions.map((option) => (
              <option key={option} value={option}>
                {String(option).padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!answered && isValid && parsed != null && (
        <button
          onClick={() => onInteract(parsed)}
          className="self-end px-3 py-1 bg-[#f2f2f2] text-[#080808] rounded-lg text-[12px] font-barlow font-semibold active:scale-95 transition-all"
        >
          Confirmer
        </button>
      )}
      {!answered && !isValid && (
        <p className="text-[11px] text-[#8a6b53] font-barlow">
          Choisis une duree entre {formatSleepHours(minHours)} et {formatSleepHours(maxHours)}.
        </p>
      )}
    </div>
  )
}

function ConversationAvatar({ url, initial }: { url?: string | null; initial: string }) {
  const [imgError, setImgError] = useState(false)

  // Reset error state when URL changes
  useEffect(() => { setImgError(false) }, [url])

  const showPhoto = !!url && !imgError

  return (
    <div
      className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center relative"
      style={{ backgroundColor: '#454545', minWidth: 28, minHeight: 28 }}
    >
      <span
        className="leading-none select-none"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 700, color: '#ffffff' }}
      >
        {initial}
      </span>
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  )
}

function formatMessageTime(value: string, lang: "fr" | "en" | "es"): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es-ES" : lang === "en" ? "en-US" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function ChatBubble({
  message,
  coachAvatarUrl,
  coachInitial,
  clientAvatarUrl,
  clientInitial,
  onInteract,
  onSkip,
  onEdit,
  onDelete,
  isMenuOpen,
  onMenuToggle,
}: ChatBubbleProps) {
  const { t, lang } = useClientT()
  const isUser = message.role === "user";
  const meta = message.metadata;
  const answered = meta?.answered ?? false;
  const attachment = meta?.attachment;

  const initial = coachInitial?.trim() || "?";

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(!isMenuOpen);
  };
  const handleEdit = () => {
    onEdit?.(message.id);
    onMenuToggle(false);
  };
  const handleDelete = () => {
    onDelete?.(message.id);
    onMenuToggle(false);
  };

  return (
    <Message
      align={isUser ? "end" : "start"}
      className="items-start"
      data-chat-message-id={message.id}
      data-observe-visible={!isUser && !message.seen_at ? 'true' : 'false'}
    >
      <MessageAvatar className="h-7 min-w-7 bg-transparent p-0">
        <ConversationAvatar
          url={isUser ? clientAvatarUrl : coachAvatarUrl}
          initial={isUser
            ? (clientInitial?.trim() || "C").charAt(0).toUpperCase()
            : initial}
        />
      </MessageAvatar>

      <MessageContent className={`max-w-[82%] gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        {/* Text bubble */}
        <div className="relative flex items-center message-options-container">
          {isUser && message.message_type !== "checkin_summary" && isMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-[#1a1a1a] rounded-xl shadow-lg border border-[#2e2e2e] z-30 overflow-hidden">
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-xs font-semibold text-white hover:bg-[#2e2e2e] transition-colors"
                onClick={handleEdit}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-xs font-semibold text-red-400 hover:bg-[#2e2e2e] transition-colors"
                onClick={handleDelete}
              >
                {t('common.delete')}
              </button>
            </div>
          )}
          {message.message_type === "checkin_summary" ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#181818] px-3.5 py-2.5 text-[12px] font-medium text-[#b0b0b0] whitespace-pre-wrap">
              <span className="text-[14px]">📊</span>
              {message.content}
            </div>
          ) : (
            <div
              className={`px-3.5 py-2.5 text-[14px] leading-5 ${
                isUser
                ? "rounded-xl rounded-br-sm bg-[#222222] font-medium text-white cursor-pointer select-none transition-colors active:bg-[#2e2e2e]"
                  : "rounded-xl rounded-bl-sm bg-[#181818] text-[#e0e0e0]"
              }`}
              onClick={isUser && message.message_type !== "checkin_summary" ? handleMenuToggle : undefined}
            >
              {message.content}
            </div>
          )}
        </div>
        {attachment?.url && (
          <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
            {attachment.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.url} alt={attachment.name} className="max-h-56 max-w-[240px] object-cover" />
            ) : (
              <span className="flex max-w-[240px] items-center gap-2 px-3 py-2 text-[11px] text-white/75">📎 {attachment.name}</span>
            )}
          </a>
        )}
        {!isUser && meta?.component === 'chips' && (
          <div className={`flex flex-wrap gap-1.5 ${answered ? 'pointer-events-none opacity-40' : ''}`}>
            {(meta.options ?? []).map((option) => (
              <button
                key={option.value}
                onClick={() => !answered && onInteract?.(message.id, meta.key, option.value)}
                className="flex items-center gap-1 rounded-full bg-[#1a1a1a] px-3 py-1.5 font-barlow text-[12px] text-[#808080] transition-all active:bg-[#f2f2f2] active:text-[#080808]"
              >
                {option.emoji && <span>{option.emoji}</span>}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
        {!isUser && meta?.component === 'time' && (
          <div className={`rounded-xl bg-[#111111] px-3.5 py-3 ${answered ? 'pointer-events-none opacity-40' : ''}`}>
            <TimeInput meta={meta} answered={answered} onInteract={(value) => onInteract?.(message.id, meta.key, value)} />
          </div>
        )}
        {!isUser && meta?.component === 'slider' && (
          <div className={`rounded-xl bg-[#111111] px-3.5 py-3 ${answered ? 'pointer-events-none opacity-40' : ''}`}>
            <SliderInput meta={meta} answered={answered} onInteract={(value) => onInteract?.(message.id, meta.key, value)} />
          </div>
        )}
        {!isUser && meta?.component === 'number' && (
          <div className={`rounded-xl bg-[#111111] px-3.5 py-3 ${answered ? 'pointer-events-none opacity-40' : ''}`}>
            {meta.helperText && <p className="mb-2 max-w-[240px] font-barlow text-[11px] leading-[1.45] text-[#6f6f6f]">{meta.helperText}</p>}
            <div className="flex items-center gap-3">
              <NumberInput meta={meta} answered={answered} onInteract={(value) => onInteract?.(message.id, meta.key, value)} />
              {meta.optional && !answered && (
                <button onClick={() => onSkip?.(message.id, meta.key)} className="ml-1 shrink-0 font-barlow text-[11px] text-[#5a5a5a]">Passer →</button>
              )}
            </div>
          </div>
        )}
        <MessageFooter className={`px-1 text-[9px] text-white/25 ${isUser ? "justify-end" : "justify-start"}`}>
          {formatMessageTime(message.created_at, lang)}
        </MessageFooter>
      </MessageContent>
    </Message>
  )
}
