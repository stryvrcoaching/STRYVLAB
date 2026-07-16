"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Info } from "lucide-react"
import type { SmoothingDurationOption } from "@/lib/nutrition/smoothing/types"

type PanelResponse = {
  date: string
  protocolId: string | null
  protocolName: string | null
  activePlan: null | {
    id: string
    sourceDate: string
    direction: "surplus" | "deficit"
    durationDays: number
    smoothableDeltaKcal: number
    coachNote: string | null
    coachLastAction: string | null
  }
  proposal: {
    eligible: boolean
    thresholdKcal: number
    rawDeltaKcal: number
    smoothableDeltaKcal: number
    direction: "surplus" | "deficit" | null
    recommendedDurationDays: SmoothingDurationOption | null
  }
  previewDays: Array<{
    date: string
    label: string
    baseTargetKcal: number
    adjustedTargetKcal: number
    kcalDelta: number
    scalingRatio: number
    hasCoachPlan: boolean
    meals: Array<{
      mealId: string
      title: string
      baseCalories: number
      adjustedCalories: number
      scalingRatio: number
      itemCount: number
    }>
  }>
}

const DURATION_OPTIONS: SmoothingDurationOption[] = [3, 4, 5, 7, 10]

function formatKcal(value: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(Math.abs(value)))
}

function formatDirection(direction: "surplus" | "deficit" | null) {
  if (direction === "surplus") return "Réduction"
  if (direction === "deficit") return "Réinjection"
  return "Lissage"
}

function formatLongDate(value: string | null) {
  if (!value) return "aujourd’hui"
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  })
}

export default function CoachSmoothingStudioPanel({
  clientId,
  protocolId,
  protocolStatus,
  sourceDate,
}: {
  clientId: string
  protocolId?: string | null
  protocolStatus?: "draft" | "shared"
  sourceDate: string | null
}) {
  const router = useRouter()
  const [state, setState] = useState<PanelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<"apply" | "replace" | "cancel" | null>(null)
  const [note, setNote] = useState("")
  const [selectedDays, setSelectedDays] = useState<SmoothingDurationOption>(4)
  const [isOpen, setIsOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const activePlan = state?.activePlan ?? null
  const effectiveDate = state?.date ?? sourceDate ?? null

  const load = useCallback(async (durationDays?: SmoothingDurationOption) => {
    if (!protocolId || protocolStatus !== "shared") {
      setState(null)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sourceDate) params.set("date", sourceDate)
      if (durationDays) params.set("durationDays", String(durationDays))
      const response = await fetch(`/api/clients/${clientId}/nutrition-smoothing/recommendation?${params.toString()}`, {
        cache: "no-store",
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.error ?? "Erreur de chargement")
      setState(json)
      if (json?.proposal?.recommendedDurationDays) {
        setSelectedDays(durationDays ?? json.proposal.recommendedDurationDays)
      }
      if (json?.activePlan?.coachNote) {
        setNote(json.activePlan.coachNote)
      }
    } catch {
      setState(null)
    } finally {
      setLoading(false)
    }
  }, [clientId, protocolId, protocolStatus, sourceDate])

  useEffect(() => {
    void load(selectedDays)
  }, [load, selectedDays])

  const recommendation = state?.proposal ?? null
  const canRender = Boolean(protocolId)

  const applyMode = activePlan ? "replace" : "create"
  const submit = useCallback(async () => {
    if (!effectiveDate) return
    setBusy(activePlan ? "replace" : "apply")
    try {
      const response = await fetch(`/api/clients/${clientId}/nutrition-smoothing/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: effectiveDate,
          durationDays: selectedDays,
          mode: applyMode,
          note: note.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error()
      await load(selectedDays)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }, [activePlan, applyMode, clientId, effectiveDate, load, note, router, selectedDays])

  const cancel = useCallback(async () => {
    if (!activePlan) return
    setBusy("cancel")
    try {
      const response = await fetch(`/api/clients/${clientId}/nutrition-smoothing/${activePlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          note: note.trim() || undefined,
        }),
      })
      if (!response.ok) throw new Error()
      await load(selectedDays)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }, [activePlan, clientId, load, note, router, selectedDays])

  const effectiveDirection = activePlan?.direction ?? recommendation?.direction ?? null
  const effectiveDeltaKcal = Math.abs(
    activePlan?.smoothableDeltaKcal ?? recommendation?.smoothableDeltaKcal ?? 0,
  )
  const totalPreviewDeltaKcal = useMemo(
    () => state?.previewDays.reduce((sum, day) => sum + Math.abs(day.kcalDelta), 0) ?? 0,
    [state?.previewDays],
  )
  const averageDailyDeltaKcal = useMemo(
    () => (state?.previewDays.length ? totalPreviewDeltaKcal / state.previewDays.length : 0),
    [state?.previewDays.length, totalPreviewDeltaKcal],
  )

  const compactSummary = useMemo(() => {
    if (effectiveDirection && effectiveDeltaKcal > 0 && state?.previewDays.length) {
      return `${formatDirection(effectiveDirection)} active de ${formatKcal(effectiveDeltaKcal)} kcal sur ${state.previewDays.length} jours.`
    }
    if (recommendation?.eligible && recommendation.direction && recommendation.recommendedDurationDays) {
      return `${formatDirection(recommendation.direction)} suggérée de ${formatKcal(recommendation.smoothableDeltaKcal)} kcal sur ${recommendation.recommendedDurationDays} jours.`
    }
    return "Aucune action recommandée pour l’instant"
  }, [effectiveDeltaKcal, effectiveDirection, recommendation, state?.previewDays.length])

  const distributionSentence = useMemo(() => {
    if (!effectiveDirection || !effectiveDeltaKcal || !state?.previewDays.length) return null
    return `Écart à lisser : ${formatKcal(effectiveDeltaKcal)} kcal. Répartition actuelle : environ ${formatKcal(averageDailyDeltaKcal)} kcal par jour sur ${state.previewDays.length} jours. Source le ${formatLongDate(effectiveDate)}.`
  }, [averageDailyDeltaKcal, effectiveDate, effectiveDeltaKcal, effectiveDirection, state?.previewDays.length])

  if (!canRender) return null

  if (protocolStatus !== "shared") {
    return (
      <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/32">
                Lissage coach
              </p>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/36">
                En attente
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/52">
              Disponible après partage du protocole au client.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((current) => !current)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/38 transition-colors hover:text-white/72"
            aria-label="Informations sur le lissage coach"
          >
            <Info size={13} />
          </button>
        </div>
        {showHelp ? (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[11px] leading-relaxed text-white/58">
            Le lissage redistribue un surplus ou un déficit sur les jours à venir. Il ne modifie pas l’historique du client et agit uniquement sur le plan futur.
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-xl px-1 py-0.5 text-left transition-colors hover:bg-white/[0.03]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/32">
                Lissage coach
              </p>
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {activePlan ? "Actif" : recommendation?.eligible ? "Recommandé" : "Inactif"}
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setShowHelp((current) => !current)
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/38 transition-colors hover:text-white/72"
                aria-label="Informations sur le lissage coach"
              >
                <Info size={13} />
              </button>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-white/70">
              {compactSummary}
            </p>
            {effectiveDate ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  router.push(`/coach/clients/${clientId}/data/nutrition?focusDate=${effectiveDate}`)
                }}
                className="mt-0.5 text-[10px] text-white/38 transition-colors hover:text-white/68"
              >
                Détecté le {formatLongDate(effectiveDate)}
              </button>
            ) : (
              <p className="mt-0.5 text-[10px] text-white/38">
                Détecté aujourd’hui
              </p>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 text-white/34 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showHelp ? (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">
              Comment ça fonctionne
            </p>
            <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/58">
              <p>Le système compare l’objectif calorique du jour et ce qui a réellement été consommé, puis ne propose un lissage que si l’écart dépasse un seuil utile et si la journée est suffisamment renseignée.</p>
              <p>Le coach choisit ensuite sur combien de jours futurs répartir cet écart. La répartition se fait uniquement sur les jours à venir, jamais sur l’historique.</p>
              <p>Quand un plan alimentaire coach existe, les repas futurs sont recalibrés automatiquement à partir du protocole partagé. Le client ne voit que le résultat final dans son plan.</p>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => router.push("/coach/documentation/nutrition-smoothing")}
                className="text-[11px] font-medium text-[#b8efd9] transition-colors hover:text-white"
              >
                Ouvrir la documentation complète
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-3">
          {loading ? (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-[11px] text-white/45">
              Chargement du lissage…
            </div>
          ) : state ? (
            <div className="space-y-3">
              {(activePlan || recommendation?.eligible) ? (
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      Répartition
                    </label>
                    <select
                      value={selectedDays}
                      onChange={(event) => setSelectedDays(Number(event.target.value) as SmoothingDurationOption)}
                      className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-[#101010] px-3 text-[12px] text-white outline-none"
                    >
                      {DURATION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} jours
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      Note interne coach
                    </label>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Intention coach, contexte, repas concernés…"
                      className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#101010] px-3 py-2 text-[12px] text-white outline-none placeholder:text-white/28"
                    />
                  </div>
                </div>
              ) : null}

              {distributionSentence ? (
                <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                  <p className="text-[11px] leading-relaxed text-white/60">
                    {distributionSentence}
                  </p>
                  {state.previewDays.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {state.previewDays.map((day) => (
                        <div
                          key={`impact-${day.date}`}
                          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/68"
                        >
                          {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {day.kcalDelta > 0 ? "+" : ""}
                          {Math.round(day.kcalDelta)} kcal
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {effectiveDate ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => router.push(`/coach/clients/${clientId}/data/nutrition?focusDate=${effectiveDate}`)}
                        className="text-[11px] font-medium text-white/52 transition-colors hover:text-white/78"
                      >
                        Voir la journée détectée
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {state.previewDays.length > 0 ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {state.previewDays.map((day) => (
                    <div key={day.date} className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">
                            {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                          <p className="mt-1 text-[12px] font-semibold text-white">{day.label}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-white/78">
                          {day.baseTargetKcal} → {day.adjustedTargetKcal} kcal
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-white/55">
                        {day.hasCoachPlan
                          ? `Plan ajusté à ${(day.scalingRatio * 100).toFixed(0)}% sur ${day.meals.length} repas.`
                          : "Aucun repas coach à recalibrer sur ce jour."}
                      </p>
                      {day.meals.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {day.meals.map((meal) => (
                            <div key={`${day.date}-${meal.mealId}`} className="flex items-center justify-between text-[11px] text-white/65">
                              <span>{meal.title}</span>
                              <span>{meal.baseCalories} → {meal.adjustedCalories} kcal</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {(recommendation?.eligible || activePlan) ? (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy !== null}
                    className="rounded-xl bg-[#1f8a65] px-4 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                  >
                    {busy === "apply" || busy === "replace"
                      ? "Application…"
                      : activePlan
                        ? "Mettre à jour le lissage"
                        : "Appliquer au plan client"}
                  </button>
                ) : null}
                {activePlan ? (
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    disabled={busy !== null}
                    className="rounded-xl bg-white/[0.06] px-4 py-2 text-[11px] font-semibold text-white/72 disabled:opacity-60"
                  >
                    {busy === "cancel" ? "Annulation…" : "Annuler"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3 text-[11px] text-white/45">
              Aucune recommandation de lissage pour cette journée.
            </div>
          )}
        </div>
      ) : (
        null
      )}
    </section>
  )
}
