"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, Loader2, Scale, X } from "lucide-react"
import useBodyScrollLock from "@/components/client/useBodyScrollLock"
import { useClientT } from "@/components/client/ClientI18nProvider"

interface PhotoMealRefineSheetProps {
  open: boolean
  mealId: string | null
  onClose: () => void
  onSuccess?: () => void
}

type SessionData = {
  id: string
  meal_id: string | null
  status: string
  leftovers_weight_g: number | null
  analysis_summary: {
    scale_weight_g: number | null
    manual_weight_g: number | null
    leftovers_recommended?: boolean
  } | null
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  return fallback
}

async function safeJson(res: Response) {
  return res.json().catch(() => ({}))
}

export default function PhotoMealRefineSheet({
  open,
  mealId,
  onClose,
  onSuccess,
}: PhotoMealRefineSheetProps) {
  const { t } = useClientT()
  useBodyScrollLock(open)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState<SessionData | null>(null)
  const [leftoversInput, setLeftoversInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !mealId) return

    let active = true
    async function loadSession() {
      try {
        setLoading(true)
        setError(null)
        setSuccess(null)
        const res = await fetch(`/api/client/nutrition/photo-log?meal_id=${encodeURIComponent(mealId)}`)
        const json = await safeJson(res)
        if (!res.ok) {
          throw new Error(json.error?.message ?? json.error ?? t('nutrition.photo.refine.notFound'))
        }
        if (!active) return
        const data = json.data as SessionData
        setSession(data)
        setLeftoversInput(
          typeof data.leftovers_weight_g === "number" && data.leftovers_weight_g >= 0
            ? String(data.leftovers_weight_g)
            : "",
        )
      } catch (cause) {
        if (!active) return
        setError(getErrorMessage(cause, t('nutrition.photo.refine.error')))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadSession()
    return () => {
      active = false
    }
  }, [mealId, open, t])

  useEffect(() => {
    if (!open) {
      setLoading(false)
      setSubmitting(false)
      setSession(null)
      setLeftoversInput("")
      setError(null)
      setSuccess(null)
    }
  }, [open])

  const baselineWeight = useMemo(() => {
    return session?.analysis_summary?.scale_weight_g ?? session?.analysis_summary?.manual_weight_g ?? null
  }, [session])

  const handleSubmit = useCallback(async () => {
    if (!session?.id) return
    const leftoversWeight = Number(leftoversInput)
    if (!Number.isFinite(leftoversWeight) || leftoversWeight < 0) {
      setError(t('nutrition.photo.refine.invalidLeftovers'))
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)
      const res = await fetch("/api/client/nutrition/photo-log/refine-leftovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          leftovers_weight_g: leftoversWeight,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) {
        throw new Error(json.error?.message ?? json.error ?? t('nutrition.photo.refine.failed'))
      }

      setSession((current) => current ? {
        ...current,
        status: "refined",
        leftovers_weight_g: leftoversWeight,
      } : current)
      setSuccess(
        t('nutrition.photo.refine.success', {
          kcal: Math.round(json.data.meal_totals.total_calories),
          protein: Math.round(json.data.meal_totals.total_protein_g),
          carbs: Math.round(json.data.meal_totals.total_carbs_g),
          fat: Math.round(json.data.meal_totals.total_fat_g),
        }),
      )
      onSuccess?.()
    } catch (cause) {
      setError(getErrorMessage(cause, t('nutrition.photo.refine.error')))
    } finally {
      setSubmitting(false)
    }
  }, [leftoversInput, onSuccess, session?.id, t])

  if (!open) return null

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-[2px]"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
          exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          className="fixed bottom-0 left-0 right-0 z-[131] flex max-h-[88dvh] flex-col rounded-t-2xl bg-[#080808]"
          style={{ paddingBottom: "16px" }}
        >
          <div className="relative flex items-center justify-between px-5 pt-5 pb-4">
            <div className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.10]" />
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
            >
              {session ? <ChevronLeft size={15} /> : <X size={15} />}
            </button>
            <div className="text-center">
              <p className="font-barlow-condensed text-[15px] font-bold uppercase tracking-[0.12em] text-white">
                {t('nutrition.photo.refine.title')}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">{t('nutrition.photo.refine.subtitle')}</p>
            </div>
            <div className="w-8" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
            {loading && (
              <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 text-center">
                <Loader2 size={28} className="animate-spin text-white/75" />
                <p className="text-[14px] text-white/68">{t('nutrition.photo.refine.loading')}</p>
              </div>
            )}

            {!loading && session && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <p className="font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.18em] text-white/70">
                    {t('nutrition.photo.refine.kicker')}
                  </p>
                  <h3 className="mt-2 text-[24px] font-barlow-condensed font-bold uppercase text-white">
                    {t('nutrition.photo.refine.heading')}
                  </h3>
                  <p className="mt-3 text-[14px] leading-6 text-white/68">
                    {t('nutrition.photo.refine.body')}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Scale size={16} className="text-white/70" />
                    <p className="text-[13px] font-semibold">{t('nutrition.photo.refine.baseline')}</p>
                  </div>
                  <p className="text-[28px] font-black text-white">
                    {typeof baselineWeight === "number" && baselineWeight > 0 ? `${Math.round(baselineWeight)} g` : t('nutrition.photo.refine.unavailable')}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-white/45">
                    {t('nutrition.photo.refine.baselineHint')}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.04] p-4">
                  <label className="mb-2 block text-[12px] uppercase tracking-[0.14em] text-white/38">
                    {t('nutrition.photo.refine.leftoversLabel')}
                  </label>
                  <input
                    inputMode="decimal"
                    placeholder={t('nutrition.photo.refine.leftoversPlaceholder')}
                    value={leftoversInput}
                    onChange={(event) => setLeftoversInput(event.target.value.replace(",", "."))}
                    className="h-12 w-full rounded-2xl bg-[#080808] px-4 text-[18px] text-white outline-none placeholder:text-white/20"
                  />
                  <p className="mt-2 text-[12px] leading-5 text-white/45">
                    {t('nutrition.photo.refine.leftoversHint')}
                  </p>
                </div>

                {error && (
                  <div className="rounded-2xl bg-[#1a1110] p-3 text-[13px] leading-5 text-white/76">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-2xl bg-white/[0.04] p-3 text-[13px] leading-5 text-white/76">
                    {success}
                  </div>
                )}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !(typeof baselineWeight === "number" && baselineWeight > 0)}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#f2f2f2] text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#080808] disabled:opacity-50"
                >
                  {submitting ? t('nutrition.photo.refine.submitting') : t('nutrition.photo.refine.submit')}
                </button>
              </div>
            )}

            {!loading && !session && error && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#1a1110] p-4">
                  <p className="font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.18em] text-[#ff7a59]">
                    {t('nutrition.photo.refine.notFoundTitle')}
                  </p>
                  <p className="mt-3 text-[14px] leading-6 text-white/68">{error}</p>
                </div>
                <button
                  onClick={onClose}
                  className="h-12 w-full rounded-2xl bg-white text-[11px] font-bold uppercase tracking-[0.14em] text-[#080808]"
                >
                  {t('ui.close')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  )
}
