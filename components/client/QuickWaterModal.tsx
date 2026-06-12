'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Droplets, Plus, Minus, Trash2 } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

const QUICK_AMOUNTS = [150, 250, 330, 500]

type WaterLog = { id: string; amount_ml: number; logged_at: string }

interface Props {
  open: boolean
  onClose: () => void
  onLogged?: (ml: number) => void
  onDeleted?: (ml: number) => void
  date?: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function QuickWaterModal({ open, onClose, onLogged, onDeleted, date }: Props) {
  const { t } = useClientT()
  const router = useRouter()
  const [ml, setMl] = useState(250)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<WaterLog[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const url = new URL('/api/client/water', window.location.origin)
    if (date) url.searchParams.set('date', date)
    url.searchParams.set('kind', 'water')
    fetch(url)
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .catch(() => {})
  }, [open, date])

  async function log() {
    if (saving) return
    setSaving(true)
    setError(null)
    onLogged?.(ml)

    try {
      const res = await fetch('/api/client/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: ml, date }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? t('water.error'))
        setSaving(false)
        return
      }

      const payload = await res.json().catch(() => ({}))
      const newLog: WaterLog = {
        id: payload.id ?? crypto.randomUUID(),
        amount_ml: ml,
        logged_at: payload.logged_at ?? new Date().toISOString(),
      }
      setLogs(prev => [...prev, newLog])
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setSaving(false)
        router.refresh()
      }, 700)
    } catch {
      setError(t('water.error'))
      setSaving(false)
    }
  }

  async function deleteLog(log: WaterLog) {
    setDeletingId(log.id)
    try {
      const res = await fetch(`/api/client/water/${log.id}`, { method: 'DELETE' })
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== log.id))
        onDeleted?.(log.amount_ml)
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const totalMl = logs.reduce((s, l) => s + l.amount_ml, 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.2, ease: 'easeIn' } }}
            className="fixed bottom-0 left-0 right-0 z-[90] rounded-t-2xl"
            style={{ background: '#0d0d0d', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                {t('water.title')}
              </p>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8">

              {/* Log history */}
              {logs.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30">Aujourd'hui</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: NUTRITION_UI_COLORS.water }}>
                      {(totalMl / 1000).toFixed(1)} L total
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                    {logs.map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Droplets size={12} style={{ color: NUTRITION_UI_COLORS.water }} className="opacity-60" />
                          <span className="text-[13px] font-bold text-white tabular-nums">{log.amount_ml} ml</span>
                          <span className="text-[10px] text-white/25">{formatTime(log.logged_at)}</span>
                        </div>
                        <button
                          onClick={() => deleteLog(log)}
                          disabled={deletingId === log.id}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 active:scale-95 transition-all disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-white/[0.06] mt-3 mb-4" />
                </div>
              )}

              {/* Quick pills */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setMl(a)}
                    className={`h-10 rounded-xl text-[12px] font-bold transition-all active:scale-95 ${
                      ml === a
                        ? 'bg-white/[0.10] text-white'
                        : 'bg-white/[0.04] text-white/40'
                    }`}
                  >
                    {a}ml
                  </button>
                ))}
              </div>

              {/* Fine-tune */}
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setMl(m => Math.max(50, m - 50))}
                  className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95 shrink-0"
                >
                  <Minus size={15} />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-[28px] font-black text-white leading-none tabular-nums">{ml}</p>
                  <p className="text-[10px] text-white/30 font-barlow-condensed uppercase tracking-wider mt-0.5">millilitres</p>
                </div>
                <button
                  onClick={() => setMl(m => Math.min(2000, m + 50))}
                  className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95 shrink-0"
                >
                  <Plus size={15} />
                </button>
              </div>

              {error && (
                <p className="text-[11px] text-red-400 text-center mb-3">{error}</p>
              )}

              <button
                onClick={log}
                disabled={saving && !done}
                className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[12px] transition-all active:scale-[0.98] ${
                  done
                    ? 'bg-white/[0.06] text-white/50'
                    : 'disabled:opacity-60'
                }`}
                style={done ? undefined : { background: '#f2f2f2', color: '#080808' }}
              >
                <Droplets size={15} />
                {done ? t('water.logged', { ml: String(ml) }) : saving ? t('water.saving') : t('water.log', { ml: String(ml) })}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
