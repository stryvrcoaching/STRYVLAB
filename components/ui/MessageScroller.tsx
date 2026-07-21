"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type MessageScrollerProps = {
  /** A stable representation of the rows currently rendered in the transcript. */
  contentKey: string
  /** The row that begins a newly initiated turn. */
  anchorId?: string | null
  children: ReactNode
  className?: string
  label?: string
  newMessagesLabel?: string
}

const LIVE_EDGE_THRESHOLD = 40

/**
 * Transcript viewport that respects the reader's position.
 *
 * It follows incoming content only while the reader is already at the live
 * edge. A new turn initiated from the composer is instead placed near the top
 * of the viewport, leaving its response room to grow below it.
 */
export default function MessageScroller({
  contentKey,
  anchorId,
  children,
  className,
  label = "Aller aux derniers messages",
  newMessagesLabel = "Nouveaux messages",
}: MessageScrollerProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const previousContentKeyRef = useRef(contentKey)
  const previousAnchorIdRef = useRef(anchorId)
  const followingRef = useRef(true)
  const [following, setFollowing] = useState(true)
  const [hasUnseen, setHasUnseen] = useState(false)

  const isAtLiveEdge = () => {
    const viewport = viewportRef.current
    if (!viewport) return true
    return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= LIVE_EDGE_THRESHOLD
  }

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    const viewport = viewportRef.current
    if (!viewport) return
    const resolvedBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : behavior
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: resolvedBehavior })
    followingRef.current = true
    setFollowing(true)
    setHasUnseen(false)
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    if (!initializedRef.current) {
      initializedRef.current = true
      previousContentKeyRef.current = contentKey
      previousAnchorIdRef.current = anchorId
      viewport.scrollTop = viewport.scrollHeight
      return
    }

    const contentChanged = previousContentKeyRef.current !== contentKey
    const anchorChanged = previousAnchorIdRef.current !== anchorId
    previousContentKeyRef.current = contentKey
    previousAnchorIdRef.current = anchorId
    if (!contentChanged) return

    if (!followingRef.current) {
      setHasUnseen(true)
      return
    }

    if (anchorChanged && anchorId) {
      const anchor = viewport.querySelector<HTMLElement>(`[data-message-scroller-id="${CSS.escape(anchorId)}"]`)
      if (anchor) {
        viewport.scrollTo({
          top: Math.max(0, anchor.offsetTop - viewport.clientHeight * 0.18),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
        return
      }
    }

    scrollToLatest("auto")
  }, [anchorId, contentKey])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      const nextFollowing = isAtLiveEdge()
      followingRef.current = nextFollowing
      setFollowing(nextFollowing)
      if (nextFollowing) setHasUnseen(false)
    }
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={viewportRef}
        data-message-scroller-viewport="true"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation"
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
      >
        {children}
      </div>

      {(!following || hasUnseen) && (
        <button
          type="button"
          onClick={() => scrollToLatest()}
          className="absolute bottom-4 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#181818] px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]"
        >
          <ChevronDown size={14} aria-hidden="true" />
          {hasUnseen ? newMessagesLabel : label}
        </button>
      )}
    </div>
  )
}
