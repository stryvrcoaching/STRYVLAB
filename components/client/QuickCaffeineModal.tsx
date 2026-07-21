'use client'

import { useEffect, useMemo, useState } from 'react'
import { Leaf, Trash, X } from '@phosphor-icons/react'
import { DRINK_PRESETS, type DrinkType } from '@/lib/client/nutrition/drinks'
import { useClientT } from '@/components/client/ClientI18nProvider'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'
import { sendClientMutation } from '@/lib/client/offline-mutations'

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
  defaultKind?: CaffeineKind
}

type CaffeineKind = 'coffee' | 'tea'
type CupSize = 'small' | 'medium' | 'large'
type IntensityLevel = 1 | 2 | 3 | 4 | 5

const SIZE_META: Record<CupSize, { labelKey: string; amountMl: Record<CaffeineKind, number> }> = {
  small: { labelKey: 'caffeine.size.small', amountMl: { coffee: 60, tea: 180 } },
  medium: { labelKey: 'caffeine.size.medium', amountMl: { coffee: 180, tea: 250 } },
  large: { labelKey: 'caffeine.size.large', amountMl: { coffee: 300, tea: 350 } },
}

const BASE_CAFFEINE_MG: Record<CaffeineKind, Record<CupSize, number>> = {
  coffee: { small: 60, medium: 95, large: 140 },
  tea: { small: 18, medium: 35, large: 55 },
}

const INTENSITY_META: Record<IntensityLevel, { labelKey: string; multiplier: number }> = {
  1: { labelKey: 'caffeine.intensity.1', multiplier: 0.6 },
  2: { labelKey: 'caffeine.intensity.2', multiplier: 0.8 },
  3: { labelKey: 'caffeine.intensity.3', multiplier: 1 },
  4: { labelKey: 'caffeine.intensity.4', multiplier: 1.25 },
  5: { labelKey: 'caffeine.intensity.5', multiplier: 1.5 },
}

const KIND_META: Record<CaffeineKind, {
  labelKey: string
  accent: string
  drinkType: Extract<DrinkType, 'coffee' | 'tea'>
}> = {
  coffee: {
    labelKey: 'caffeine.kind.coffee',
    accent: DRINK_PRESETS.coffee.accent,
    drinkType: 'coffee',
  },
  tea: {
    labelKey: 'caffeine.kind.tea',
    accent: '#2fae8d',
    drinkType: 'tea',
  },
}

const CUP_SIZES: CupSize[] = ['small', 'medium', 'large']

function estimateCaffeine(kind: CaffeineKind, size: CupSize, intensity: IntensityLevel): number {
  return Math.round(BASE_CAFFEINE_MG[kind][size] * INTENSITY_META[intensity].multiplier)
}

function isCaffeineLog(log: CaffeineLog): boolean {
  return Number(log.caffeine_mg ?? 0) > 0 || ['espresso', 'coffee', 'lungo', 'tea'].includes(String(log.drink_type))
}

function normalizeKind(type: DrinkType): CaffeineKind {
  return type === 'tea' ? 'tea' : 'coffee'
}

function formatTime(iso: string): string {
  const lang = typeof window !== 'undefined' ? (localStorage.getItem('client_lang') ?? 'fr') : 'fr'
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return ''
  }
}

function CoffeeBean({ active = true, color = '#c08457', size = 16 }: { active?: boolean; color?: string; size?: number }) {
  const stroke = active ? color : 'rgba(255,255,255,0.32)'
  const fill = active ? color : 'transparent'
  const groove = active ? '#0d0d0d' : 'rgba(255,255,255,0.32)'

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <path
        d="M17.8 3.6c3.1 2.1 3.5 7.5.8 12.1-2.7 4.6-7.4 6.6-10.5 4.5-3.1-2.1-3.5-7.5-.8-12.1 2.7-4.6 7.4-6.6 10.5-4.5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.75"
      />
      <path
        d="M14.8 4.7c-2.2 2.4-2.1 5-.8 7.4 1.3 2.5 1.2 5.1-1.2 7.4"
        fill="none"
        stroke={groove}
        strokeWidth="1.75"
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
  defaultKind,
}: QuickCaffeineModalProps) {
  const { t } = useClientT()
  useBodyScrollLock(open)
  const [logs, setLogs] = useState<CaffeineLog[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [kind, setKind] = useState<CaffeineKind>(defaultKind ?? 'coffee')

  useEffect(() => {
    if (open) {
      setKind(defaultKind ?? 'coffee')
    }
  }, [open, defaultKind])
  const [size, setSize] = useState<CupSize>('medium')
  const [intensity, setIntensity] = useState<IntensityLevel>(3)

  const meta = KIND_META[kind]
  const amountMl = SIZE_META[size].amountMl[kind]
  const caffeineMg = useMemo(() => estimateCaffeine(kind, size, intensity), [kind, size, intensity])
  const totalMg = useMemo(() => logs.reduce((sum, log) => sum + Number(log.caffeine_mg ?? 0), 0), [logs])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ kind: 'caffeine' })
    if (date) params.set('date', date)

    fetch(`/api/client/water?${params.toString()}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (cancelled) return
        setLogs(((json?.data ?? json?.logs ?? []) as CaffeineLog[]).filter(isCaffeineLog))
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

  if (!open) return null

  async function logDrink() {
    if (saving) return

    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        amount_ml: amountMl,
        drink_type: meta.drinkType,
        caffeine_mg: caffeineMg,
      }

      if (date) body.date = date

      const result = await sendClientMutation({
        kind: 'water',
        url: '/api/client/water',
        method: 'POST',
        body,
      })

      const json = await result.response?.json().catch(() => null)
      if (!result.queued && !result.response?.ok) throw new Error(json?.error ?? t('caffeine.error'))

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

      if (!result.queued) onLogged?.(caffeineMg)
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
        className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] flex max-h-[88dvh] flex-col rounded-t-[28px] bg-[#121212] shadow-2xl"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)', transform: 'translateZ(0)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />

        <header className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
            {t('quick.caffeineTea')}
          </p>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
            aria-label={t('ui.close')}
          >
            <X size={15} />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
              {t('common.today')}
            </p>

            <p className="text-[12px] font-bold tabular-nums" style={{ color: meta.accent }}>
              {t('caffeine.totalMg', { n: totalMg })}
            </p>
          </div>

          <div className="max-h-[116px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/35">{t('common.loading')}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/32">{t('caffeine.empty')}</p>
              </div>
            ) : (
              logs.map(log => {
                const logKind = normalizeKind(log.drink_type)
                const logMeta = KIND_META[logKind]
                const label = DRINK_PRESETS[log.drink_type]?.label ?? t(logMeta.labelKey as never)

                return (
                  <div key={log.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                      {logKind === 'tea'
                        ? <Leaf size={16} style={{ color: logMeta.accent }} />
                        : <CoffeeBean active color={logMeta.accent} size={16} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-black text-white">
                        {log.caffeine_mg} mg
                        <span className="ml-2 text-[12px] font-semibold text-white/28">
                          {formatTime(log.logged_at)}
                        </span>
                      </p>
                      <p className="text-[10px] text-white/25">
                        {label} · {Math.round(log.amount_ml)} ml
                      </p>
                    </div>

                    <button
                      onClick={() => deleteLog(log)}
                      disabled={deletingId === log.id}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/35 active:scale-95 disabled:opacity-40"
                      aria-label={t('journal.deleteTitle')}
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
                  className={`flex h-10 items-center justify-between rounded-xl px-3 transition-[background-color,color,transform] active:scale-[0.96] ${
                    active ? 'bg-white/[0.10]' : 'bg-white/[0.045]'
                  }`}
                >
                    <span
                      className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.16em]"
                      style={{ color: active ? item.accent : 'rgba(255,255,255,0.42)' }}
                    >
                      {t(item.labelKey as never)}
                    </span>

                  {nextKind === 'tea'
                    ? <Leaf size={15} style={{ color: active ? item.accent : 'rgba(255,255,255,0.32)' }} />
                    : <CoffeeBean active={active} color={item.accent} size={16} />}
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
                  {t(SIZE_META[cupSize].labelKey as never)}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setIntensity(value => Math.max(1, value - 1) as IntensityLevel)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-[24px] leading-none text-white active:scale-95"
            >
              −
            </button>

            <div className="text-center">
              <p className="text-[34px] font-black leading-none tabular-nums" style={{ color: meta.accent }}>
                {caffeineMg}
              </p>

              <p className="mt-1 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">
                mg · {t(INTENSITY_META[intensity].labelKey as never)}
              </p>

              <p className="mt-0.5 text-[10px] text-white/28">
                {t(SIZE_META[size].labelKey as never)} · {amountMl} ml
              </p>
            </div>

            <button
              onClick={() => setIntensity(value => Math.min(5, value + 1) as IntensityLevel)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-[24px] leading-none text-white active:scale-95"
            >
              +
            </button>
          </div>
        </main>

        <footer className="shrink-0 px-5 pt-2 pb-4">
          <button
            onClick={logDrink}
            disabled={saving}
            className="h-11 w-full rounded-xl bg-[#f2f2f2] font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] text-[#080808] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.add')}
          </button>
        </footer>
      </div>
    </>
  )
}
