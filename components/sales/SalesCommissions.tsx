'use client'

import { useEffect, useState } from 'react'
import {
  CircleDollarSign,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2
} from 'lucide-react'

type Commission = {
  id: string
  amount_eur: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  description: string
  eligible_at: string | null
  approved_at: string | null
  paid_at: string | null
  created_at: string
}

type StripeStatus = {
  status: 'not_connected' | 'pending' | 'ready' | 'restricted' | 'disabled'
  requirementsDue?: string[]
  accountId?: string | null
}

const statusLabels: Record<Commission['status'], string> = {
  pending: 'En attente',
  approved: 'Validée',
  paid: 'Versée',
  cancelled: 'Annulée'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
    : 'Date à confirmer'
}

export function SalesCommissions() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [stripeLoading, setStripeLoading] = useState(true)
  const [connectingStripe, setConnectingStripe] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/sales/commissions', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Chargement impossible')
      setCommissions(payload.commissions ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  async function loadStripeStatus() {
    setStripeLoading(true)
    try {
      const response = await fetch('/api/sales/connect/status')
      const payload = await response.json().catch(() => null)
      if (response.ok && payload) {
        setStripeStatus(payload)
      }
    } catch (err) {
      console.error('[stripe-status] Failed to fetch:', err)
    } finally {
      setStripeLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    void loadStripeStatus()
  }, [])

  async function connectStripe() {
    setConnectingStripe(true)
    try {
      const response = await fetch('/api/sales/connect/onboard', { method: 'POST' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'Création de la connexion impossible.')
      if (payload.url) {
        window.location.href = payload.url
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setConnectingStripe(false)
    }
  }

  const pending = commissions
    .filter((commission) => commission.status === 'pending' || commission.status === 'approved')
    .reduce((total, commission) => total + Number(commission.amount_eur), 0)

  const paid = commissions
    .filter((commission) => commission.status === 'paid')
    .reduce((total, commission) => total + Number(commission.amount_eur), 0)

  return (
    <div className="space-y-7">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Rémunération</p>
        <h1 className="mt-2 font-barlow text-4xl font-semibold uppercase leading-none tracking-[-0.04em] sm:text-5xl">
          Vos commissions
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">
          Gérez votre moyen de versement et suivez en temps réel la validation et le paiement de vos commissions Connect.
        </p>
      </section>

      {/* Stripe Connect Section */}
      <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-[#c6b48b]" />
              <h2 className="text-[14px] font-semibold text-white">Versement automatique par Stripe Connect</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/50">
              Liez un compte bancaire en 2 minutes via Stripe pour recevoir vos commissions automatiquement par virement instantané dès leur validation.
            </p>
          </div>

          <div className="shrink-0">
            {stripeLoading ? (
              <div className="h-9 w-32 animate-pulse rounded-xl bg-white/[0.05]" />
            ) : stripeStatus?.status === 'ready' ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-emerald-200">
                <CheckCircle2 size={15} />
                <span className="text-[10px] font-bold uppercase tracking-[0.08em]">Opérationnel</span>
              </div>
            ) : stripeStatus?.status === 'pending' || stripeStatus?.status === 'restricted' ? (
              <button
                disabled={connectingStripe}
                onClick={connectStripe}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#c6b48b]/10 border border-[#c6b48b]/30 px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#c6b48b] hover:bg-[#c6b48b]/20 transition disabled:opacity-50"
              >
                {connectingStripe ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                Finaliser Stripe
              </button>
            ) : (
              <button
                disabled={connectingStripe}
                onClick={connectStripe}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#111315] hover:bg-white transition disabled:opacity-50"
              >
                {connectingStripe ? <Loader2 size={13} className="animate-spin" /> : null}
                Connecter Stripe
              </button>
            )}
          </div>
        </div>

        {!stripeLoading && stripeStatus?.requirementsDue && stripeStatus.requirementsDue.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-400/[0.04] p-3 text-[11px] leading-relaxed text-amber-200/80">
            <p className="font-semibold text-amber-200 flex items-center gap-1.5 mb-1">
              <AlertTriangle size={13} /> Actions requises par Stripe :
            </p>
            <ul className="list-disc list-inside pl-1 space-y-0.5">
              {stripeStatus.requirementsDue.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="h-48 animate-pulse rounded-[24px] bg-white/[0.03]" />
      ) : error ? (
        <div className="rounded-[24px] border border-red-300/15 bg-red-400/[0.07] p-5">
          <p className="text-sm text-red-100">{error}</p>
          <button
            onClick={() => void loadData()}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white"
          >
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <CircleDollarSign size={17} className="text-white/60" />
              <p className="mt-5 text-3xl font-semibold tracking-tight">{formatCurrency(pending)}</p>
              <p className="mt-1 text-[12px] text-white/58">À venir ou validées</p>
            </article>

            <article className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <CircleDollarSign size={17} className="text-emerald-300" />
              <p className="mt-5 text-3xl font-semibold tracking-tight">{formatCurrency(paid)}</p>
              <p className="mt-1 text-[12px] text-white/58">Déjà versées</p>
            </article>
          </section>

          <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.025]">
            {commissions.length ? (
              commissions.map((commission) => (
                <article
                  key={commission.id}
                  className="flex flex-col gap-3 border-b border-white/[0.055] px-5 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-white/88 truncate">{commission.description}</p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {commission.status === 'paid'
                        ? `Versée le ${formatDate(commission.paid_at)}`
                        : commission.status === 'approved'
                        ? `Validée le ${formatDate(commission.approved_at)}`
                        : `Éligibilité : ${formatDate(commission.eligible_at)}`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        commission.status === 'paid'
                          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                          : commission.status === 'cancelled'
                          ? 'border-red-300/15 bg-red-400/5 text-red-200'
                          : 'border-white/[0.14] bg-white/[0.06] text-white/70'
                      }`}
                    >
                      {statusLabels[commission.status]}
                    </span>
                    <span className="min-w-20 text-right text-[15px] font-semibold text-white">
                      {formatCurrency(Number(commission.amount_eur))}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-white/72">Aucune commission pour le moment.</p>
                <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-white/42">
                  Les commissions apparaîtront lorsque STRYV les aura enregistrées puis validées selon votre accord commercial.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
