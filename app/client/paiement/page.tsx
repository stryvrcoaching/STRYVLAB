"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import ClientTopBar from "@/components/client/ClientTopBar"
import { useClientT } from "@/components/client/ClientI18nProvider"
import { DashboardSignalCard } from "@/components/client/smart/DashboardSignalCard"

type PaymentDetails = {
  id: string | null
  amount_eur: number
  status: string
  description: string
  formula_name: string | null
  due_date: string | null
  subscription_id: string | null
  formula_id: string | null
}

type CoachInfo = {
  fullName: string | null
  avatarUrl: string | null
}

/**
 * Client payment screen.
 * - Never embeds a pre-generated Stripe URL (they expire / break in PWA).
 * - Mints a fresh Checkout Session on CTA, then opens Stripe outside the app shell.
 */
function ClientPaymentPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useClientT()

  const paymentId = searchParams.get("payment_id")
  const subscriptionId = searchParams.get("subscription_id")
  const formulaId = searchParams.get("formula_id")
  const stripeStatus = searchParams.get("stripe")

  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [coach, setCoach] = useState<CoachInfo | null>(null)
  const [banner, setBanner] = useState<"success" | "cancelled" | null>(
    stripeStatus === "success"
      ? "success"
      : stripeStatus === "cancelled"
        ? "cancelled"
        : null,
  )

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (paymentId) params.set("payment_id", paymentId)
    if (subscriptionId) params.set("subscription_id", subscriptionId)
    if (formulaId) params.set("formula_id", formulaId)
    return params.toString()
  }, [formulaId, paymentId, subscriptionId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/client/payments/pending${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Impossible de charger le paiement")
      }
      setPayment(data.payment)
      setCoach(data.coach)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  // Clean stripe query from URL after reading banner state
  useEffect(() => {
    if (!stripeStatus) return
    const url = new URL(window.location.href)
    url.searchParams.delete("stripe")
    window.history.replaceState({}, "", `${url.pathname}${url.search}`)
  }, [stripeStatus])

  async function handlePay() {
    if (!payment || payment.status === "paid") return
    setPaying(true)
    setError(null)

    try {
      const res = await fetch("/api/client/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: payment.id,
          subscription_id: payment.subscription_id ?? subscriptionId,
          formula_id: payment.formula_id ?? formulaId,
        }),
      })
      const data = await res.json()

      if (res.status === 409 && data.already_paid) {
        setBanner("success")
        setPayment((prev) => (prev ? { ...prev, status: "paid" } : prev))
        return
      }

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Impossible d’ouvrir Stripe")
      }

      // Open Checkout outside the PWA shell when possible — standalone WebViews
      // often break Stripe (cookies, Apple Pay, redirects).
      const opened = window.open(data.url, "_blank", "noopener,noreferrer")
      if (!opened) {
        // Popup blocked (common in iOS standalone): navigate top-level.
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setPaying(false)
    }
  }

  const amountLabel = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(payment?.amount_eur ?? 0)

  const isPaid = payment?.status === "paid" || banner === "success"

  return (
    <div className="min-h-dvh bg-[#121212] text-white">
      <ClientTopBar title={t("paiement.title")} backHref="/client" />

      <main
        className="client-page-top mx-auto flex w-full max-w-xl flex-col gap-4 px-4"
        style={{
          paddingBottom:
            "calc(var(--client-bottom-nav-reserved) + var(--client-bottom-nav-fade, 40px) + 16px)",
        }}
      >
        {banner === "success" && (
          <DashboardSignalCard
            body="Ton coach a été notifié. Merci pour ta confiance."
            eyebrow="Paiement"
            icon={CheckCircle}
            label="OK"
            onDismiss={() => setBanner(null)}
            title="Paiement confirmé"
            tone="success"
          />
        )}

        {banner === "cancelled" && (
          <DashboardSignalCard
            body="Tu peux réessayer quand tu veux. En cas de souci, contacte ton coach."
            eyebrow="Paiement"
            icon={AlertCircle}
            label="Annulé"
            onDismiss={() => setBanner(null)}
            title="Paiement annulé"
            tone="warning"
          />
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-white/40">
            <Loader2 className="animate-spin text-[#1f8a65]" size={28} />
            <p className="text-xs font-semibold">Chargement du règlement…</p>
          </div>
        ) : error && !payment ? (
          <div className="rounded-[24px] border border-red-500/20 bg-red-950/20 p-5 text-sm text-red-300">
            {error}
          </div>
        ) : !payment ? (
          <div className="rounded-[24px] border border-white/[0.04] bg-[#09090a] p-6 text-center">
            <CreditCard className="mx-auto text-white/25" size={28} />
            <p className="mt-3 text-[15px] font-semibold text-white">
              Aucun paiement en attente
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/45">
              Quand ton coach t’enverra une demande de règlement, elle
              apparaîtra ici.
            </p>
            <button
              type="button"
              onClick={() => router.push("/client")}
              className="mt-5 h-11 w-full rounded-2xl bg-white/[0.06] text-[13px] font-bold text-white"
            >
              Retour à l’accueil
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-[24px] border border-white/[0.04] bg-[#09090a] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                Demande de règlement
              </p>
              {coach?.fullName && (
                <p className="mt-2 text-[13px] text-white/55">
                  Coach{" "}
                  <span className="font-semibold text-white/80">
                    {coach.fullName}
                  </span>
                </p>
              )}
              <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-white">
                {payment.description}
              </h1>
              <p className="mt-4 text-[36px] font-bold tabular-nums tracking-tight text-white">
                {amountLabel}
              </p>
              {payment.due_date && (
                <p className="mt-2 text-[12px] text-white/40">
                  Échéance{" "}
                  {new Date(payment.due_date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPaid ? "bg-[#5dba87]" : "bg-amber-400"
                  }`}
                />
                {isPaid ? "Payé" : "En attente"}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/[0.04] bg-[#09090a] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1f8a65]/10 text-[#5dba87]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    Paiement sécurisé Stripe
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                    Tu seras redirigé vers la page Stripe de ton coach. STRYVR
                    ne stocke pas tes coordonnées bancaires.
                  </p>
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-[12px] text-red-300">
                {error}
              </div>
            )}

            {!isPaid ? (
              <button
                type="button"
                onClick={() => void handlePay()}
                disabled={paying}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1f8a65] text-[14px] font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-50 active:scale-[0.99]"
              >
                {paying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ouverture de Stripe…
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} />
                    Payer {amountLabel}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/client")}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-[14px] font-bold text-white"
              >
                Retour à l’accueil
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function ClientPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--client-chrome-bg,#0a0a0a)]">
          <Loader2 className="animate-spin text-[#1f8a65]" size={28} />
        </div>
      }
    >
      <ClientPaymentPageInner />
    </Suspense>
  )
}
