#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-v2-$(date +%Y%m%d-%H%M%S)"

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
  cupScale: number
  fillRatio: number
}> = {
  small:  { label: 'Petite',  amountMl: { coffee: 90,  tea: 180 }, cupScale: 0.84, fillRatio: 0.46 },
  medium: { label: 'Moyenne', amountMl: { coffee: 180, tea: 250 }, cupScale: 1.00, fillRatio: 0.62 },
  large:  { label: 'Grande',  amountMl: { coffee: 300, tea: 350 }, cupScale: 1.12, fillRatio: 0.76 },
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
    accent: DRINK_PRESETS.tea.accent,
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
        d="M15.9 3.5c3.4 2.1 4.4 7.3 2.1 11.4-2.3 4.2-7 5.8-10.4 3.7-3.4-2.1-4.4-7.3-2.1-11.4 2.3-4.2 7-5.8 10.4-3.7Z"
        fill={active ? color : 'transparent'}
        stroke={active ? color : 'rgba(255,255,255,0.24)'}
        strokeWidth="1.7"
      />
      <path
        d="M14.6 4.9c-1.8 2.2-1.1 4.5.2 6.5 1.2 1.9 1.7 3.8-.1 6.1"
        fill="none"
        stroke={active ? '#0d0d0d' : 'rgba(255,255,255,0.22)'}
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

function MugIcon({
  active,
  color,
  fillRatio,
  scale,
  kind,
}: {
  active: boolean
  color: string
  fillRatio: number
  scale: number
  kind: CaffeineKind
}) {
  const liquidHeight = Math.round(30 * fillRatio)
  const liquidY = 40 - liquidHeight
  const liquidColor = active ? color : 'rgba(255,255,255,0.14)'
  const strokeColor = active ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)'

  return (
    <svg
      viewBox="0 0 64 56"
      className="mx-auto block"
      style={{ width: 58 * scale, height: 52 * scale }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`cup-liquid-${kind}-${scale}`}>
          <path d="M15 15h32l-3.4 29.5A5 5 0 0 1 38.7 49H23.3a5 5 0 0 1-4.9-4.5L15 15Z" />
        </clipPath>
      </defs>

      <path
        d="M47 20h4.5c5.3 0 8.1 3.2 7.2 8.3-.8 4.7-4.4 7.4-9.6 7.4h-3.6"
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
      />

      <path
        d="M15 15h32l-3.4 29.5A5 5 0 0 1 38.7 49H23.3a5 5 0 0 1-4.9-4.5L15 15Z"
        fill="rgba(255,255,255,0.035)"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      <g clipPath={`url(#cup-liquid-${kind}-${scale})`}>
        <rect x="13" y={liquidY} width="36" height={liquidHeight + 12} rx="5" fill={liquidColor} />
        <path
          d={`M14 ${liquidY + 2}c6-2 10 2 16 0s10-2 17 0`}
          fill="none"
          stroke={active ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.12)'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M20 10h22"
        stroke={active ? color : 'rgba(255,255,255,0.22)'}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
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
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl bg-[#0d0d0d] shadow-2xl"
        style={{
          maxHeight: '88vh',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/10" />

        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <p className="text-[18px] font-black tracking-[-0.03em] text-white">
              Café & thé
            </p>
            <p className="mt-0.5 text-[12px] text-white/38">
              Dose rapide · caféine estimée
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/45 active:scale-95 transition-all"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-76px)] overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {(['coffee', 'tea'] as CaffeineKind[]).map(nextKind => {
              const item = KIND_META[nextKind]
              const active = kind === nextKind
              return (
                <button
                  key={nextKind}
                  onClick={() => setKind(nextKind)}
                  className={`h-12 rounded-2xl border px-3 text-left active:scale-[0.98] transition-all ${
                    active
                      ? 'bg-white/[0.06] text-white'
                      : 'bg-white/[0.035] text-white/36 border-white/[0.05]'
                  }`}
                  style={active ? { borderColor: `${item.accent}70` } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.16em]"
                      style={active ? { color: item.accent } : undefined}
                    >
                      {item.label}
                    </span>
                    {nextKind === 'coffee' ? (
                      <Coffee size={16} style={{ color: active ? item.accent : 'rgba(255,255,255,0.28)' }} />
                    ) : (
                      <Leaf size={16} style={{ color: active ? item.accent : 'rgba(255,255,255,0.28)' }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-3 rounded-2xl bg-white/[0.035] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                Taille
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
                {SIZE_META[size].label} · {amountMl} ml
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {CUP_SIZES.map(cupSize => {
                const active = size === cupSize
                const cup = SIZE_META[cupSize]
                return (
                  <button
                    key={cupSize}
                    onClick={() => setSize(cupSize)}
                    className={`rounded-2xl border px-2 py-3 active:scale-[0.97] transition-all ${
                      active
                        ? 'bg-white/[0.055]'
                        : 'bg-[#0a0a0a] border-white/[0.045]'
                    }`}
                    style={active ? { borderColor: `${meta.accent}70` } : undefined}
                  >
                    <MugIcon
                      active={active}
                      color={meta.accent}
                      fillRatio={cup.fillRatio}
                      scale={cup.cupScale}
                      kind={kind}
                    />
                    <p className={`mt-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] ${active ? 'text-white' : 'text-white/32'}`}>
                      {cup.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-white/[0.035] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                Intensité
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
                {INTENSITY_META[intensity].label}
              </p>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {INTENSITIES.map(level => {
                const active = level <= intensity
                const selected = level === intensity
                return (
                  <button
                    key={level}
                    onClick={() => setIntensity(level)}
                    className={`flex h-11 items-center justify-center rounded-2xl border active:scale-[0.96] transition-all ${
                      selected
                        ? 'bg-white/[0.055]'
                        : 'bg-[#0a0a0a] border-white/[0.045]'
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

          <div className="mt-3 rounded-2xl bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                  Charge active
                </p>
                <p className="mt-1 text-[12px] text-white/42">
                  {KIND_META[kind].label} · {SIZE_META[size].label.toLowerCase()} · {INTENSITY_META[intensity].label.toLowerCase()}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[25px] font-black tabular-nums leading-none" style={{ color: meta.accent }}>
                  {caffeineMg}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">
                  mg
                </p>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
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
            className="mt-3 h-12 w-full rounded-2xl text-[12px] font-barlow-condensed font-black uppercase tracking-[0.16em] active:scale-[0.98] transition-all disabled:opacity-50"
            style={
              done
                ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
                : { background: meta.accent, color: '#080808' }
            }
          >
            {done ? 'Boisson loguée' : saving ? 'Enregistrement...' : `Loguer ${meta.logLabel}`}
          </button>

          <div className="mt-3 rounded-2xl bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                Aujourd’hui
              </p>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: meta.accent }}>
                {totalMg}mg · {totalMl}ml
              </p>
            </div>

            {loading ? (
              <p className="py-3 text-center text-[12px] text-white/35">Chargement...</p>
            ) : logs.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-white/35">
                Aucun café ou thé logué aujourd’hui.
              </p>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 5).map(log => {
                  const logKind = normalizeLogDrinkType(log.drink_type)
                  const logMeta = KIND_META[logKind]
                  const label = DRINK_PRESETS[log.drink_type]?.label ?? logMeta.label

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 rounded-2xl bg-[#0a0a0a] px-3 py-2"
                    >
                      <CaffeineGlyph
                        drinkType={log.drink_type}
                        active={false}
                        size="sm"
                        color={logMeta.accent}
                        className="shrink-0"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-bold text-white">
                          {label} · {log.caffeine_mg}mg
                        </p>
                        <p className="text-[10px] text-white/25">
                          {log.amount_ml}ml · {formatTime(log.logged_at)}
                        </p>
                      </div>

                      <button
                        onClick={() => deleteLog(log)}
                        disabled={deletingId === log.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.055] text-white/35 active:scale-95 transition-all disabled:opacity-40"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
TSX

echo "✅ QuickCaffeineModal V2 appliqué."
echo ""
echo "Contrôle TypeScript rapide :"
npx tsc --noEmit --pretty false || true
