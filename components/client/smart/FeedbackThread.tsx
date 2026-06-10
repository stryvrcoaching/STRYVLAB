'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import type { CoachFeedback, FeedbackEmoji } from '@/lib/feedback/types'
import { FEEDBACK_EMOJIS } from '@/lib/feedback/types'

interface FeedbackThreadProps {
  entityType: string
  entityId: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function FeedbackCard({ feedback, onReacted }: { feedback: CoachFeedback; onReacted: () => void }) {
  const [selectedEmoji, setSelectedEmoji] = useState<FeedbackEmoji | null>(
    () => {
      const clientReaction = feedback.reactions.find(r => r.author_type === 'client')
      return clientReaction?.emoji ?? null
    }
  )
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleReact(emoji: FeedbackEmoji) {
    if (sending) return
    setSelectedEmoji(emoji)
    setSending(true)
    try {
      await fetch(`/api/client/feedback/${feedback.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, reply_text: replyText.trim() || undefined }),
      })
      setReplyText('')
      setShowReply(false)
      onReacted()
    } finally {
      setSending(false)
    }
  }

  async function handleSendReply() {
    if (!replyText.trim() || sending) return
    setSending(true)
    try {
      await fetch(`/api/client/feedback/${feedback.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: selectedEmoji ?? '👍', reply_text: replyText.trim() }),
      })
      setReplyText('')
      setShowReply(false)
      onReacted()
    } finally {
      setSending(false)
    }
  }

  const coachReactions = feedback.reactions.filter(r => r.author_type === 'coach')

  return (
    <div className="bg-[#111111] rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f2f2f2]/10 flex items-center justify-center">
            <MessageSquare size={13} className="text-[#f2f2f2]" />
          </div>
          <span className="text-[12px] font-semibold text-white">Coach</span>
        </div>
        <span className="text-[10px] text-white/30">{timeAgo(feedback.created_at)}</span>
      </div>

      {/* Body */}
      <p className="text-[13px] text-white/80 leading-relaxed">{feedback.body}</p>

      {/* Emoji reactions */}
      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            disabled={sending}
            className={`h-9 w-9 flex items-center justify-center rounded-xl text-[18px] transition-all active:scale-95 ${
              selectedEmoji === emoji
                ? 'bg-[#2e2e2e]'
                : 'bg-[#1a1a1a] hover:bg-[#222222]'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Reply toggle */}
      {!showReply && (
        <button
          onClick={() => setShowReply(true)}
          className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
        >
          Répondre…
        </button>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="flex gap-2">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Ta réponse..."
            rows={2}
            className="flex-1 bg-[#111111] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-[#5a5a5a] outline-none resize-none transition-colors"
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || sending}
            className="h-9 w-9 flex items-center justify-center bg-[#f2f2f2] text-[#080808] rounded-xl disabled:opacity-50 active:scale-95 transition-all shrink-0 self-end"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      )}

      {/* Coach replies */}
      {coachReactions.filter(r => r.reply_text).map(r => (
        <div key={r.id} className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-white/30 mb-1">Coach · {timeAgo(r.created_at)}</p>
          <p className="text-[12px] text-white/60">{r.reply_text}</p>
        </div>
      ))}
    </div>
  )
}

export default function FeedbackThread({ entityType, entityId }: FeedbackThreadProps) {
  const [feedbacks, setFeedbacks] = useState<CoachFeedback[]>([])

  const load = () => {
    fetch(`/api/client/feedback/${entityType}/${entityId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setFeedbacks)
      .catch(() => {})
  }

  useEffect(() => { load() }, [entityType, entityId])

  if (feedbacks.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 px-1">
        Message coach
      </p>
      {feedbacks.map(fb => (
        <FeedbackCard key={fb.id} feedback={fb} onReacted={load} />
      ))}
    </div>
  )
}
