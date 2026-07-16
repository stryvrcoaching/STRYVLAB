'use client'

import { useEffect } from 'react'

const LOCK_COUNT_ATTR = 'data-scroll-lock-count'
const PREV_HTML_OVERFLOW_ATTR = 'data-scroll-lock-prev-html-overflow'
const PREV_HTML_OVERSCROLL_ATTR = 'data-scroll-lock-prev-html-overscroll'
const PREV_BODY_OVERFLOW_ATTR = 'data-scroll-lock-prev-body-overflow'
const PREV_BODY_TOUCH_ACTION_ATTR = 'data-scroll-lock-prev-body-touch-action'
const PREV_BODY_OVERSCROLL_ATTR = 'data-scroll-lock-prev-body-overscroll'

function clearScrollLockState() {
  if (typeof document === 'undefined') return

  const html = document.documentElement
  const body = document.body

  body.removeAttribute(LOCK_COUNT_ATTR)
  html.style.overflow = body.getAttribute(PREV_HTML_OVERFLOW_ATTR) ?? ''
  html.style.overscrollBehavior = body.getAttribute(PREV_HTML_OVERSCROLL_ATTR) ?? ''
  body.style.overflow = body.getAttribute(PREV_BODY_OVERFLOW_ATTR) ?? ''
  body.style.touchAction = body.getAttribute(PREV_BODY_TOUCH_ACTION_ATTR) ?? ''
  body.style.overscrollBehavior = body.getAttribute(PREV_BODY_OVERSCROLL_ATTR) ?? ''

  body.removeAttribute(PREV_HTML_OVERFLOW_ATTR)
  body.removeAttribute(PREV_HTML_OVERSCROLL_ATTR)
  body.removeAttribute(PREV_BODY_OVERFLOW_ATTR)
  body.removeAttribute(PREV_BODY_TOUCH_ACTION_ATTR)
  body.removeAttribute(PREV_BODY_OVERSCROLL_ATTR)
}

export function resetBodyScrollLock() {
  clearScrollLockState()
}

export function acquireBodyScrollLock() {
  if (typeof document === 'undefined') return () => {}

  const html = document.documentElement
  const body = document.body
  const currentCount = Number(body.getAttribute(LOCK_COUNT_ATTR) ?? '0')

  if (currentCount === 0) {
    body.setAttribute(PREV_HTML_OVERFLOW_ATTR, html.style.overflow)
    body.setAttribute(PREV_HTML_OVERSCROLL_ATTR, html.style.overscrollBehavior)
    body.setAttribute(PREV_BODY_OVERFLOW_ATTR, body.style.overflow)
    body.setAttribute(PREV_BODY_TOUCH_ACTION_ATTR, body.style.touchAction)
    body.setAttribute(PREV_BODY_OVERSCROLL_ATTR, body.style.overscrollBehavior)

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.touchAction = 'none'
    body.style.overscrollBehavior = 'none'
  }

  body.setAttribute(LOCK_COUNT_ATTR, String(currentCount + 1))

  return () => {
    const nextCount = Math.max(0, Number(body.getAttribute(LOCK_COUNT_ATTR) ?? '1') - 1)

    if (nextCount === 0) {
      clearScrollLockState()
    } else {
      body.setAttribute(LOCK_COUNT_ATTR, String(nextCount))
    }
  }
}

export default function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    return acquireBodyScrollLock()
  }, [locked])
}
