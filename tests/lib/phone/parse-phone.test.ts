import { describe, expect, it } from 'vitest'
import { composeE164, formatE164Plus, parsePhone } from '@/lib/phone/parse-phone'
import { toWhatsAppHref } from '@/lib/coach-page/whatsapp'

describe('parsePhone', () => {
  it('parses Belgian mobile local 04…', () => {
    const p = parsePhone('0470 12 34 56')
    expect(p.countryIso).toBe('BE')
    expect(p.e164Digits).toBe('32470123456')
  })

  it('parses 0032…', () => {
    const p = parsePhone('0032470123456')
    expect(p.countryIso).toBe('BE')
    expect(p.e164Digits).toBe('32470123456')
  })

  it('parses French 06… as FR not BE', () => {
    const p = parsePhone('0612345678')
    expect(p.countryIso).toBe('FR')
    expect(p.e164Digits).toBe('33612345678')
  })

  it('composes E.164 from country + national with trunk 0', () => {
    expect(composeE164('BE', '0470123456')).toBe('32470123456')
    expect(formatE164Plus(composeE164('BE', '470123456'))).toBe('+32470123456')
  })
})

describe('toWhatsAppHref with BE', () => {
  it('builds wa.me for Belgian numbers', () => {
    expect(toWhatsAppHref('0470 12 34 56')).toBe('https://wa.me/32470123456')
    expect(toWhatsAppHref('+32 470 12 34 56')).toBe('https://wa.me/32470123456')
    expect(toWhatsAppHref('0032470123456')).toBe('https://wa.me/32470123456')
  })
})
