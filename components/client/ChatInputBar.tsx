"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ArrowRight, Microphone } from "@phosphor-icons/react"

interface ChatInputBarProps {
  onSend: (content: string, type?: string) => void
  disabled?: boolean
  editContent?: string
  onCancelEdit?: () => void
}

export default function ChatInputBar({ onSend, disabled, editContent, onCancelEdit }: ChatInputBarProps) {
  const [value, setValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState("")
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editContent !== undefined) {
      setValue(editContent || "")
    }
  }, [editContent])

  const displayValue = isRecording
    ? value + (interimText ? (value ? " " : "") + interimText : "")
    : value

  // Auto-resize up to ~5 lines
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [displayValue])

  const stopRecording = useCallback(() => {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    setIsRecording(false)
    setInterimText("")
  }, [])

  useEffect(() => () => stopRecording(), [stopRecording])

  function toggleRecording() {
    if (isRecording) {
      stopRecording()
      return
    }

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.lang = "fr-FR"
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (e: any) => {
      let newFinals = ""
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinals += e.results[i][0].transcript
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (newFinals) {
        setValue(prev => {
          const base = prev.trimEnd()
          return base ? base + " " + newFinals.trim() : newFinals.trim()
        })
      }
      setInterimText(interim.trim())
    }

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech") stopRecording()
    }

    // Continuous mode: restart silently after each natural pause
    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognition.start() } catch { stopRecording() }
      }
    }

    recognition.start()
    setIsRecording(true)
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    stopRecording()
    onSend(trimmed, "text")
    setValue("")
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 bg-[#0d0d0d] flex flex-col border-t border-white/[0.04]">
      {editContent !== undefined && editContent !== null && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#111111] border-b border-white/[0.04] text-[11px] text-[#808080] font-barlow">
          <span>Mode édition</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-red-400 hover:text-red-300 font-semibold transition-colors"
          >
            Annuler
          </button>
        </div>
      )}
      <div className="px-3 py-2.5 flex items-end gap-2">
        <button
          type="button"
          onClick={toggleRecording}
          disabled={disabled}
          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${
            isRecording
              ? "bg-red-500/15 text-red-400"
              : "bg-[#1a1a1a] text-[#5a5a5a] active:bg-[#222222]"
          }`}
          aria-label={isRecording ? "Arrêter la dictée" : "Saisie vocale"}
        >
          <Microphone size={18} weight={isRecording ? "fill" : "regular"} />
        </button>

        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={e => { if (!isRecording) setValue(e.target.value) }}
          onKeyDown={handleKey}
          placeholder="Écrire un message..."
          disabled={disabled}
          readOnly={isRecording}
          rows={1}
          className="flex-1 min-w-0 bg-[#111111] rounded-xl px-3.5 py-2 text-[13px] font-barlow text-[#e0e0e0] placeholder-[#5a5a5a] outline-none transition-colors disabled:opacity-50 resize-none leading-relaxed"
          style={{ overflowY: "auto", maxHeight: "120px" }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#f2f2f2] text-[#080808] disabled:opacity-30 active:scale-95 transition-all shrink-0"
          aria-label="Envoyer"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}
