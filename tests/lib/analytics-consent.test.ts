import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readAnalyticsConsent,
  resetAnalyticsConsent,
  setAnalyticsConsent,
} from '@/lib/analytics/browser'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  }
}

describe('analytics consent', () => {
  const localStorage = storage()
  const sessionStorage = storage()

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.removeItem('stryv.analytics.consent')
    localStorage.removeItem('stryv.analytics.anonymous_id')
    localStorage.removeItem('stryv.analytics.attribution')
    sessionStorage.removeItem('stryv.analytics.session_id')
    vi.stubGlobal('window', { localStorage, sessionStorage })
  })

  it('stores a dated consent decision', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)

    setAnalyticsConsent('granted')

    expect(readAnalyticsConsent()).toBe('granted')
  })

  it('expires consent and removes analytics identifiers after six months', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    setAnalyticsConsent('granted')
    localStorage.setItem('stryv.analytics.anonymous_id', 'anonymous')
    localStorage.setItem('stryv.analytics.attribution', '{}')
    sessionStorage.setItem('stryv.analytics.session_id', 'session')

    vi.spyOn(Date, 'now').mockReturnValue(1_000 + 184 * 24 * 60 * 60 * 1000)

    expect(readAnalyticsConsent()).toBeNull()
    expect(localStorage.getItem('stryv.analytics.anonymous_id')).toBeNull()
    expect(localStorage.getItem('stryv.analytics.attribution')).toBeNull()
    expect(sessionStorage.getItem('stryv.analytics.session_id')).toBeNull()
  })

  it('resets the decision and all analytics storage', () => {
    setAnalyticsConsent('denied')
    localStorage.setItem('stryv.analytics.anonymous_id', 'anonymous')

    resetAnalyticsConsent()

    expect(readAnalyticsConsent()).toBeNull()
    expect(localStorage.getItem('stryv.analytics.anonymous_id')).toBeNull()
  })
})
