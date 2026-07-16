#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-$(date +%Y%m%d-%H%M%S)"

cat > "$FILE" <<'TSX'
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Leaf, X, Trash2 } from 'lucide-react'
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
  shortLabel: string
  amountMl: Record<CaffeineKind, number>
}> = {
  small: {
    label: 'Petite',
    shortLabel: 'S',
    amountMl: { coffee: 90, tea: 180 },
  },
  medium: {
    label: 'Moyenne',
    shortLabel: 'M',
    amountMl: { coffee: 180, tea: 250 },
  },
  large: {
    label: 'Grande',
    shortLabel: 'L',
    amountMl: { coffee: 300, tea: 350 },
  },
}

const BASE_CAFFEINE_MG: Record<CaffeineKind, Record<CupSize, number>> = {
  coffee: {
    small: 60,
    medium: 95,
    large: 140,
  },
  tea: {
    small: 18,
    medium: 35,
    large: 55,
  },
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
  icon: typeof Coffee
  drinkType: Extract<DrinkType, 'coffee' | 'tea'>
}> = {
  coffee: {
    label: 'Café',
    logLabel: 'CAFÉ',
    accent: DRINK_PRESETS.coffee.accent,
    icon: Coffee,
    drinkType: 'coffee',
  },
  tea: {
    label: 'Thé',
    logLabel: 'THÉ',
    accent: DRINK_PRESETS.tea.accent,
    icon: Leaf,
    drinkType: 'tea',
  },
}

const INTENSITY_LEVELS: IntensityLevel[] = [1, 2, 3, 4, 5]
const CUP_SIZES: CupSize[] = ['small', 'medium', 'large']

function estimateQuickCaffeineMg(kind: CaffeineKind, size: CupSize, intensity: IntensityLevel): number {
  return Math.max(0, Math.round(BASE_CAFFEINE_MG[kind][size] * INTENSITY_META[intensity].multiplier))
}

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

function normalizeLogDrinkType(type: DrinkType): CaffeineKind {
  return type === 'tea' ? 'tea' : 'coffee'
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
  const Icon = meta.icon
  const amountMl = SIZE_META[size].amountMl[kind]
  const caffeineMg = useMemo(
    () => estimateQuickCaffeineMg(kind, size, intensity),
    [kind, size, intensity],
  )

  const totalMl = logs.reduce((sum, log) => sum + Number(log.amount_ml ?? 0), 0)
  const totalMg = logs.reduce((sum, log) => sum + Number(log.caffeine_mg ?? 0), 0)
  const activeLabel = INTENSITY_META[intensity].label

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ kind: 'caffeine' })
    if (date) params.set('date', date)

    fetch(`/api/client/water?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        setLogs((json?.data ?? []) as CaffeineLog[])
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

      if (!res.ok) {
        throw new Error(json?.error ?? 'Erreur log caféine')
      }

      const nextLog = json?.data as CaffeineLog | undefined
      if (nextLog?.id) {
        setLogs((prev) => [nextLog, ...prev])
      } else {
        setLogs((prev) => [
          {
            id: `tmp-${Date.now()}`,
            amount_ml: amountMl,
            caffeine_mg: caffeineMg,
            drink_type: meta.drinkType,
            logged_at: new Date().toISOString(),
          },
          ...prev,
        ])
      }

      onLogged?.(caffeineMg)
      setDone(true)
      window.setTimeout(() => setDone(false), 1300)
    } catch (error) {
      console.error('[QuickCaffeineModal] logDrink failed', error)
    } finally {
      setSaving(false)
    }
  }

  async function deleteLog(log: CaffeineLog) {
    if (deletingId) return
    setDeletingId(log.id)

    try {
      const res = await fetch(`/api/client/water/${log.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('delete failed')
      }

      setLogs((prev) => prev.filter((entry) => entry.id !== log.id))
      onDeleted?.(Number(log.caffeine_mg ?? 0))
    } catch (error) {
      console.error('[QuickCaffeineModal] deleteLog failed', error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-[#101010] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/35">
              Café & thé
            </p>
            <p className="mt-0.5 text-[12px] text-white/55">
              Log rapide · impact sommeil/récupération
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/55 active:scale-95 transition"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[78dvh] overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {(['coffee', 'tea'] as CaffeineKind[]).map((nextKind) => {
              const item = KIND_META[nextKind]
              const ItemIcon = item.icon
              const active = kind === nextKind

              return (
                <button
                  key={nextKind}
                  onClick={() => setKind(nextKind)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.12em] transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-white/[0.08] text-white'
                      : 'bg-white/[0.03] text-white/35 border-white/[0.05]'
                  }`}
                  style={active ? { borderColor: `${item.accent}66`, color: item.accent } : undefined}
                >
                  <ItemIcon size={16} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-[24px] bg-white/[0.035] px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                Taille
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
                {SIZE_META[size].label} · ≈ {amountMl} ml
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {CUP_SIZES.map((cupSize, index) => {
                const selected = size === cupSize
                const cupScale = index === 0 ? 'scale-[0.82]' : index === 1 ? 'scale-95' : 'scale-110'
                const fillHeight = index === 0 ? '38%' : index === 1 ? '58%' : '78%'

                return (
                  <button
                    key={cupSize}
                    onClick={() => setSize(cupSize)}
                    className={`rounded-2xl border px-2 py-3 transition-all active:scale-[0.97] ${
                      selected
                        ? 'bg-white/[0.08]'
                        : 'bg-black/10 border-white/[0.04]'
                    }`}
                    style={selected ? { borderColor: `${meta.accent}70` } : undefined}
                  >
                    <div className={`mx-auto flex h-11 w-11 items-end justify-center rounded-b-2xl rounded-t-lg border border-white/25 p-1 ${cupScale}`}>
                      <div
                        className="w-full rounded-b-xl rounded-t-sm transition-all duration-300"
                        style={{
                          height: selected ? fillHeight : '18%',
                          background: selected ? meta.accent : 'rgba(255,255,255,0.16)',
                        }}
                      />
                    </div>
                    <p className={`mt-2 text-[10px] font-bold uppercase tracking-[0.1em] ${selected ? 'text-white' : 'text-white/35'}`}>
                      {SIZE_META[cupSize].label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 rounded-[24px] bg-white/[0.035] px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                Intensité
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: meta.accent }}>
                {activeLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              {INTENSITY_LEVELS.map((level) => {
                const active = level <= intensity
                const selected = level === intensity

                return (
                  <button
                    key={level}
                    onClick={() => setIntensity(level)}
                    className={`flex h-11 flex-1 items-center justify-center rounded-2xl border transition-all active:scale-[0.96] ${
                      selected
                        ? 'bg-white/[0.08]'
                        : 'bg-black/10 border-white/[0.04]'
                    }`}
                    style={selected ? { borderColor: `${meta.accent}70` } : undefined}
                    aria-label={`Intensité ${level}`}
                  >
                    {kind === 'coffee' ? (
                      <span
                        className="h-3.5 w-3.5 rounded-full border transition-all"
                        style={{
                          background: active ? meta.accent : 'transparent',
                          borderColor: active ? meta.accent : 'rgba(255,255,255,0.22)',
                          transform: selected ? 'scale(1.12)' : 'scale(1)',
                        }}
                      />
                    ) : (
                      <Leaf
                        size={17}
                        style={{
                          color: active ? meta.accent : 'rgba(255,255,255,0.22)',
                          transform: selected ? 'scale(1.12)' : 'scale(1)',
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 rounded-[24px] bg-white/[0.035] px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ background: `${meta.accent}18`, color: meta.accent }}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                    Caféine estimée
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/50">
                    {meta.label} · {SIZE_META[size].label.toLowerCase()} · {activeLabel.toLowerCase()}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[24px] font-black tabular-nums leading-none" style={{ color: meta.accent }}>
                  {caffeineMg}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
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
            className="mt-4 h-12 w-full rounded-2xl text-[12px] font-barlow-condensed font-black uppercase tracking-[0.16em] transition-all active:scale-[0.98] disabled:opacity-50"
            style={done ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' } : { background: meta.accent, color: '#080808' }}
          >
            {done ? 'Boisson loguée' : saving ? 'Enregistrement...' : `Loguer ${meta.logLabel}`}
          </button>

          <div className="mt-4 rounded-[24px] bg-black/20 px-3 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                Aujourd’hui
              </span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: meta.accent }}>
                {totalMg} mg cumulés · {totalMl} ml
              </span>
            </div>

            {loading ? (
              <p className="py-3 text-center text-[12px] text-white/35">Chargement...</p>
            ) : logs.length === 0 ? (
              <p className="py-3 text-center text-[12px] text-white/35">
                Aucun café ou thé logué aujourd’hui.
              </p>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 5).map((log) => {
                  const logKind = normalizeLogDrinkType(log.drink_type)
                  const logMeta = KIND_META[logKind]
                  const logLabel = DRINK_PRESETS[log.drink_type]?.label ?? logMeta.label

                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-2 rounded-2xl bg-white/[0.035] px-3 py-2"
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
                          {logLabel} · {log.caffeine_mg} mg
                        </p>
                        <p className="text-[10px] text-white/28">
                          {log.amount_ml} ml · {formatTime(log.logged_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteLog(log)}
                        disabled={deletingId === log.id}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/35 active:scale-95 transition disabled:opacity-40"
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
    </div>
  )
}
TSX

echo "✅ QuickCaffeineModal remplacé."
echo ""
echo "Contrôle TypeScript rapide :"
npx tsc --noEmit --pretty false || true
