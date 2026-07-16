import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireBodyScrollLock, resetBodyScrollLock } from '@/components/client/useBodyScrollLock'

type FakeBody = {
  style: Record<string, string>
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

function createFakeElement(): FakeBody {
  const attributes = new Map<string, string>()

  return {
    style: {},
    getAttribute(name: string) {
      return attributes.has(name) ? attributes.get(name)! : null
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    },
  }
}

function installFakeDom(scrollX: number, scrollY: number) {
  const html = createFakeElement()
  const body = createFakeElement()
  const scrollTo = vi.fn((x: number, y: number) => {
    ;(globalThis as any).window.scrollX = x
    ;(globalThis as any).window.scrollY = y
  })

  ;(globalThis as any).document = {
    documentElement: html,
    body,
  }

  ;(globalThis as any).window = {
    scrollX,
    scrollY,
    scrollTo,
  }

  return { html, body, scrollTo }
}

describe('useBodyScrollLock internals', () => {
  afterEach(() => {
    delete (globalThis as any).document
    delete (globalThis as any).window
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    installFakeDom(0, 0)
  })

  it('locks scrolling without moving the body or fixed sheets', () => {
    const { body, scrollTo } = installFakeDom(18, 642)

    const release = acquireBodyScrollLock()

    expect(body.style.overflow).toBe('hidden')
    expect(body.style.position).toBeUndefined()
    expect(body.style.top).toBeUndefined()
    expect(body.style.left).toBeUndefined()
    expect(body.style.width).toBeUndefined()

    release()

    expect(scrollTo).not.toHaveBeenCalled()
    expect((globalThis as any).window.scrollX).toBe(18)
    expect((globalThis as any).window.scrollY).toBe(642)
    expect(body.style.overflow).toBe('')
  })

  it('waits for the last active lock before restoring overflow', () => {
    const { body, scrollTo } = installFakeDom(12, 320)
    body.style.overflow = 'auto'

    const releaseFirst = acquireBodyScrollLock()
    const releaseSecond = acquireBodyScrollLock()

    expect(body.getAttribute('data-scroll-lock-count')).toBe('2')

    releaseFirst()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(body.style.overflow).toBe('hidden')
    expect(body.getAttribute('data-scroll-lock-count')).toBe('1')

    releaseSecond()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(body.style.overflow).toBe('auto')
    expect(body.getAttribute('data-scroll-lock-count')).toBeNull()
  })

  it('reset clears any stale lock state immediately', () => {
    const { body, scrollTo } = installFakeDom(5, 120)

    acquireBodyScrollLock()
    resetBodyScrollLock()

    expect(scrollTo).not.toHaveBeenCalled()
    expect(body.getAttribute('data-scroll-lock-count')).toBeNull()
    expect(body.style.overflow).toBe('')
  })
})
