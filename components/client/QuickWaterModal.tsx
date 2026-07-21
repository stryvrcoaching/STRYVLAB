'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Coffee, Drop, Leaf, Trash, X } from '@phosphor-icons/react'
import { DRINK_PRESETS, type DrinkType } from '@/lib/client/nutrition/drinks'
import { useClientT } from '@/components/client/ClientI18nProvider'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'
import { sendClientMutation } from '@/lib/client/offline-mutations'

type WaterLog = {
  id: string
  amount_ml: number
  caffeine_mg?: number | null
  drink_type?: DrinkType | null
  logged_at: string
}

type QuickWaterModalProps = {
  open: boolean
  onClose: () => void
  onLogged?: (amountMl: number) => void
  onDeleted?: (amountMl: number) => void
  date?: string
}

const PRESETS = [150, 250, 330, 500]

function formatTime(iso: string): string {
  const lang = typeof window !== 'undefined' ? (localStorage.getItem('client_lang') ?? 'fr') : 'fr'
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return ''
  }
}

function isCaffeineType(type?: DrinkType | null): boolean {
  return type === 'espresso' || type === 'coffee' || type === 'lungo' || type === 'tea'
}

const WATER_SHEET_EXCLUDED_TYPES = new Set(['espresso', 'coffee', 'lungo', 'tea'])

function isPureWaterLog(log: WaterLog): boolean {
  const drinkType = String(log.drink_type ?? 'water')
  const caffeineMg = Number(log.caffeine_mg ?? 0)

  return !WATER_SHEET_EXCLUDED_TYPES.has(drinkType) && caffeineMg <= 0
}

function LogIcon({ log }: { log: WaterLog }) {
  const type = log.drink_type ?? 'water'

  if (type === 'tea') {
    return <Leaf size={16} className="text-emerald-400/80" />
  }

  if (isCaffeineType(type)) {
    return <Coffee size={16} className="text-[#c08457]" />
  }

  return <Drop size={16} className="text-blue-500" />
}

function logLabel(log: WaterLog): string {
  const lang = typeof window !== 'undefined' ? (localStorage.getItem('client_lang') ?? 'fr') : 'fr'
  const type = log.drink_type ?? 'water'

  if (type === 'water') return `${Math.round(log.amount_ml)} ml`

  const preset = DRINK_PRESETS[type]
  const fallback = lang === 'es' ? 'Bebida' : lang === 'en' ? 'Drink' : 'Boisson'
  return `${preset?.label ?? fallback} · ${Math.round(log.amount_ml)} ml`
}

export default function QuickWaterModal({
  open,
  onClose,
  onLogged,
  onDeleted,
  date,
}: QuickWaterModalProps) {
  const { t } = useClientT()
  useBodyScrollLock(open)
  const [mounted, setMounted] = useState(false)
  const [logs, setLogs] = useState<WaterLog[]>([])
  const [amountMl, setAmountMl] = useState(250)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalMl = useMemo(
    () => logs.reduce((sum, log) => sum + Number(log.amount_ml ?? 0), 0),
    [logs],
  )

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ kind: 'water' })
    if (date) params.set('date', date)

    fetch(`/api/client/water?${params.toString()}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (cancelled) return
        const rows = (json?.data ?? json?.logs ?? []) as WaterLog[]
        setLogs(rows.filter(isPureWaterLog))
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

  if (!open || !mounted) return null

  async function logWater() {
    if (saving) return

    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        amount_ml: amountMl,
        drink_type: 'water',
        caffeine_mg: 0,
      }

      if (date) body.date = date

      const result = await sendClientMutation({
        kind: 'water',
        url: '/api/client/water',
        method: 'POST',
        body,
      })

      const json = await result.response?.json().catch(() => null)
      if (!result.queued && !result.response?.ok) throw new Error(json?.error ?? t('water.error'))

      const nextLog = json?.data as WaterLog | undefined

      setLogs(prev => [
        nextLog?.id
          ? nextLog
          : {
              id: `tmp-${Date.now()}`,
              amount_ml: amountMl,
              caffeine_mg: 0,
              drink_type: 'water',
              logged_at: new Date().toISOString(),
            },
        ...prev,
      ])

      if (!result.queued) onLogged?.(amountMl)
    } catch (err) {
      console.error('[QuickWaterModal] logWater failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function deleteLog(log: WaterLog) {
    if (deletingId) return

    setDeletingId(log.id)

    try {
      const res = await fetch(`/api/client/water/${log.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')

      setLogs(prev => prev.filter(entry => entry.id !== log.id))
      onDeleted?.(Number(log.amount_ml ?? 0))
    } catch (err) {
      console.error('[QuickWaterModal] deleteLog failed', err)
    } finally {
      setDeletingId(null)
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] rounded-t-[28px] bg-[#121212] shadow-2xl"
        style={{
          maxHeight: '88dvh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'var(--client-modal-bottom-padding)',
        }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />

        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
          <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
            {t('nutrition.hydration')}
          </p>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
            aria-label={t('ui.close')}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
              {t('common.today')}
            </p>

            <p className="text-[12px] font-bold tabular-nums text-blue-500">
              {t('water.totalLiters', { n: (totalMl / 1000).toFixed(1) })}
            </p>
          </div>

          <div className="max-h-[132px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/35">{t('common.loading')}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[12px] text-white/32">{t('common.empty')}</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                    <LogIcon log={log} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-white">
                      {logLabel(log)}
                      <span className="ml-2 text-[12px] font-semibold text-white/28">
                        {formatTime(log.logged_at)}
                      </span>
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
              ))
            )}
          </div>

          <div className="my-4 h-px bg-white/[0.07]" />

          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(preset => {
              const active = amountMl === preset

              return (
                <button
                  key={preset}
                  onClick={() => setAmountMl(preset)}
                  className={`h-11 rounded-xl text-[12px] font-barlow font-bold transition-colors ${
                    active ? 'bg-white/[0.13] text-white' : 'bg-white/[0.04] text-white/38'
                  }`}
                >
                  {preset}ml
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setAmountMl(value => Math.max(50, value - 50))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-[24px] leading-none text-white active:scale-95"
            >
              −
            </button>

            <div className="text-center">
              <p className="text-[34px] font-black leading-none tabular-nums text-white">
                {amountMl}
              </p>
              <p className="mt-1 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/30">
                {t('water.milliliters')}
              </p>
            </div>

            <button
              onClick={() => setAmountMl(value => Math.min(5000, value + 50))}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-[24px] leading-none text-white active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        <div className="shrink-0 px-5 pt-2 pb-4">
          <button
            onClick={logWater}
            disabled={saving}
            className="h-11 w-full rounded-xl bg-[#f2f2f2] font-barlow-condensed text-[12px] font-black uppercase tracking-[0.14em] text-[#080808] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.add')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
