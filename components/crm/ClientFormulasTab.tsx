'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Plus, X, Loader2, Check,
  ChevronDown, Euro, Calendar, Clock,
  CheckCircle2, Pause, Ban, RotateCcw, Receipt, ExternalLink,
  ArrowLeft, Send, Download, Bell,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────────────────────────

type Formula = {
  id: string
  name: string
  description?: string | null
  price_eur: number
  billing_cycle: string
  duration_months?: number | null
  features: string[]
  color: string
  is_active: boolean
}

type Subscription = {
  id: string
  status: string
  formula_id: string
  start_date: string
  end_date?: string | null
  next_billing_date?: string | null
  price_override_eur?: number | null
  notes?: string | null
  formula: Formula | null
}

type Payment = {
  id: string
  amount_eur: number
  status: string
  payment_method: string
  payment_date: string
  due_date?: string | null
  description?: string | null
  reference?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  one_time: 'Paiement unique', weekly: '/semaine', monthly: '/mois',
  quarterly: '/trimestre', yearly: '/an',
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; textCls: string; dotCls: string }> = {
  active:    { label: 'Actif',    icon: CheckCircle2, textCls: 'text-[#1f8a65]',  dotCls: 'bg-[#1f8a65]'  },
  trial:     { label: 'Essai',    icon: Clock,        textCls: 'text-blue-400',   dotCls: 'bg-blue-400'   },
  paused:    { label: 'Pausé',    icon: Pause,        textCls: 'text-amber-400',  dotCls: 'bg-amber-400'  },
  cancelled: { label: 'Annulé',  icon: Ban,          textCls: 'text-red-400',    dotCls: 'bg-red-400'    },
  expired:   { label: 'Expiré',  icon: RotateCcw,    textCls: 'text-white/40',   dotCls: 'bg-white/30'   },
}

const PAYMENT_STATUS: Record<string, { label: string; textCls: string }> = {
  paid:     { label: 'Payé',       textCls: 'text-[#1f8a65]'  },
  pending:  { label: 'En attente', textCls: 'text-amber-400'  },
  failed:   { label: 'Échoué',    textCls: 'text-red-400'    },
  refunded: { label: 'Remboursé', textCls: 'text-white/40'   },
}

const METHOD_LABELS: Record<string, string> = {
  manual: 'Manuel', bank_transfer: 'Virement', card: 'Carte',
  cash: 'Espèces', stripe: 'Stripe', other: 'Autre',
}

// ── Shared field classes ───────────────────────────────────────────────────────

const inputCls = 'w-full h-10 px-3 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none placeholder:text-white/20'
const selectCls = 'w-full h-10 px-3 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none'

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientFormulasTab({ clientId }: { clientId: string }) {

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [allFormulas, setAllFormulas] = useState<Formula[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)

  const [showAddSub, setShowAddSub] = useState(false)
  const [subStep, setSubStep] = useState<1 | 2>(1)
  const [showAddPayment, setShowAddPayment] = useState<string | null>(null)
  const [showCreateFormula, setShowCreateFormula] = useState(false)

  const [subForm, setSubForm] = useState({
    formula_id: '', status: 'active', start_date: new Date().toISOString().split('T')[0],
    end_date: '', next_billing_date: '', price_override_eur: '', notes: '',
  })
  const [subSaving, setSubSaving] = useState(false)

  // Step 2 — first payment
  type PaymentStatus = 'paid' | 'pending' | 'free'
  const [firstPayStatus, setFirstPayStatus] = useState<PaymentStatus>('paid')
  const [firstPayMethod, setFirstPayMethod] = useState('bank_transfer')
  const [firstPayDate, setFirstPayDate] = useState(new Date().toISOString().split('T')[0])
  const [firstPaySendReceipt, setFirstPaySendReceipt] = useState(false)

  const [payForm, setPayForm] = useState({
    amount_eur: '', status: 'paid', payment_method: 'manual',
    payment_date: new Date().toISOString().split('T')[0],
    due_date: '', description: '', reference: '',
  })
  const [paySaving, setPaySaving] = useState(false)
  const [stripeLoading, setStripeLoading] = useState<string | null>(null)

  const [formulaForm, setFormulaForm] = useState({
    name: '', description: '', price_eur: '', billing_cycle: 'monthly',
    duration_months: '', features: '', color: '#6366f1',
  })
  const [formulaSaving, setFormulaSaving] = useState(false)

  // Invoice / reminder actions
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [remindLoading, setRemindLoading] = useState<string | null>(null)
  const [actionToast, setActionToast] = useState<string | null>(null)

  function showActionToast(msg: string) {
    setActionToast(msg)
    setTimeout(() => setActionToast(null), 3000)
  }

  async function downloadInvoice(paymentId: string) {
    setInvoiceLoading(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: false }),
      })
      if (!res.ok) { showActionToast('Erreur génération PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recu-${paymentId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setInvoiceLoading(null)
    }
  }

  async function sendInvoiceByEmail(paymentId: string) {
    setInvoiceLoading(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendEmail: true }),
      })
      if (res.ok) showActionToast('Reçu envoyé au client')
      else showActionToast('Erreur envoi reçu')
    } finally {
      setInvoiceLoading(null)
    }
  }

  async function sendReminder(paymentId: string) {
    setRemindLoading(paymentId)
    try {
      const res = await fetch(`/api/payments/${paymentId}/remind`, { method: 'POST' })
      if (res.ok) showActionToast('Rappel envoyé au client')
      else {
        const d = await res.json()
        showActionToast(d.error ?? 'Erreur envoi rappel')
      }
    } finally {
      setRemindLoading(null)
    }
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [subsRes, formulasRes, paymentsRes] = await Promise.all([
      fetch(`/api/clients/${clientId}/subscriptions`),
      fetch('/api/formulas'),
      fetch(`/api/payments?client_id=${clientId}`),
    ])
    if (subsRes.ok) setSubscriptions((await subsRes.json()).subscriptions ?? [])
    if (formulasRes.ok) setAllFormulas((await formulasRes.json()).formulas ?? [])
    if (paymentsRes.ok) setPayments((await paymentsRes.json()).payments ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  // ── Actions ────────────────────────────────────────────────────────────────

  function resetSubModal() {
    setShowAddSub(false)
    setSubStep(1)
    setSubForm({ formula_id: '', status: 'active', start_date: new Date().toISOString().split('T')[0], end_date: '', next_billing_date: '', price_override_eur: '', notes: '' })
    setFirstPayStatus('paid')
    setFirstPayMethod('bank_transfer')
    setFirstPayDate(new Date().toISOString().split('T')[0])
    setFirstPaySendReceipt(false)
  }

  function handleSubStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!subForm.formula_id) return
    setSubStep(2)
  }

  async function handleSubStep2(e: React.FormEvent) {
    e.preventDefault()
    setSubSaving(true)

    // Calculate next billing date if not set — 1 month after start
    let nextBillingDate = subForm.next_billing_date || null
    if (!nextBillingDate && selectedFormula?.billing_cycle === 'monthly') {
      const start = new Date(subForm.start_date)
      start.setMonth(start.getMonth() + 1)
      nextBillingDate = start.toISOString().split('T')[0]
    }

    const subRes = await fetch(`/api/clients/${clientId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...subForm,
        price_override_eur: subForm.price_override_eur ? parseFloat(subForm.price_override_eur) : null,
        end_date: subForm.end_date || null,
        next_billing_date: nextBillingDate,
        notes: subForm.notes || null,
      }),
    })

    if (!subRes.ok) { setSubSaving(false); return }
    const { subscription } = await subRes.json()
    setSubscriptions(prev => [subscription, ...prev])

    // Register first payment if not "pending"
    if (firstPayStatus !== 'pending') {
      const amount = subForm.price_override_eur
        ? parseFloat(subForm.price_override_eur)
        : selectedFormula?.price_eur ?? 0

      const payRes = await fetch(`/api/subscriptions/${subscription.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          amount_eur: firstPayStatus === 'free' ? 0 : amount,
          status: 'paid',
          payment_method: firstPayStatus === 'free' ? 'manual' : firstPayMethod,
          payment_date: firstPayDate,
          description: firstPayStatus === 'free'
            ? `${selectedFormula?.name ?? 'Formule'} (offert)`
            : selectedFormula?.name ?? null,
        }),
      })

      if (payRes.ok) {
        const { payment } = await payRes.json()
        setPayments(prev => [payment, ...prev])

        // Send receipt PDF by email if requested
        if (firstPaySendReceipt && firstPayStatus === 'paid' && payment?.id) {
          await fetch(`/api/payments/${payment.id}/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sendEmail: true }),
          })
        }
      }
    }

    setSubSaving(false)
    resetSubModal()
  }

  const selectedFormula = allFormulas.find(f => f.id === subForm.formula_id) ?? null

  async function cancelSubscription(subId: string) {
    const res = await fetch(`/api/subscriptions/${subId}`, { method: 'DELETE' })
    if (res.ok) setSubscriptions(prev => prev.map(s => s.id === subId ? { ...s, status: 'cancelled' } : s))
  }

  async function sendStripeCheckout(sub: Subscription) {
    if (!sub.formula) return
    setStripeLoading(sub.id)
    try {
      const res = await fetch('/api/stripe/coaching/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, subscription_id: sub.id, formula_id: sub.formula_id }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Erreur Stripe'); return }
      window.open(data.url, '_blank')
    } catch { alert('Erreur réseau') }
    finally { setStripeLoading(null) }
  }

  async function addPayment(e: React.FormEvent, subId: string) {
    e.preventDefault()
    if (!payForm.amount_eur) return
    setPaySaving(true)
    const res = await fetch(`/api/subscriptions/${subId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        amount_eur: parseFloat(payForm.amount_eur),
        status: payForm.status,
        payment_method: payForm.payment_method,
        payment_date: payForm.payment_date,
        due_date: payForm.due_date || null,
        description: payForm.description || null,
        reference: payForm.reference || null,
      }),
    })
    if (res.ok) {
      const { payment } = await res.json()
      setPayments(prev => [payment, ...prev])
      setShowAddPayment(null)
      setPayForm({ amount_eur: '', status: 'paid', payment_method: 'manual', payment_date: new Date().toISOString().split('T')[0], due_date: '', description: '', reference: '' })
    }
    setPaySaving(false)
  }

  async function createFormula(e: React.FormEvent) {
    e.preventDefault()
    setFormulaSaving(true)
    const res = await fetch('/api/formulas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formulaForm.name,
        description: formulaForm.description || null,
        price_eur: parseFloat(formulaForm.price_eur) || 0,
        billing_cycle: formulaForm.billing_cycle,
        duration_months: formulaForm.duration_months ? parseInt(formulaForm.duration_months) : null,
        features: formulaForm.features.split('\n').filter(f => f.trim()),
        color: formulaForm.color,
      }),
    })
    if (res.ok) {
      const { formula } = await res.json()
      setAllFormulas(prev => [formula, ...prev])
      setShowCreateFormula(false)
      setFormulaForm({ name: '', description: '', price_eur: '', billing_cycle: 'monthly', duration_months: '', features: '', color: '#6366f1' })
    }
    setFormulaSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-[#181818] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
        <div className="bg-[#181818] rounded-xl p-5 space-y-4">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-2/3 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Subscriptions ───────────────────────────────────────────────────── */}
      <div className="bg-[#181818] rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-white/40" />
            <h3 className="text-sm font-bold text-white">Formules souscrites</h3>
          </div>
          <button
            onClick={() => setShowAddSub(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-white/45 hover:text-white transition-colors"
          >
            <Plus size={13} />
            Ajouter
          </button>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard size={24} className="text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/30 italic mb-3">Aucune formule souscrite</p>
            <button onClick={() => setShowAddSub(true)}
              className="text-xs font-semibold text-[#1f8a65] hover:text-white transition-colors">
              + Assigner une formule
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {subscriptions.map(sub => {
              const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.active
              const StatusIcon = cfg.icon
              const price = sub.price_override_eur ?? sub.formula?.price_eur ?? 0
              const isExpanded = expandedSub === sub.id

              return (
                <div key={sub.id} className="rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between p-4 bg-white/[0.04] cursor-pointer hover:bg-white/[0.06] transition-colors"
                    onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.formula?.color ?? '#6366f1' }} />
                      <div>
                        <p className="text-sm font-bold text-white">{sub.formula?.name ?? 'Formule inconnue'}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          Depuis le {new Date(sub.start_date).toLocaleDateString('fr-FR')}
                          {sub.end_date && ` → ${new Date(sub.end_date).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black text-white font-mono">
                        {price.toFixed(2)} €
                        <span className="text-[11px] font-normal text-white/40 ml-1">
                          {BILLING_LABELS[sub.formula?.billing_cycle ?? 'monthly']}
                        </span>
                      </p>
                      <span className={`flex items-center gap-1 text-[11px] font-semibold bg-white/[0.04] px-2 py-0.5 rounded-full ${cfg.textCls}`}>
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                      <ChevronDown size={14} className={`text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 bg-white/[0.02] space-y-4">
                      <div className="h-px bg-white/[0.07]" />

                      {/* Features */}
                      {sub.formula?.features && sub.formula.features.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">Inclus</p>
                          <ul className="space-y-1">
                            {sub.formula.features.map((f, i) => (
                              <li key={i} className="flex items-center gap-2 text-[12px] text-white/60">
                                <Check size={11} className="text-[#1f8a65] shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next billing */}
                      {sub.next_billing_date && sub.status === 'active' && (
                        <div className="flex items-center gap-2 text-[12px] text-white/50 bg-white/[0.03] rounded-lg px-3 py-2">
                          <Calendar size={12} className="text-white/40 shrink-0" />
                          Prochain paiement le <span className="font-semibold text-white/80">{new Date(sub.next_billing_date).toLocaleDateString('fr-FR')}</span>
                        </div>
                      )}

                      {/* Notes */}
                      {sub.notes && (
                        <p className="text-[12px] text-white/45 italic">{sub.notes}</p>
                      )}

                      {/* Actions */}
                      {sub.status === 'active' && (
                        <div className="flex flex-wrap gap-2">
                          {sub.formula?.billing_cycle !== 'one_time' && (
                            <button
                              onClick={() => sendStripeCheckout(sub)}
                              disabled={stripeLoading === sub.id}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#635BFF]/80 hover:bg-[#635BFF] rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
                            >
                              {stripeLoading === sub.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <ExternalLink size={12} />
                              }
                              Lien Stripe
                            </button>
                          )}
                          <button
                            onClick={() => setShowAddPayment(sub.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1f8a65] hover:bg-[#217356] rounded-lg px-3 py-2 transition-colors"
                          >
                            <Euro size={12} />
                            Paiement manuel
                          </button>
                          <button
                            onClick={() => cancelSubscription(sub.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg px-3 py-2 transition-colors"
                          >
                            <X size={12} />
                            Résilier
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Payments history ─────────────────────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="bg-[#181818] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Receipt size={14} className="text-white/40" />
            <h3 className="text-sm font-bold text-white">Historique des paiements</h3>
          </div>
          <div className="space-y-2">
            {payments.map(payment => {
              const pCfg = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending
              const dotCls = payment.status === 'paid' ? 'bg-[#1f8a65]' : payment.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'
              const isPaid = payment.status === 'paid'
              const isPending = payment.status === 'pending'
              return (
                <div key={payment.id} className="rounded-xl bg-white/[0.04] overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                      <div>
                        <p className="text-[13px] font-semibold text-white">{payment.description || METHOD_LABELS[payment.payment_method]}</p>
                        <p className="text-[11px] text-white/40 mt-0.5">
                          {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                          {payment.reference && <span className="ml-2">Réf. {payment.reference}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-semibold ${pCfg.textCls}`}>{pCfg.label}</span>
                      <p className="text-sm font-black text-white font-mono">{Number(payment.amount_eur).toFixed(2)} €</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {(isPaid || isPending) && (
                    <div className="flex items-center gap-1.5 px-3 pb-3">
                      {isPaid && (
                        <>
                          <button
                            onClick={() => downloadInvoice(payment.id)}
                            disabled={invoiceLoading === payment.id}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                          >
                            {invoiceLoading === payment.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                            Télécharger reçu
                          </button>
                          <button
                            onClick={() => sendInvoiceByEmail(payment.id)}
                            disabled={invoiceLoading === payment.id}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                          >
                            {invoiceLoading === payment.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                            Envoyer reçu
                          </button>
                        </>
                      )}
                      {isPending && (
                        <button
                          onClick={() => sendReminder(payment.id)}
                          disabled={remindLoading === payment.id}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400/70 hover:text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                        >
                          {remindLoading === payment.id ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
                          Envoyer rappel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Action toast ─────────────────────────────────────────────────────── */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#181818] rounded-xl text-sm font-semibold text-white shadow-lg">
          {actionToast}
        </div>
      )}

      {/* ── MODAL: Assign formula — 2-step stepper ───────────────────────────── */}
      {showAddSub && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                {subStep === 2 && (
                  <button onClick={() => setSubStep(1)}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors">
                    <ArrowLeft size={13} />
                  </button>
                )}
                <h3 className="text-sm font-bold text-white">
                  {subStep === 1 ? 'Assigner une formule' : 'Premier paiement'}
                </h3>
              </div>
              <button onClick={resetSubModal}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors">
                <X size={13} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2">
                <div className={`flex-1 h-1 rounded-full transition-colors ${subStep >= 1 ? 'bg-[#1f8a65]' : 'bg-white/[0.08]'}`} />
                <div className={`flex-1 h-1 rounded-full transition-colors ${subStep >= 2 ? 'bg-[#1f8a65]' : 'bg-white/[0.08]'}`} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className={`text-[10px] font-semibold ${subStep >= 1 ? 'text-[#1f8a65]' : 'text-white/30'}`}>Formule</span>
                <span className={`text-[10px] font-semibold ${subStep >= 2 ? 'text-[#1f8a65]' : 'text-white/30'}`}>Paiement</span>
              </div>
            </div>

            <div className="h-px bg-white/[0.07]" />

            {/* Step 1 — Formule */}
            {subStep === 1 && (
              <form onSubmit={handleSubStep1} className="p-5 space-y-4">
                <FormField label="Formule *">
                  <div className="flex gap-2">
                    <select required value={subForm.formula_id} onChange={e => setSubForm(f => ({ ...f, formula_id: e.target.value }))}
                      className="flex-1 h-10 px-3 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none">
                      <option value="">— Choisir une formule</option>
                      {allFormulas.filter(f => f.is_active).map(f => (
                        <option key={f.id} value={f.id}>{f.name} — {f.price_eur} €{BILLING_LABELS[f.billing_cycle]}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setShowCreateFormula(true)}
                      className="h-10 px-3 bg-white/[0.06] hover:bg-white/[0.10] rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Statut">
                    <select value={subForm.status} onChange={e => setSubForm(f => ({ ...f, status: e.target.value }))}
                      className={selectCls}>
                      <option value="active">Actif</option>
                      <option value="trial">Essai</option>
                      <option value="paused">Pausé</option>
                    </select>
                  </FormField>
                  <FormField label="Prix personnalisé (€)">
                    <input type="number" step="0.01" placeholder="Laisser vide = prix formule"
                      value={subForm.price_override_eur} onChange={e => setSubForm(f => ({ ...f, price_override_eur: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Date de début">
                    <input type="date" value={subForm.start_date} onChange={e => setSubForm(f => ({ ...f, start_date: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                  <FormField label="Prochain paiement">
                    <input type="date" value={subForm.next_billing_date} onChange={e => setSubForm(f => ({ ...f, next_billing_date: e.target.value }))}
                      className={inputCls} />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <textarea value={subForm.notes} onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Conditions particulières..."
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none resize-none placeholder:text-white/20" />
                </FormField>
                <button type="submit" disabled={!subForm.formula_id}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-colors">
                  Suivant →
                </button>
              </form>
            )}

            {/* Step 2 — Premier paiement */}
            {subStep === 2 && (
              <form onSubmit={handleSubStep2} className="p-5 space-y-5">
                {/* Récap formule */}
                {selectedFormula && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedFormula.color }} />
                      <span className="text-sm font-semibold text-white">{selectedFormula.name}</span>
                    </div>
                    <span className="text-sm font-black text-white font-mono">
                      {(subForm.price_override_eur ? parseFloat(subForm.price_override_eur) : selectedFormula.price_eur).toFixed(2)} €
                      <span className="text-[11px] font-normal text-white/40 ml-1">{BILLING_LABELS[selectedFormula.billing_cycle]}</span>
                    </span>
                  </div>
                )}

                {/* Statut paiement */}
                <div>
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">Premier paiement</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'paid', label: 'Payé', color: 'text-[#1f8a65]', bg: 'bg-[#1f8a65]/10' },
                      { value: 'pending', label: 'En attente', color: 'text-amber-400', bg: 'bg-amber-400/10' },
                      { value: 'free', label: 'Offert', color: 'text-white/60', bg: 'bg-white/[0.06]' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFirstPayStatus(opt.value)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${firstPayStatus === opt.value ? `${opt.bg} ${opt.color}` : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07]'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Champs si payé */}
                {firstPayStatus === 'paid' && (
                  <>
                    <div>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em] mb-2">Méthode</p>
                      <div className="flex flex-wrap gap-2">
                        {([
                          { value: 'bank_transfer', label: 'Virement' },
                          { value: 'cash', label: 'Espèces' },
                          { value: 'card', label: 'Carte' },
                          { value: 'stripe', label: 'Stripe' },
                          { value: 'other', label: 'Autre' },
                        ]).map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setFirstPayMethod(m.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${firstPayMethod === m.value ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/60'}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormField label="Date de paiement">
                      <input type="date" value={firstPayDate} onChange={e => setFirstPayDate(e.target.value)}
                        className={inputCls} />
                    </FormField>

                    {/* Send receipt checkbox */}
                    <button
                      type="button"
                      onClick={() => setFirstPaySendReceipt(v => !v)}
                      className="flex items-center gap-2.5 w-full text-left"
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${firstPaySendReceipt ? 'bg-[#1f8a65]' : 'bg-white/[0.08]'}`}>
                        {firstPaySendReceipt && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-xs text-white/60">Envoyer le reçu au client par email</span>
                    </button>
                  </>
                )}

                {firstPayStatus === 'pending' && (
                  <div className="px-3 py-3 rounded-xl bg-amber-400/5 text-xs text-amber-400/80">
                    Le paiement sera enregistré en attente. Un rappel automatique sera envoyé J-3 avant l&apos;échéance.
                  </div>
                )}

                {firstPayStatus === 'free' && (
                  <div className="px-3 py-3 rounded-xl bg-white/[0.03] text-xs text-white/45">
                    La formule sera assignée sans enregistrer de paiement.
                  </div>
                )}

                <button type="submit" disabled={subSaving}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-colors">
                  {subSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirmer
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: Add payment ───────────────────────────────────────────────── */}
      {showAddPayment && (
        <Modal title="Enregistrer un paiement" onClose={() => setShowAddPayment(null)}>
          <form onSubmit={e => addPayment(e, showAddPayment)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Montant (€) *">
                <input type="number" step="0.01" required placeholder="0.00"
                  value={payForm.amount_eur} onChange={e => setPayForm(f => ({ ...f, amount_eur: e.target.value }))}
                  className={`${inputCls} font-mono`} />
              </FormField>
              <FormField label="Statut">
                <select value={payForm.status} onChange={e => setPayForm(f => ({ ...f, status: e.target.value }))}
                  className={selectCls}>
                  <option value="paid">Payé</option>
                  <option value="pending">En attente</option>
                  <option value="failed">Échoué</option>
                </select>
              </FormField>
              <FormField label="Méthode">
                <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}
                  className={selectCls}>
                  <option value="manual">Manuel</option>
                  <option value="bank_transfer">Virement</option>
                  <option value="card">Carte</option>
                  <option value="cash">Espèces</option>
                </select>
              </FormField>
              <FormField label="Date de paiement">
                <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                  className={inputCls} />
              </FormField>
            </div>
            <FormField label="Description">
              <input type="text" placeholder="Ex: Coaching Novembre" value={payForm.description}
                onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))}
                className={inputCls} />
            </FormField>
            <FormField label="Référence">
              <input type="text" placeholder="N° de facture, réf. virement..." value={payForm.reference}
                onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                className={inputCls} />
            </FormField>
            <button type="submit" disabled={paySaving || !payForm.amount_eur}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-colors">
              {paySaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer le paiement
            </button>
          </form>
        </Modal>
      )}

      {/* ── MODAL: Create formula ────────────────────────────────────────────── */}
      {showCreateFormula && (
        <Modal title="Nouvelle formule" onClose={() => setShowCreateFormula(false)}>
          <form onSubmit={createFormula} className="space-y-4">
            <FormField label="Nom *">
              <input type="text" required placeholder="Coaching Premium" value={formulaForm.name}
                onChange={e => setFormulaForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prix (€)">
                <input type="number" step="0.01" placeholder="99.00" value={formulaForm.price_eur}
                  onChange={e => setFormulaForm(f => ({ ...f, price_eur: e.target.value }))}
                  className={`${inputCls} font-mono`} />
              </FormField>
              <FormField label="Facturation">
                <select value={formulaForm.billing_cycle} onChange={e => setFormulaForm(f => ({ ...f, billing_cycle: e.target.value }))}
                  className={selectCls}>
                  <option value="one_time">Paiement unique</option>
                  <option value="weekly">Hebdo</option>
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </FormField>
            </div>
            <FormField label="Description">
              <input type="text" placeholder="Coaching personnalisé incluant..." value={formulaForm.description}
                onChange={e => setFormulaForm(f => ({ ...f, description: e.target.value }))}
                className={inputCls} />
            </FormField>
            <FormField label="Inclus (une ligne par item)">
              <textarea value={formulaForm.features} onChange={e => setFormulaForm(f => ({ ...f, features: e.target.value }))}
                rows={3} placeholder={"Programme personnalisé\nSuivi hebdomadaire\nBilans mensuels"}
                className="w-full px-3 py-2.5 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none resize-none placeholder:text-white/20" />
            </FormField>
            <button type="submit" disabled={formulaSaving || !formulaForm.name}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-sm rounded-xl disabled:opacity-40 transition-colors">
              {formulaSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Créer la formule
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>
        <div className="h-px bg-white/[0.07]" />
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.16em]">{label}</label>
      {children}
    </div>
  )
}
