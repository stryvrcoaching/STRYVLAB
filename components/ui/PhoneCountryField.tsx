'use client';

import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_PHONE_COUNTRY_ISO,
  PHONE_COUNTRIES,
  findPhoneCountry,
} from '@/lib/phone/country-codes'
import {
  composeE164,
  formatE164Plus,
  parsePhone,
} from '@/lib/phone/parse-phone'
import { cn } from '@/lib/utils'

type Props = {
  value: string | null | undefined
  onChange: (e164Plus: string | null) => void
  /** Default country when value is empty */
  defaultCountryIso?: string
  label?: string
  hint?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Visual variant for coach settings (tailwind) vs inline styles (builder) */
  variant?: 'coach' | 'builder'
  id?: string
}

/**
 * Country dial selector + national number.
 * Emits E.164 with leading + (e.g. +32470123456) or null if empty.
 */
export function PhoneCountryField({
  value,
  onChange,
  defaultCountryIso = DEFAULT_PHONE_COUNTRY_ISO,
  label,
  hint,
  placeholder = '470 12 34 56',
  disabled,
  className,
  variant = 'coach',
  id,
}: Props) {
  const initial = useMemo(
    () => parsePhone(value, defaultCountryIso),
    // only seed from external value when mounting / value cleared externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [countryIso, setCountryIso] = useState(initial.countryIso)
  const [national, setNational] = useState(initial.nationalDisplay)

  // Sync when parent value changes (e.g. load profile)
  useEffect(() => {
    const parsed = parsePhone(value, defaultCountryIso)
    if (!value?.trim()) {
      setNational('')
      setCountryIso(defaultCountryIso)
      return
    }
    setCountryIso(parsed.countryIso)
    setNational(parsed.nationalDisplay)
  }, [value, defaultCountryIso])

  const emit = (iso: string, nat: string) => {
    const e164 = composeE164(iso, nat)
    onChange(e164 ? formatE164Plus(e164) : null)
  }

  const country = findPhoneCountry(countryIso)
  const preview = composeE164(countryIso, national)
  const previewPlus = preview ? formatE164Plus(preview) : ''

  if (variant === 'builder') {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && (
          <label
            htmlFor={id}
            style={{
              display: 'block',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 2,
            }}
          >
            {label}
          </label>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            aria-label="Indicatif pays"
            disabled={disabled}
            value={countryIso}
            onChange={(e) => {
              const iso = e.target.value
              setCountryIso(iso)
              emit(iso, national)
            }}
            style={{
              width: 118,
              flexShrink: 0,
              background: '#0a0a0a',
              border: '0.3px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '9px 8px',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.iso} +{c.dial}
              </option>
            ))}
          </select>
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            disabled={disabled}
            value={national}
            placeholder={placeholder}
            onChange={(e) => {
              const nat = e.target.value
              setNational(nat)
              emit(countryIso, nat)
            }}
            style={{
              flex: 1,
              minWidth: 0,
              background: '#0a0a0a',
              border: '0.3px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '9px 12px',
              color: '#ffffff',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.4 }}>
          {hint ??
            `${country.name} · indicatif +${country.dial}${
              previewPlus ? ` · enregistré ${previewPlus}` : ''
            }`}
        </p>
      </div>
    )
  }

  // Coach settings / dashboard variant
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          aria-label="Indicatif pays"
          disabled={disabled}
          value={countryIso}
          onChange={(e) => {
            const iso = e.target.value
            setCountryIso(iso)
            emit(iso, national)
          }}
          className="h-[52px] w-[118px] shrink-0 rounded-xl bg-[#0a0a0a] px-2 text-[12px] font-semibold text-white outline-none border-[0.3px] border-white/[0.06]"
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.iso} +{c.dial}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          placeholder={placeholder}
          onChange={(e) => {
            const nat = e.target.value
            setNational(nat)
            emit(countryIso, nat)
          }}
          className="h-[52px] min-w-0 flex-1 rounded-xl bg-[#0a0a0a] px-4 text-[14px] font-medium text-white outline-none placeholder:text-white/20 border-[0.3px] border-white/[0.06]"
        />
      </div>
      <p className="text-[11px] text-white/40">
        {hint ??
          `${country.name} (+${country.dial})${
            previewPlus ? ` · ${previewPlus}` : ' · ex. 470 12 34 56'
          }`}
      </p>
    </div>
  )
}
