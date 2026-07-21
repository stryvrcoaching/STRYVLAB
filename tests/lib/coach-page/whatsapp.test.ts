import { describe, expect, it } from 'vitest'
import { toWhatsAppHref } from '@/lib/coach-page/whatsapp'

describe('toWhatsAppHref', () => {
  it('converts French local mobile to international', () => {
    expect(toWhatsAppHref('06 12 34 56 78')).toBe('https://wa.me/33612345678')
    expect(toWhatsAppHref('0612345678')).toBe('https://wa.me/33612345678')
  })

  it('keeps already international numbers', () => {
    expect(toWhatsAppHref('+33 6 12 34 56 78')).toBe('https://wa.me/33612345678')
    expect(toWhatsAppHref('33612345678')).toBe('https://wa.me/33612345678')
  })

  it('accepts full wa.me URLs', () => {
    expect(toWhatsAppHref('https://wa.me/33612345678')).toBe(
      'https://wa.me/33612345678',
    )
  })

  it('returns null for empty / invalid', () => {
    expect(toWhatsAppHref('')).toBeNull()
    expect(toWhatsAppHref('abc')).toBeNull()
    expect(toWhatsAppHref('123')).toBeNull()
  })
})
