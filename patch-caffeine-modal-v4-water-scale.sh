#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickCaffeineModal.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-water-scale-v4-$(date +%Y%m%d-%H%M%S)"

cat > "$FILE" <<'TSX'
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Leaf, Trash, X } from '@phosphor-icons/react'
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
    accent: '#2fae8d',
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
      window.setTimeout(() => setDone(false), 1000)
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
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />

        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
            Café & thé
          </p>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
            aria-label="Fermer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
              Aujourd’hui
            </p>
            <p className="text-[12px] font-bold tabular-nums" style={{ color: meta.accent }}>
              {totalMg} mg total
            </p>
          </div>

          <div className="max-h-[116px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/35">Chargement...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/32">Aucun café ou thé logué aujourd’hui.</p>
              </div>
            ) : (
              logs.map(log => {
                const logKind = normalizeLogDrinkType(log.drink_type)
                const logMeta = KIND_META[logKind]
                const label = DRINK_PRESETS[log.drink_type]?.label ?? logMeta.label

                return (
                  <div key={log.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                      {logKind === 'tea'
                        ? <Leaf size={15} style={{ color: logMeta.accent }} />
                        : <Coffee size={15} style={{ color: logMeta.accent }} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-white">
                        {log.caffeine_mg} mg <span className="text-white/28 font-semibold">{formatTime(log.logged_at)}</span>
                      </p>
                      <p className="text-[10px] text-white/25">
                        {label} · {log.amount_ml} ml
                      </p>
                    </div>

                    <button
                      onClick={() => deleteLog(log)}
                      disabled={deletingId === log.id}
                      className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/35 active:scale-95 disabled:opacity-40"
                      aria-label="Supprimer"
                    >
                      <Trash size={15} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="my-4 h-px bg-white/[0.07]" />

          <div className="grid grid-cols-2 gap-2">
            {(['coffee', 'tea'] as CaffeineKind[]).map(nextKind => {
              const item = KIND_META[nextKind]
              const active = kind === nextKind
              return (
                <button
                  key={nextKind}
                  onClick={() => setKind(nextKind)}
                  className={`h-10 rounded-xl border px-3 flex items-center justify-between active:scale-[0.98] transition-all ${
                    active ? 'bg-white/[0.06]' : 'bg-white/[0.03] border-white/[0.05]'
                  }`}
                  style={active ? { borderColor: `${item.accent}70` } : undefined}
                >
                  <span
                    className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.16em]"
                    style={{ color: active ? item.accent : 'rgba(255,255,255,0.42)' }}
                  >
                    {item.label}
                  </span>
                  {nextKind === 'tea'
                    ? <Leaf size={15} style={{ color: active ? item.accent : 'rgba(255,255,255,0.32)' }} />
                    : <Coffee size={15} style={{ color: active ? item.accent : 'rgba(255,255,255,0.32)' }} />}
                </button>
              )
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {CUP_SIZES.map(cupSize => {
              const active = size === cupSize
              return (
                <button
                  key={cupSize}
                  onClick={() => setSize(cupSize)}
                  className={`h-12 rounded-xl text-[11px] font-barlow font-semibold transition-colors ${
                    active ? 'bg-white/[0.13] text-white' : 'bg-white/[0.04] text-white/40'
                  }`}
                >
                  {SIZE_META[cupSize].label}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setIntensity(Math.max(1, (intensity - 1)) as IntensityLevel)}
              className="w-11 h-11 rounded-xl bg-white/[0.06] text-white text-[24px] leading-none active:scale-95"
            >
              −
            </button>

            <div className="text-center">
              <p className="text-[34px] leading-none font-black tabular-nums" style={{ color: meta.accent }}>
                {caffeineMg}
              </p>
              <p className="mt-1 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">
                mg · {INTENSITY_META[intensity].label}
              </p>
              <p className="mt-0.5 text-[10px] text-white/28">
                {SIZE_META[size].label} · {amountMl} ml
              </p>
            </div>

            <button
              onClick={() => setIntensity(Math.min(5, (intensity + 1)) as IntensityLevel)}
              className="w-11 h-11 rounded-xl bg-white/[0.06] text-white text-[24px] leading-none active:scale-95"
            >
              +
            </button>
          </div>

          <button
            onClick={logDrink}
            disabled={saving}
            className="mt-4 h-14 w-full rounded-2xl font-barlow-condensed text-[16px] font-black uppercase tracking-[0.16em] active:scale-[0.98] transition-all disabled:opacity-50"
            style={
              done
                ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }
                : { background: '#f2f2f2', color: '#080808' }
            }
          >
            {done ? 'Boisson loguée' : saving ? 'Enregistrement...' : `Loguer ${meta.logLabel}`}
          </button>
        </div>
      </div>
    </>
  )
}
TSX

echo "✅ QuickCaffeineModal V4 aligné Hydratation."
