"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Minus, Plus, Trash2, X } from "lucide-react"
import { DRINK_PRESETS, estimateCaffeineMg, type DrinkType } from "@/lib/client/nutrition/drinks"
import { CaffeineGlyph } from "@/components/client/CaffeineGlyph"

type CaffeineLog = {
  id: string
  amount_ml: number
  caffeine_mg: number
  drink_type: DrinkType
  logged_at: string
}

interface Props {
  open: boolean
  onClose: () => void
  date?: string
  onLogged?: (mg: number) => void
  onDeleted?: (mg: number) => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

export default function QuickCaffeineModal({ open, onClose, date, onLogged, onDeleted }: Props) {
  const router = useRouter()
  const [drinkType, setDrinkType] = useState<DrinkType>("coffee")
  const [ml, setMl] = useState(DRINK_PRESETS.coffee.baseAmountMl)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<CaffeineLog[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const url = new URL("/api/client/water", window.location.origin)
    url.searchParams.set("kind", "caffeine")
    if (date) url.searchParams.set("date", date)
    fetch(url)
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .catch(() => {})
  }, [open, date])

  useEffect(() => {
    if (!open) return
    const preset = DRINK_PRESETS[drinkType]
    setMl(preset.baseAmountMl)
  }, [drinkType, open])

  const caffeineMg = useMemo(() => estimateCaffeineMg(drinkType, ml), [drinkType, ml])
  const totalMl = logs.reduce((s, l) => s + l.amount_ml, 0)
  const totalMg = logs.reduce((s, l) => s + l.caffeine_mg, 0)

  async function log() {
    if (saving) return
    setSaving(true)
    setError(null)
    onLogged?.(caffeineMg)

    try {
      const res = await fetch("/api/client/water", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_ml: ml,
          caffeine_mg: caffeineMg,
          drink_type: drinkType,
          date,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? "Impossible d'enregistrer la boisson.")
        setSaving(false)
        return
      }

      const payload = await res.json().catch(() => ({}))
      const newLog: CaffeineLog = {
        id: payload.id ?? crypto.randomUUID(),
        amount_ml: ml,
        caffeine_mg: caffeineMg,
        drink_type: drinkType,
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
      setError("Impossible d'enregistrer la boisson.")
      setSaving(false)
    }
  }

  async function deleteLog(log: CaffeineLog) {
    setDeletingId(log.id)
    try {
      const res = await fetch(`/api/client/water/${log.id}`, { method: "DELETE" })
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== log.id))
        onDeleted?.(log.caffeine_mg)
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const options: DrinkType[] = ["espresso", "coffee", "lungo", "tea"]

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
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
            className="fixed bottom-0 left-0 right-0 z-[90] rounded-t-2xl"
            style={{ background: "#0d0d0d", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
          >
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                Café & thé
              </p>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-8">
              {logs.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30">Aujourd'hui</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: DRINK_PRESETS[drinkType].accent }}>
                      {totalMg}mg cumulés · {totalMl}ml
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                    {logs.map(log => {
                      const label = DRINK_PRESETS[log.drink_type]?.label ?? "Boisson"
                      const entryUnit = log.drink_type === "tea" ? "théine" : "caféine"
                      return (
                        <div
                          key={log.id}
                          className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CaffeineGlyph drinkType={log.drink_type} active={false} size="sm" color={DRINK_PRESETS[log.drink_type]?.accent ?? "#c08457"} className="shrink-0" />
                            <span className="text-[13px] font-bold text-white tabular-nums">{log.amount_ml} ml</span>
                            <span className="text-[10px] text-white/25 truncate">{label} · {log.caffeine_mg}mg {entryUnit}</span>
                            <span className="text-[10px] text-white/20 shrink-0">{formatTime(log.logged_at)}</span>
                          </div>
                          <button
                            onClick={() => deleteLog(log)}
                            disabled={deletingId === log.id}
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 active:scale-95 transition-all disabled:opacity-40"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="h-px bg-white/[0.06] mt-3 mb-4" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mb-4">
                {options.map((type) => {
                  const preset = DRINK_PRESETS[type]
                  const active = drinkType === type
                  const density = Math.round((preset.baseCaffeineMg / preset.baseAmountMl) * 100)
                  return (
                    <button
                      key={type}
                      onClick={() => setDrinkType(type)}
                      className={`rounded-2xl px-3 py-3 text-left transition-all active:scale-[0.98] ${
                        active ? "bg-white/[0.08] border border-white/10" : "bg-white/[0.03]"
                      }`}
                      style={active ? { boxShadow: `0 0 0 1px ${preset.accent}22 inset` } : undefined}
                    >
                      <CaffeineGlyph drinkType={type} active={active} size="lg" className="mx-auto" color={active ? "#111111" : preset.accent} />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[12px] font-bold text-white">{preset.label}</span>
                        <span className="text-[10px] text-white/30 tabular-nums">{preset.baseAmountMl}ml</span>
                      </div>
                      <p className="text-[10px] text-white/35 leading-tight mt-1">
                        {preset.baseCaffeineMg}mg · {density}mg/100ml · {preset.strengthLabel}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => setMl(m => Math.max(20, m - 20))}
                  className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95 shrink-0"
                >
                  <Minus size={15} />
                </button>
                <div className="flex-1 text-center">
                  <p className="text-[28px] font-black text-white leading-none tabular-nums">{ml}</p>
                  <p className="text-[10px] text-white/30 font-barlow-condensed uppercase tracking-wider mt-0.5">millilitres</p>
                </div>
                <button
                  onClick={() => setMl(m => Math.min(600, m + 20))}
                  className="h-10 w-10 flex items-center justify-center bg-white/[0.06] rounded-xl text-white active:scale-95 shrink-0"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="mb-4 rounded-2xl bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-bold">Charge active</span>
                  <span className="text-[14px] font-black text-white tabular-nums">{caffeineMg} mg</span>
                </div>
                <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (caffeineMg / 160) * 100)}%`,
                      background: DRINK_PRESETS[drinkType].accent,
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-white/30">
                  {drinkType === "tea" ? "théine estimée" : "caféine estimée"} à partir du volume choisi.
                </p>
              </div>

              {error && <p className="text-[11px] text-red-400 text-center mb-3">{error}</p>}

              <button
                onClick={log}
                disabled={saving && !done}
                className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[12px] transition-all active:scale-[0.98] ${
                  done ? "bg-white/[0.06] text-white/50" : "disabled:opacity-60"
                }`}
                style={done ? undefined : { background: DRINK_PRESETS[drinkType].accent, color: "#080808" }}
              >
                {done ? "Boisson loguée" : saving ? "Enregistrement..." : `Loguer ${DRINK_PRESETS[drinkType].label}`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
