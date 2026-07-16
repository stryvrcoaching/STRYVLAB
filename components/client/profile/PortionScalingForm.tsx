"use client"

import { useEffect, useState } from "react"
import { Check, Ruler, X } from "lucide-react"
import {
  REFERENCE_HAND_CM,
  HEIGHT_TO_HAND_RATIO,
} from "@/lib/nutrition/food-items"
import { useClientT } from "@/components/client/ClientI18nProvider"

export default function PortionScalingForm() {
  const { t } = useClientT()
  const [handCm, setHandCm] = useState<string>("")
  const [heightCm, setHeightCm] = useState<number | null>(null)
  const [savedHand, setSavedHand] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    fetch("/api/client/profile-scaling")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setSavedHand(d.hand_length_cm ?? null)
        setHeightCm(d.height_cm ?? null)
        if (d.hand_length_cm) setHandCm(String(d.hand_length_cm))
      })
      .finally(() => setLoading(false))
  }, [])

  const derivedFromHeight = heightCm ? Math.round(heightCm * HEIGHT_TO_HAND_RATIO * 10) / 10 : null
  const effective = savedHand ?? derivedFromHeight ?? REFERENCE_HAND_CM
  const factor = effective / REFERENCE_HAND_CM
  const palmGrams = Math.round(100 * factor)

  async function save() {
    setSaving(true)
    const val = handCm.trim() === "" ? null : Number(handCm)
    const res = await fetch("/api/client/profile-scaling", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hand_length_cm: val }),
    })
    setSaving(false)
    if (res.ok) {
      setSavedHand(val)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 1800)
    }
  }

  async function clearOverride() {
    setHandCm("")
    setSaving(true)
    const res = await fetch("/api/client/profile-scaling", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hand_length_cm: null }),
    })
    if (res.ok) setSavedHand(null)
    setSaving(false)
  }

  if (loading) {
    return <div className="h-32 bg-white/[0.03] rounded-xl animate-pulse" />
  }

  return (
    <div className="space-y-4">
      {/* Explication */}
      <p className="text-[12px] text-white/50 leading-relaxed">
        {t('portion.desc')}
      </p>

      {/* Source actuelle */}
      <div className="bg-white/[0.03] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">
            Main effective
          </span>
          <span className="text-[14px] font-black text-white">
            {effective.toFixed(1)} cm
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-bold">
            1 paume = viande
          </span>
          <span className="text-[14px] font-black text-[#f2f2f2]">{palmGrams} g</span>
        </div>
        <p className="text-[10px] text-white/30">
          Source : {savedHand
            ? "ta mesure"
            : derivedFromHeight
              ? t('portion.derived', { cm: String(heightCm) })
              : t('portion.ref')}
        </p>
      </div>

      {/* Input + guide */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
            Longueur main (cm)
          </label>
          <button
            type="button"
            onClick={() => setShowGuide((s) => !s)}
            className="text-[11px] text-[#f2f2f2]/80 hover:text-[#f2f2f2] flex items-center gap-1"
          >
            <Ruler size={11} />
            {showGuide ? "Masquer" : "Comment mesurer"}
          </button>
        </div>

        {showGuide && (
          <div className="bg-[#1a1a1a] rounded-xl p-3 mb-3 space-y-1.5">
            <p className="text-[11px] text-white/70 leading-relaxed">
              <span className="font-bold">1.</span> {t('portion.step1')}
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed">
              <span className="font-bold">2.</span> Mesure du pli du poignet jusqu'au bout du majeur.
            </p>
            <p className="text-[11px] text-white/70 leading-relaxed">
              <span className="font-bold">3.</span> {t('portion.step3')}
            </p>
            <p className="text-[10px] text-white/40 mt-2">
              {t('portion.refs')}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            min="10"
            max="28"
            value={handCm}
            onChange={(e) => setHandCm(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder={derivedFromHeight ? `auto: ${derivedFromHeight}` : "18.0"}
            className="flex-1 h-11 px-3 bg-[#111111] rounded-xl text-[14px] font-bold text-white outline-none min-w-0"
          />
          <button
            onClick={save}
            disabled={saving || handCm.trim() === ""}
            className="h-11 px-4 bg-[#f2f2f2] text-[#080808] rounded-xl text-[11px] font-bold uppercase tracking-[0.1em] active:scale-[0.98] disabled:opacity-40"
          >
            {savedToast ? <Check size={15} /> : "Sauver"}
          </button>
          {savedHand !== null && (
            <button
              onClick={clearOverride}
              disabled={saving}
              className="h-11 w-11 flex items-center justify-center bg-white/[0.04] rounded-xl text-white/40 hover:text-white/70 active:scale-95"
              title={t('portion.clear')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
