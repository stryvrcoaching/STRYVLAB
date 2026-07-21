/**
 * Build a valid WhatsApp deep link from free-form coach input.
 * Accepts: +32 470…, 0032…, 0470… (BE), 06… (FR), wa.me/…, full https URL.
 */

import { digitsOnly, parsePhone } from '@/lib/phone/parse-phone'
import { DEFAULT_PHONE_COUNTRY_ISO } from '@/lib/phone/country-codes'

export function toWhatsAppHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  // Already a WhatsApp / tel URL
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(trimmed)) {
    return trimmed
  }
  if (trimmed.toLowerCase().startsWith('whatsapp://')) {
    return trimmed
  }

  // Prefer structured parse (handles BE/FR trunk + 00xx)
  const parsed = parsePhone(trimmed, DEFAULT_PHONE_COUNTRY_ISO)
  let digits = parsed.e164Digits || digitsOnly(trimmed)

  if (!digits) return null

  // Legacy FR local: 0XXXXXXXXX when parse fell back oddly
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = `33${digits.slice(1)}`
  }

  // Double trunk after +33 0…
  if (digits.startsWith('330') && digits.length === 12) {
    digits = `33${digits.slice(3)}`
  }
  // Same for BE +32 0…
  if (digits.startsWith('320') && digits.length === 12) {
    digits = `32${digits.slice(3)}`
  }

  if (digits.length < 10 || digits.length > 15) return null

  return `https://wa.me/${digits}`
}
