#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-v3-$(date +%Y%m%d-%H%M%S)"

cat > "$FILE" <<'TSX'
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Leaf, Trash2, X } from 'lucide-react'
import CaffeineGlyph from './CaffeineGlyph'
import { DRINK_PRESETS, type DrinkType } from '@/lib/client/nutrition/drinks'

type CaffeineLog = {
  id: string
  amount_ml: number
  caffeine_mg: number
  drink_type: DrinkType
  logged_at: string
}

type QuickCaffeineModalProps = {
  open: boolean
  onClose: () => void
  onLogged?: (caffeineMg: number) => void
  onDeleted?: (caffeineMg: number) => void
  date?: string
}

type CaffeineKind = 'coffee' | 'tea'
type CupSize = 'small' | 'medium' | 'large'
type IntensityLevel = 1 | 2 | 3 | 4 | 5

const SIZE_META: Record<CupSize, {
  label: string
  amountMl: Record<CaffeineKind, number>
}> = {
  small:  { label: 'Petite',  amountMl: { coffee: 60,  tea: 180 } },
  medium: { label: 'Moyenne', amountMl: { coffee: 180, tea: 250 } },
  large:  { label: 'Grande',  amountMl: { coffee: 300, tea: 350 } },
}

const BASE_CAFFEINE_MG: Record<CaffeineKind, Record<CupSize, number>> = {
  coffee: { small: 60, medium: 95, large: 140 },
  tea:    { small: 18, medium: 35, large: 55 },
}

const INTENSITY_META: Record<IntensityLevel, {
  label: string
  multiplier: number
}> = {
  1: { label: 'Très léger', multiplier: 0.6 },
  2: { label: 'Léger', multiplier: 0.8 },
  3: { label: 'Classique', multiplier: 1 },
  4: { label: 'Fort', multiplier: 1.25 },
  5: { label: 'Très fort', multiplier: 1.5 },
}

const KIND_META: Record<CaffeineKind, {
  label: string
  logLabel: string
  accent: string
  drinkType: Extract<DrinkType, 'coffee' | 'tea'>
}> = {
  coffee: {
    label: 'Café',
    logLabel: 'CAFÉ',
    accent: DRINK_PRESETS.coffee.accent,
    drinkType: 'coffee',
  },
  tea: {
    label: 'Thé',
    logLabel: 'THÉ',
    accent: '#28b991',
    drinkType: 'tea',
  },
}

const CUP_SIZES: CupSize[] = ['small', 'medium', 'large']
const INTENSITIES: IntensityLevel[] = [1, 2, 3, 4, 5]

function estimateQuickCaffeineMg(kind: CaffeineKind, size: CupSize, intensity: IntensityLevel): number {
  return Math.max(0, Math.round(BASE_CAFFEINE_MG[kind][size] * INTENSITY_META[intensity].multiplier))
}

function normalizeLogDrinkType(type: DrinkType): CaffeineKind {
  return type === 'tea' ? 'tea' : 'coffee'
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return ''
  }
}

function CoffeeBean({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.8 3.4c3.4 2.1 4.3 7.3 2 11.5-2.3 4.1-6.9 5.8-10.3 3.7-3.4-2.1-4.3-7.3-2-11.5 2.3-4.1 6.9-5.8 10.3-3.7Z"
        fill={active ? color : 'transparent'}
        stroke={active ? color : 'rgba(255,255,255,0.24)'}
        strokeWidth="1.7"
      />
      <path
        d="M14.5 5c-1.8 2.2-1 4.4.2 6.3 1.2 2 1.6 3.9-.2 6.2"
        fill="none"
        stroke={active ? '#0d0d0d' : 'rgba(255,255,255,0.24)'}
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TeaLeaf({ active, color }: { active: boolean; color: string }) {
  return (
    <Leaf
      size={18}
      strokeWidth={2}
      style={{ color: active ? color : 'rgba(255,255,255,0.24)' }}
    />
  )
}

function DoseCup({
  size,
  kind,
  active,
  color,
}: {
  size: CupSize
  kind: CaffeineKind
  active: boolean
  color: string
}) {
  const stroke = active ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.22)'
  const liquid = active ? color : 'rgba(255,255,255,0.16)'
  const softLiquid = active ? `${color}dd` : 'rgba(255,255,255,0.12)'

  if (size === 'small') {
    return (
      <svg viewBox="0 0 72 54" className="mx-auto h-[50px] w-[66px]" aria-hidden="true">
        <path d="M18 40h30" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M20 19h28l-2.3 17.5A5 5 0 0 1 40.8 41H27.2a5 5 0 0 1-4.9-4.5L20 19Z"
          fill="rgba(255,255,255,0.035)"
          stroke={stroke}
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <path
          d="M48 23h4.2c4.2 0 6.2 2.2 5.6 5.5-.6 3.1-3.2 4.8-7.3 4.8H47"
          fill="none"
          stroke={stroke}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M23 30.5c7 2.2 14 2.2 21 0v5.3a3.7 3.7 0 0 1-3.7 3.5H27a3.7 3.7 0 0 1-3.7-3.5Z"
          fill={liquid}
        />
        {kind === 'coffee' && active && (
          <path d="M27 17c.8-2.1-.9-3.1 0-5.1M34 17c.8-2.1-.9-3.1 0-5.1M41 17c.8-2.1-.9-3.1 0-5.1" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
        )}
      </svg>
    )
  }

  if (size === 'medium') {
    return (
      <svg viewBox="0 0 76 60" className="mx-auto h-[54px] w-[70px]" aria-hidden="true">
        <path
          d="M19 16h34l-3 28.5A5.5 5.5 0 0 1 44.5 50h-17a5.5 5.5 0 0 1-5.5-5.5L19 16Z"
          fill="rgba(255,255,255,0.035)"
          stroke={stroke}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M53 23h5c5 0 7.6 3 6.7 7.4-.8 4.1-4.2 6.4-9.1 6.4H51.8"
          fill="none"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M22 29c8.5 2.2 18.5 2.2 28 0v13.2a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5Z"
          fill={liquid}
        />
        <path d="M22 29c8.5 2.2 18.5 2.2 28 0" stroke="rgba(255,255,255,0.34)" strokeWidth="1.6" strokeLinecap="round" />
        {kind === 'coffee' && active && (
          <path d="M28 13c1-2.5-1-3.6 0-6M36 13c1-2.5-1-3.6 0-6M44 13c1-2.5-1-3.6 0-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".75" />
        )}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 78 64" className="mx-auto h-[58px] w-[72px]" aria-hidden="true">
      <path
        d="M20 13h36l-3.4 36.2a6 6 0 0 1-6 5.4H29.4a6 6 0 0 1-6-5.4L20 13Z"
        fill="rgba(255,255,255,0.035)"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M56 22h5.2c5.4 0 8.2 3.2 7.3 8.3-.9 4.7-4.4 7.4-9.8 7.4H54.7"
        fill="none"
        stroke={stroke}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M23.5 28.5c8.5 2.4 20 2.4 29 0v19a5 5 0 0 1-5 5h-19a5 5 0 0 1-5-5Z"
        fill={softLiquid}
      />
      <path d="M23.5 28.5c8.5 2.4 20 2.4 29 0" stroke="rgba(255,255,255,0.32)" strokeWidth="1.7" strokeLinecap="round" />
      {kind === 'coffee' && active && (
        <path d="M29 10c1-2.5-1-3.6 0-6M38 10c1-2.5-1-3.6 0-6M47 10c1-2.5-1-3.6 0-6" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      )}
    </svg>
  )
}

export default function QuickCaffeineModal({
  open,
  onClose,
  onLogged,
  onDeleted,
  date,
}: QuickCaffeineModalProps) {
  const [logs, setLogs] = useState<CaffeineLog[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const [kind, setKind] = useState<CaffeineKind>('coffee')
  const [size, setSize] = useState<CupSize>('medium')
  const [intensity, setIntensity] = useState<IntensityLevel>(3)

  const meta = KIND_META[kind]
  const amountMl = SIZE_META[size].amountMl[kind]
  const caffeineMg = useMemo(() => estimateQuickCaffeineMg(kind, size, intensity), [kind, size, intensity])
  const totalMl = logs.reduce((s, l) => s + Number(l.amount_ml ?? 0), 0)
  const totalMg = logs.reduce((s, l) => s + Number(l.caffeine_mg ?? 0), 0)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ kind: 'caffeine' })
    if (date) params.set('date', date)

    fetch(`/api/client/water?${params.toString()}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!cancelled) setLogs((json?.data ?? []) as CaffeineLog[])
      })
      .catch(() => {
        if (!cancelled) setLogs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, date])

  useEffect(() => {
    if (!open) return
    setDone(false)
  }, [kind, size, intensity, open])

  if (!open) return null

  async function logDrink() {
    if (saving) return

    setSaving(true)
    setDone(false)

    try {
      const body: Record<string, unknown> = {
        amount_ml: amountMl,
        drink_type: meta.drinkType,
        caffeine_mg: caffeineMg,
      }
      if (date) body.date = date

      const res = await fetch('/api/client/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'Erreur log caféine')

      const nextLog = json?.data as CaffeineLog | undefined
      setLogs(prev => [
        nextLog?.id
          ? nextLog
          : {
              id: `tmp-${Date.now()}`,
              amount_ml: amountMl,
              caffeine_mg: caffeineMg,
              drink_type: meta.drinkType,
              logged_at: new Date().toISOString(),
            },
        ...prev,
      ])

      onLogged?.(caffeineMg)
      setDone(true)
      window.setTimeout(() => setDone(false), 1200)
    } catch (err) {
      console.error('[QuickCaffeineModal] logDrink failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function deleteLog(log: CaffeineLog) {
    if (deletingId) return

    setDeletingId(log.id)
    try {
      const res = await fetch(`/api/client/water/${log.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setLogs(prev => prev.filter(entry => entry.id !== log.id))
      onDeleted?.(Number(log.caffeine_mg ?? 0))
    } catch (err) {
      console.error('[QuickCaffeineModal] deleteLog failed', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="fixed left-0 right-0 bottom-0 z-[70] rounded-t-[28px] bg-[#0d0d0d] shadow-2xl"
        style={{
          maxHeight: '88vh',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/10" />

        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <h2 className="font-barlow-condensed text-[26px] font-black uppercase tracking-[0.12em] text-white">
            Café & thé
          </h2>

          <button
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-white/45 active:scale-95 transition-all"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-90px)] overflow-y-auto px-5 pb-5">
          <div className="pb-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-barlow-condensed text-[14px] font-bold uppercase tracking-[0.20em] text-white/32">
                Aujourd’hui
              </p>
              <p className="text-[14px] font-black tabular-nums" style={{ color: meta.accent }}>
                {totalMg} mg total
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-4">
                <p className="text-[13px] text-white/35">Chargement...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-4">
                <p className="text-[13px] text-white/32">Aucun café ou thé logué aujourd’hui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => {
                  const logKind = normalizeLogDrinkType(log.drink_type)
                  const logMeta = KIND_META[logKind]
                  const label = DRINK_PRESETS[log.drink_type]?.label ?? logMeta.label

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-3"
                    >
                      <CaffeineGlyph
                        drinkType={log.drink_type}
                        active={false}
                        size="sm"
                        color={logMeta.accent}
                        className="shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-black text-white">
                          {log.caffeine_mg} mg
                          <span className="ml-2 text-[12px] font-semibold text-white/28">{formatTime(log.logged_at)}</span>
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-white/28">
                          {label} · {log.amount_ml} ml
                        </p>
                      </div>

                      <button
                        onClick={() => deleteLog(log)}
                        disabled={deletingId === log.id}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-white/35 active:scale-95 transition-all disabled:opacity-40"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-white/[0.07]" />

          <div className="pt-5">
            <div className="grid grid-cols-2 gap-2">
              {(['coffee', 'tea'] as CaffeineKind[]).map(nextKind => {
                const item = KIND_META[nextKind]
                const active = kind === nextKind
                return (
                  <button
                    key={nextKind}
                    onClick={() => setKind(nextKind)}
                    className={`h-12 rounded-2xl border px-4 text-left active:scale-[0.98] transition-all ${
                      active
                        ? 'bg-white/[0.065] text-white'
                        : 'bg-white/[0.035] text-white/38 border-white/[0.05]'
                    }`}
                    style={active ? { borderColor: `${item.accent}70` } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-barlow-condensed text-[16px] font-black uppercase tracking-[0.18em]"
                        style={active ? { color: item.accent } : undefined}
                      >
                        {item.label}
                      </span>
                      {nextKind === 'coffee' ? (
                        <Coffee size={17} style={{ color: active ? item.accent : 'rgba(255,255,255,0.28)' }} />
                      ) : (
                        <Leaf size={17} style={{ color: active ? item.accent : 'rgba(255,255,255,0.28)' }} />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-barlow-condensed text-[14px] font-black uppercase tracking-[0.18em] text-white/32">
                  Taille
                </p>
                <p className="font-barlow-condensed text-[14px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>
                  {SIZE_META[size].label} · {amountMl} ml
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CUP_SIZES.map(cupSize => {
                  const active = size === cupSize
                  return (
                    <button
                      key={cupSize}
                      onClick={() => setSize(cupSize)}
                      className={`rounded-2xl border px-2 py-4 active:scale-[0.97] transition-all ${
                        active
                          ? 'bg-white/[0.06]'
                          : 'bg-[#090909] border-white/[0.045]'
                      }`}
                      style={active ? { borderColor: `${meta.accent}70` } : undefined}
                    >
                      <DoseCup
                        size={cupSize}
                        kind={kind}
                        active={active}
                        color={meta.accent}
                      />
                      <p className={`mt-3 text-center font-barlow-condensed text-[15px] font-black uppercase tracking-[0.13em] ${active ? 'text-white' : 'text-white/34'}`}>
                        {SIZE_META[cupSize].label}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-barlow-condensed text-[14px] font-black uppercase tracking-[0.18em] text-white/32">
                  Intensité
                </p>
                <p className="font-barlow-condensed text-[14px] font-black uppercase tracking-[0.16em]" style={{ color: meta.accent }}>
                  {INTENSITY_META[intensity].label}
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {INTENSITIES.map(level => {
                  const active = level <= intensity
                  const selected = level === intensity
                  return (
                    <button
                      key={level}
                      onClick={() => setIntensity(level)}
                      className={`flex h-11 items-center justify-center rounded-2xl border active:scale-[0.96] transition-all ${
                        selected
                          ? 'bg-white/[0.06]'
                          : 'bg-[#090909] border-white/[0.045]'
                      }`}
                      style={selected ? { borderColor: `${meta.accent}70` } : undefined}
                      aria-label={`Intensité ${level}`}
                    >
                      {kind === 'coffee' ? (
                        <CoffeeBean active={active} color={meta.accent} />
                      ) : (
                        <TeaLeaf active={active} color={meta.accent} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.035] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-barlow-condensed text-[14px] font-black uppercase tracking-[0.18em] text-white/32">
                    Charge active
                  </p>
                  <p className="mt-2 text-[15px] text-white/56">
                    {KIND_META[kind].label} · {SIZE_META[size].label.toLowerCase()} · {INTENSITY_META[intensity].label.toLowerCase()}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[34px] font-black tabular-nums leading-none" style={{ color: meta.accent }}>
                    {caffeineMg}
                  </p>
                  <p className="mt-1 font-barlow-condensed text-[13px] font-black uppercase tracking-[0.16em] text-white/44">
                    mg
                  </p>
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.075]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((caffeineMg / 220) * 100))}%`,
                    background: meta.accent,
                  }}
                />
              </div>
            </div>

            <button
              onClick={logDrink}
              disabled={saving}
              className="mt-4 h-14 w-full rounded-2xl font-barlow-condensed text-[16px] font-black uppercase tracking-[0.20em] active:scale-[0.98] transition-all disabled:opacity-50"
              style={
                done
                  ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
                  : { background: meta.accent, color: '#080808' }
              }
            >
              {done ? 'Boisson loguée' : saving ? 'Enregistrement...' : `Loguer ${meta.logLabel}`}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
TSX

echo "✅ QuickCaffeineModal V3 appliqué."
echo ""
echo "Contrôle TypeScript rapide :"
npx tsc --noEmit --pretty false || true
