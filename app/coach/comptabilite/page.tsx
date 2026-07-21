"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Euro,
  TrendingUp,
  AlertCircle,
  Clock,
  Users,
  CreditCard,
  Plus,
  Loader2,
  X,
  Check,
  Download,
  Filter,
  ChevronDown,
  Receipt,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Bell,
  Mail,
  Trash2,
  CheckCircle2,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import SendPaymentLinkModal from "@/components/crm/SendPaymentLinkModal";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import HeaderIconButton from "@/components/layout/HeaderIconButton";

// ── Types ─────────────────────────────────────────────────────────────────────

type Kpis = {
  mrr: number;
  arr: number;
  totalRevenue: number;
  currentMonthRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  activeSubscriptions: number;
  pendingCount: number;
  overdueCount: number;
};
type RevenuePoint = { month: string; amount: number };
type TopClient = {
  id: string;
  name: string;
  amount: number;
  color: string;
  isActive: boolean;
};
type Payment = {
  id: string;
  amount_eur: number;
  status: string;
  payment_method: string;
  payment_date: string;
  due_date?: string | null;
  description?: string | null;
  reference?: string | null;
  client?: { id: string; first_name: string; last_name: string } | null;
  subscription?: {
    id: string;
    formula?: { name: string; price_eur: number } | null;
  } | null;
};
type Formula = {
  id: string;
  name: string;
  description?: string | null;
  price_eur: number;
  billing_cycle: string;
  features: string[];
  color: string;
  is_active: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const BILLING_LABELS: Record<string, string> = {
  one_time: "unique",
  weekly: "/sem.",
  monthly: "/mois",
  quarterly: "/trim.",
  yearly: "/an",
};
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  paid: { label: "Payé", cls: "bg-emerald-500/12 text-emerald-400" },
  pending: { label: "En attente", cls: "bg-amber-500/12 text-amber-400" },
  failed: { label: "Échoué", cls: "bg-red-500/12 text-red-400" },
  refunded: { label: "Remboursé", cls: "bg-white/8 text-white/40" },
};
const METHOD_LABELS: Record<string, string> = {
  manual: "Manuel",
  bank_transfer: "Virement",
  card: "Carte",
  cash: "Espèces",
  stripe: "Stripe",
  other: "Autre",
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan",
  "02": "Fév",
  "03": "Mar",
  "04": "Avr",
  "05": "Mai",
  "06": "Juin",
  "07": "Juil",
  "08": "Aoû",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Déc",
};

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[m]} ${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComptabilitePage() {
  const router = useRouter();

  // ── Top bar setup ──────────────────────────────────────────────────────────
  const topBarLeft = useMemo(
    () => <p className="text-[13px] text-white font-medium">Comptabilité</p>,
    [],
  );

  const topBarRight = useMemo(
    () => (
      <>
        <HeaderIconButton
          onClick={() => setShowCreateFormula(true)}
          icon={<CreditCard size={15} />}
          label="Nouvelle formule"
        />
        <HeaderIconButton
          onClick={() => setShowAddPayment(true)}
          icon={<Plus size={16} />}
          label="Enregistrer un paiement"
          variant="accent"
        />
      </>
    ),
    [],
  );

  useSetTopBar(topBarLeft, topBarRight);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [revenueByMonth, setRevenueByMonth] = useState<RevenuePoint[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showCreateFormula, setShowCreateFormula] = useState(false);

  // Add payment form
  const todayIso = () => new Date().toISOString().split("T")[0];
  const defaultDueIn7 = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const [payForm, setPayForm] = useState({
    client_search: "",
    client_id: "",
    client_name: "",
    amount_eur: "",
    status: "paid",
    payment_method: "manual",
    payment_date: new Date().toISOString().split("T")[0],
    /** Échéance — alimente les rappels auto (J-1 / J-3 / J-7) */
    due_date: "",
    description: "",
    reference: "",
    /** Stripe request: notify client in STRYVR app */
    send_stripe_app: true,
    /** Stripe request: email payment link */
    send_stripe_email: true,
  });
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySendStatus, setPaySendStatus] = useState<string | null>(null);
  /** Row-level action in flight */
  const [rowActionId, setRowActionId] = useState<string | null>(null);
  const [rowActionKind, setRowActionKind] = useState<string | null>(null);
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  /** Edit existing payment */
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editForm, setEditForm] = useState({
    amount_eur: "",
    status: "paid",
    payment_method: "manual",
    payment_date: "",
    due_date: "",
    description: "",
    reference: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [generatingDues, setGeneratingDues] = useState(false);

  // Formula form
  const [formulaForm, setFormulaForm] = useState({
    name: "",
    description: "",
    price_eur: "",
    billing_cycle: "monthly",
    duration_months: "",
    features: "",
    color: "#6366f1",
  });
  const [formulaSaving, setFormulaSaving] = useState(false);

  // Clients list (for payment dropdown)
  const [clients, setClients] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);
  const [stripeRequestPay, setStripeRequestPay] = useState<Payment | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterMonth) params.set("month", filterMonth);

    const [statsRes, paymentsRes, formulasRes, clientsRes] = await Promise.all([
      fetch("/api/comptabilite"),
      fetch(`/api/payments?${params.toString()}`),
      fetch("/api/formulas"),
      fetch("/api/clients"),
    ]);

    if (statsRes.ok) {
      const d = await statsRes.json();
      setKpis(d.kpis);
      setRevenueByMonth(d.revenueByMonth ?? []);
      setTopClients(d.topClients ?? []);
    }
    if (paymentsRes.ok) setPayments((await paymentsRes.json()).payments ?? []);
    if (formulasRes.ok) setFormulas((await formulasRes.json()).formulas ?? []);
    if (clientsRes.ok) setClients((await clientsRes.json()).clients ?? []);

    setLoading(false);
  }, [filterStatus, filterMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Add payment ────────────────────────────────────────────────────────────

  function resetPayForm() {
    setPayForm({
      client_search: "",
      client_id: "",
      client_name: "",
      amount_eur: "",
      status: "paid",
      payment_method: "manual",
      payment_date: todayIso(),
      due_date: "",
      description: "",
      reference: "",
      send_stripe_app: true,
      send_stripe_email: true,
    });
    setPayError(null);
    setPaySendStatus(null);
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payForm.client_id || !payForm.amount_eur) return;
    setPaySaving(true);
    setPayError(null);
    setPaySendStatus(null);

    // Stripe demand with send options → pending until Checkout completes
    const wantsStripeSend =
      payForm.payment_method === "stripe" &&
      (payForm.send_stripe_app || payForm.send_stripe_email);
    const statusToSave = wantsStripeSend ? "pending" : payForm.status;

    const resolvedDue =
      statusToSave === "pending" || statusToSave === "failed"
        ? payForm.due_date || defaultDueIn7()
        : payForm.due_date || null;

    const buildFallbackPayment = (paymentId: string): Payment =>
      ({
        id: paymentId,
        amount_eur: parseFloat(payForm.amount_eur),
        status: "pending",
        payment_method: "stripe",
        payment_date: payForm.payment_date,
        description: payForm.description || null,
        reference: payForm.reference || null,
        due_date: resolvedDue,
        client: {
          id: payForm.client_id,
          first_name: payForm.client_name.split(" ")[0] ?? "",
          last_name: payForm.client_name.split(" ").slice(1).join(" ") || "",
        },
        subscription: null,
      }) as Payment;

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: payForm.client_id,
          amount_eur: parseFloat(payForm.amount_eur),
          status: statusToSave,
          payment_method: payForm.payment_method,
          payment_date: payForm.payment_date,
          due_date: resolvedDue,
          description: payForm.description || null,
          reference: payForm.reference || null,
          formula_name: payForm.description || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Impossible d’enregistrer le paiement");
      }

      const payment = data?.payment as { id: string } | undefined;

      if (wantsStripeSend && payment?.id) {
        setPaySendStatus("Génération du lien Stripe…");
        const checkoutRes = await fetch("/api/stripe/coaching/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: payForm.client_id,
            payment_id: payment.id,
            source: "client",
          }),
        });
        const checkoutData = await checkoutRes.json().catch(() => null);
        if (!checkoutRes.ok || !checkoutData?.url) {
          // Payment exists — open dedicated send modal to finish
          setShowAddPayment(false);
          const fallback = buildFallbackPayment(payment.id);
          resetPayForm();
          await loadData();
          setStripeRequestPay(fallback);
          return;
        }

        setPaySendStatus("Envoi au client…");
        const sendRes = await fetch("/api/stripe/coaching/send-payment-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: payForm.client_id,
            payment_url: checkoutData.url,
            formula_name: payForm.description?.trim() || "Coaching",
            amount_eur: parseFloat(payForm.amount_eur),
            send_email: payForm.send_stripe_email,
            send_app: payForm.send_stripe_app,
            payment_id: payment.id,
          }),
        });
        if (!sendRes.ok) {
          setShowAddPayment(false);
          const fallback = buildFallbackPayment(payment.id);
          resetPayForm();
          await loadData();
          setStripeRequestPay(fallback);
          return;
        }
      }

      setShowAddPayment(false);
      resetPayForm();
      await loadData();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setPaySaving(false);
      setPaySendStatus(null);
    }
  }

  function showToast(message: string) {
    setActionToast(message);
    window.setTimeout(() => setActionToast(null), 2800);
  }

  async function runPaymentAction(
    paymentId: string,
    kind: string,
    fn: () => Promise<void>,
  ) {
    setRowActionId(paymentId);
    setRowActionKind(kind);
    setRowMenuOpenId(null);
    try {
      await fn();
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setRowActionId(null);
      setRowActionKind(null);
    }
  }

  async function markPaymentStatus(
    payment: Payment,
    status: "paid" | "pending" | "failed" | "refunded",
  ) {
    await runPaymentAction(payment.id, `status-${status}`, async () => {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "paid"
            ? { payment_date: new Date().toISOString().split("T")[0] }
            : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Mise à jour impossible");
      showToast(
        status === "paid"
          ? "Paiement marqué payé"
          : status === "failed"
            ? "Paiement marqué échoué"
            : status === "refunded"
              ? "Paiement marqué remboursé"
              : "Statut mis à jour",
      );
    });
  }

  async function deletePayment(payment: Payment) {
    if (
      !window.confirm(
        `Supprimer ce paiement de ${Number(payment.amount_eur).toFixed(2)} € ?`,
      )
    ) {
      return;
    }
    await runPaymentAction(payment.id, "delete", async () => {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Suppression impossible");
      showToast("Paiement supprimé");
    });
  }

  async function downloadInvoice(paymentId: string) {
    await runPaymentAction(paymentId, "invoice-dl", async () => {
      const res = await fetch(`/api/payments/${paymentId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Reçu indisponible");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recu-${paymentId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Reçu téléchargé");
    });
  }

  async function sendInvoiceEmail(paymentId: string) {
    await runPaymentAction(paymentId, "invoice-mail", async () => {
      const res = await fetch(`/api/payments/${paymentId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Envoi du reçu impossible");
      showToast("Reçu envoyé par e-mail");
    });
  }

  async function sendPaymentReminder(paymentId: string) {
    await runPaymentAction(paymentId, "remind", async () => {
      const res = await fetch(`/api/payments/${paymentId}/remind`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Rappel impossible");
      showToast("Rappel envoyé (e-mail + app si disponible)");
    });
  }

  function openEditPayment(payment: Payment) {
    setRowMenuOpenId(null);
    setEditError(null);
    setEditPayment(payment);
    const status = payment.status || "pending";
    setEditForm({
      amount_eur: String(payment.amount_eur ?? ""),
      status,
      payment_method: payment.payment_method || "manual",
      payment_date: (payment.payment_date || "").slice(0, 10),
      due_date:
        (payment.due_date || "").slice(0, 10) ||
        (status === "pending" || status === "failed" ? defaultDueIn7() : ""),
      description: payment.description ?? "",
      reference: payment.reference ?? "",
    });
  }

  async function saveEditPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editPayment) return;
    const amount = parseFloat(editForm.amount_eur);
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError("Montant invalide");
      return;
    }
    if (
      (editForm.status === "pending" || editForm.status === "failed") &&
      !editForm.due_date
    ) {
      setEditError("Indiquez une date d’échéance pour les paiements en attente");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/payments/${editPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_eur: amount,
          status: editForm.status,
          payment_method: editForm.payment_method,
          payment_date: editForm.payment_date,
          due_date:
            editForm.due_date ||
            (editForm.status === "pending" || editForm.status === "failed"
              ? defaultDueIn7()
              : null),
          description: editForm.description.trim() || null,
          reference: editForm.reference.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Mise à jour impossible");
      setEditPayment(null);
      showToast("Paiement mis à jour");
      await loadData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setEditSaving(false);
    }
  }

  function openStripeRequest(payment: Payment) {
    setRowMenuOpenId(null);
    if (!payment.client?.id) {
      showToast("Aucun client lié à ce paiement");
      return;
    }
    // Relance d’un échec/remboursement → repasse en attente pour le suivi
    if (payment.status === "failed" || payment.status === "refunded") {
      void (async () => {
        try {
          await fetch(`/api/payments/${payment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "pending",
              payment_method: "stripe",
            }),
          });
          setStripeRequestPay({
            ...payment,
            status: "pending",
            payment_method: "stripe",
          });
          await loadData();
        } catch {
          setStripeRequestPay(payment);
        }
      })();
      return;
    }
    setStripeRequestPay(payment);
  }

  // ── Create formula ─────────────────────────────────────────────────────────

  async function createFormula(e: React.FormEvent) {
    e.preventDefault();
    setFormulaSaving(true);
    const res = await fetch("/api/formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formulaForm.name,
        description: formulaForm.description || null,
        price_eur: parseFloat(formulaForm.price_eur) || 0,
        billing_cycle: formulaForm.billing_cycle,
        duration_months: formulaForm.duration_months
          ? parseInt(formulaForm.duration_months)
          : null,
        features: formulaForm.features.split("\n").filter((f) => f.trim()),
        color: formulaForm.color,
      }),
    });
    if (res.ok) {
      const { formula } = await res.json();
      setFormulas((prev) => [formula, ...prev]);
      setShowCreateFormula(false);
      setFormulaForm({
        name: "",
        description: "",
        price_eur: "",
        billing_cycle: "monthly",
        duration_months: "",
        features: "",
        color: "#6366f1",
      });
    }
    setFormulaSaving(false);
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  async function generateSubscriptionDues() {
    setGeneratingDues(true);
    try {
      const res = await fetch("/api/payments/generate-dues", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Génération impossible");
      }
      const created = Number(data?.created ?? 0);
      showToast(
        created > 0
          ? `${created} échéance${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""} depuis les abonnements`
          : "Aucune nouvelle échéance (tout est à jour)",
      );
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Génération impossible");
    } finally {
      setGeneratingDues(false);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "Date",
        "Échéance",
        "Client",
        "Description",
        "Méthode",
        "Statut",
        "Montant (€)",
      ],
      ...payments.map((p) => [
        p.payment_date,
        p.due_date ?? "—",
        p.client ? `${p.client.first_name} ${p.client.last_name}` : "—",
        p.description ?? "—",
        METHOD_LABELS[p.payment_method] ?? p.payment_method,
        STATUS_CONFIG[p.status]?.label ?? p.status,
        Number(p.amount_eur).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paiements_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const chartData = revenueByMonth.map((p) => ({
    ...p,
    label: formatMonth(p.month),
  }));

  const filteredClients = payForm.client_search
    ? clients
        .filter((c) =>
          `${c.first_name} ${c.last_name}`
            .toLowerCase()
            .includes(payForm.client_search.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <main className="bg-[#121212] min-h-screen">
      <div className="p-8 max-w-[1200px] mx-auto space-y-6">
        {loading ? (
          <>
            {/* KPI Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-[#181818] border-subtle rounded-2xl p-5 flex items-center gap-4"
                >
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>

            {/* Chart Skeleton */}
            <div className="bg-[#181818] border-subtle rounded-2xl p-6">
              <Skeleton className="h-4 w-48 mb-5" />
              <Skeleton className="h-[220px] w-full rounded-xl" />
            </div>

            {/* Two Columns Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top clients skeleton */}
              <div className="bg-[#181818] border-subtle rounded-2xl p-5">
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-4 h-4 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                      <Skeleton className="w-12 h-4" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulas skeleton */}
              <div className="bg-[#181818] border-subtle rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]"
                    >
                      <Skeleton className="w-3 h-3 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="w-16 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payments Table Skeleton */}
            <div className="bg-[#181818] border-subtle rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
                <Skeleton className="h-4 w-36" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded-xl" />
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              </div>
              <div className="space-y-0">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-4 border-b border-white/[0.04] last:border-0"
                  >
                    <Skeleton className="w-16 h-3" />
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-32 h-3 flex-1" />
                    <Skeleton className="w-16 h-3" />
                    <Skeleton className="w-12 h-5 rounded-full" />
                    <Skeleton className="w-16 h-4 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="MRR"
                value={`${kpis?.mrr.toFixed(2) ?? "—"} €`}
                sub={`ARR: ${kpis?.arr.toFixed(0) ?? "—"} €`}
                icon={TrendingUp}
                iconColor="text-indigo-400"
              />
              <KpiCard
                label="Ce mois"
                value={`${kpis?.currentMonthRevenue.toFixed(2) ?? "—"} €`}
                sub={`Total: ${kpis?.totalRevenue.toFixed(0) ?? "—"} €`}
                icon={Euro}
                iconColor="text-emerald-400"
              />
              <KpiCard
                label="En attente"
                value={`${kpis?.pendingAmount.toFixed(2) ?? "—"} €`}
                sub={`${kpis?.pendingCount ?? 0} paiement(s)`}
                icon={Clock}
                iconColor="text-amber-400"
                alert={!!kpis?.pendingAmount}
              />
              <KpiCard
                label="Abonnements actifs"
                value={String(kpis?.activeSubscriptions ?? "—")}
                sub={`${kpis?.overdueAmount?.toFixed(2) ?? "0"} € en retard`}
                icon={Users}
                iconColor="text-white/60"
                alert={!!kpis?.overdueAmount}
              />
            </div>

            {/* ── REVENUE CHART ───────────────────────────────────────────────── */}
            <div className="bg-[#181818] border-subtle rounded-2xl p-6">
              <h3 className="text-[13px] font-semibold text-white mb-5">
                Revenus — 12 derniers mois
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#1f8a65"
                        stopOpacity={0.25}
                      />
                      <stop offset="95%" stopColor="#1f8a65" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#ffffff40" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#ffffff40" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v} €`}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [
                      `${Number(v).toFixed(2)} €`,
                      "Revenus",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #ffffff0a",
                      backgroundColor: "#0f0f0f",
                      color: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#1f8a65"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                    dot={{ r: 3, fill: "#1f8a65" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── TWO COLUMNS: Top clients + Formulas ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top clients */}
              <div className="bg-[#181818] border-subtle rounded-2xl p-5">
                <h3 className="text-[13px] font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={15} className="text-white/40" />
                  Top clients (CA total)
                </h3>
                {topClients.length === 0 ? (
                  <p className="text-[12px] text-white/40 italic text-center py-4">
                    Aucune donnée
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topClients.map((c, i) => {
                      const maxAmt = topClients[0]?.amount ?? 1;
                      const opacityClass = c.isActive ? "" : "opacity-50";
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 ${opacityClass}`}
                        >
                          <span className="text-[11px] font-black text-white/40 w-4">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <p className="text-[12px] font-semibold text-white">
                                {c.name}
                              </p>
                              <p className="text-[12px] font-black text-white font-mono">
                                {c.amount.toFixed(2)} €
                              </p>
                            </div>
                            <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(c.amount / maxAmt) * 100}%`,
                                  backgroundColor: c.color || "#1f8a65",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Formulas */}
              <div className="bg-[#181818] border-subtle rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
                    <CreditCard size={15} className="text-white/40" />
                    Mes formules
                  </h3>
                  <button
                    onClick={() => setShowCreateFormula(true)}
                    className="text-[11px] font-semibold text-[#1f8a65] hover:text-[#217356] transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Nouvelle
                  </button>
                </div>
                {formulas.filter((f) => f.is_active).length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-[12px] text-white/40 italic mb-3">
                      Aucune formule créée
                    </p>
                    <button
                      onClick={() => setShowCreateFormula(true)}
                      className="text-[11px] font-semibold text-[#1f8a65] hover:text-[#217356] transition-colors"
                    >
                      + Créer ma première formule
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formulas
                      .filter((f) => f.is_active)
                      .map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]"
                        >
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: f.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-white truncate">
                              {f.name}
                            </p>
                            {f.description && (
                              <p className="text-[11px] text-white/45 truncate">
                                {f.description}
                              </p>
                            )}
                          </div>
                          <p className="text-[12px] font-black text-white font-mono shrink-0">
                            {f.price_eur.toFixed(2)} €
                            <span className="text-[10px] font-normal text-white/40 ml-1">
                              {BILLING_LABELS[f.billing_cycle]}
                            </span>
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── PAYMENTS TABLE ───────────────────────────────────────────────── */}
            <div className="bg-[#181818] border-subtle rounded-2xl overflow-visible">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
                <h3 className="text-[13px] font-semibold text-white flex items-center gap-2">
                  <Receipt size={15} className="text-white/40" />
                  Tous les paiements
                </h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => void generateSubscriptionDues()}
                    disabled={generatingDues}
                    title="Crée les paiements en attente à partir des abonnements actifs (formule + cycle)"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-[#1f8a65]/12 hover:bg-[#1f8a65]/20 text-[#7fe2bf] transition-colors disabled:opacity-50"
                  >
                    {generatingDues ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    Générer échéances
                  </button>
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                      showFilters
                        ? "bg-[#1f8a65] text-white"
                        : "bg-white/[0.02] hover:bg-white/[0.05] text-white/60 hover:text-white"
                    }`}
                  >
                    <Filter size={13} />
                    Filtres
                  </button>
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-white/[0.02] hover:bg-white/[0.05] text-white/60 hover:text-white transition-colors"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="p-4 border-b border-white/[0.07] bg-white/[0.01] grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                      Statut
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
                    >
                      <option value="all">Tous</option>
                      <option value="paid">Payé</option>
                      <option value="pending">En attente</option>
                      <option value="failed">Échoué</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                      Mois
                    </label>
                    <input
                      type="month"
                      value={filterMonth}
                      onChange={(e) => setFilterMonth(e.target.value)}
                      className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
                    />
                  </div>
                </div>
              )}

              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt size={24} className="text-white/20 mx-auto mb-2" />
                  <p className="text-[12px] text-white/40 italic">
                    Aucun paiement enregistré
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-b-2xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.07]">
                        <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Date
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden sm:table-cell">
                          Échéance
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Client
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden md:table-cell">
                          Description
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden lg:table-cell">
                          Méthode
                        </th>
                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Statut
                        </th>
                        <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                          Montant
                        </th>
                        <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 min-w-[200px]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const cfg =
                          STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
                        const busy = rowActionId === p.id;
                        const isPaid = p.status === "paid";
                        const isPending = p.status === "pending";
                        const isFailed = p.status === "failed";
                        const isRefunded = p.status === "refunded";
                        const hasClient = Boolean(p.client?.id);
                        const menuOpen = rowMenuOpenId === p.id;

                        return (
                          <tr
                            key={p.id}
                            className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-5 py-3 text-[11px] text-white/70 font-medium whitespace-nowrap">
                              {new Date(p.payment_date).toLocaleDateString(
                                "fr-FR",
                              )}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-[11px] whitespace-nowrap">
                              {p.due_date ? (
                                <span
                                  className={
                                    p.status === "pending" &&
                                    p.due_date < todayIso()
                                      ? "font-semibold text-amber-300/90"
                                      : "text-white/55"
                                  }
                                  title={
                                    p.status === "pending" &&
                                    p.due_date < todayIso()
                                      ? "Échéance dépassée"
                                      : "Date d’échéance"
                                  }
                                >
                                  {new Date(p.due_date).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </span>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {p.client ? (
                                <Link
                                  href={`/coach/clients/${p.client.id}/profil`}
                                  className="group inline-flex items-center gap-1 text-[12px] font-semibold text-white hover:text-[#7fe2bf]"
                                >
                                  {p.client.first_name} {p.client.last_name}
                                  <ExternalLink
                                    size={11}
                                    className="opacity-0 transition-opacity group-hover:opacity-50"
                                  />
                                </Link>
                              ) : (
                                <span className="text-white/40">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-[11px] text-white/70 max-w-[200px] truncate">
                              {p.description ??
                                p.subscription?.formula?.name ??
                                "—"}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-[11px] text-white/60">
                              {METHOD_LABELS[p.payment_method] ??
                                p.payment_method}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="text-[12px] font-black text-white font-mono">
                                {Number(p.amount_eur).toFixed(2)} €
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative flex items-center justify-end gap-1">
                                {busy && (
                                  <Loader2
                                    size={13}
                                    className="animate-spin text-white/40"
                                  />
                                )}

                                {/* ── Quick actions by status ── */}
                                {isPending && hasClient && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => openStripeRequest(p)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#635BFF]/12 px-2 text-[10px] font-bold text-[#a5a0ff] transition-colors hover:bg-[#635BFF]/20 disabled:opacity-40"
                                    title="Demande Stripe (app / e-mail)"
                                  >
                                    <Send size={11} />
                                    <span className="hidden xl:inline">Stripe</span>
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void sendPaymentReminder(p.id)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-amber-400/10 px-2 text-[10px] font-bold text-amber-300/90 transition-colors hover:bg-amber-400/15 disabled:opacity-40"
                                    title="Rappel e-mail + app"
                                  >
                                    <Bell size={11} />
                                    <span className="hidden xl:inline">Rappel</span>
                                  </button>
                                )}
                                {isPending && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void markPaymentStatus(p, "paid")}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#1f8a65]/15 px-2 text-[10px] font-bold text-[#7fe2bf] transition-colors hover:bg-[#1f8a65]/25 disabled:opacity-40"
                                    title="Marquer payé"
                                  >
                                    <CheckCircle2 size={11} />
                                    <span className="hidden xl:inline">Payé</span>
                                  </button>
                                )}
                                {(isFailed || isRefunded) && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void markPaymentStatus(p, "paid")}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#1f8a65]/15 px-2 text-[10px] font-bold text-[#7fe2bf] transition-colors hover:bg-[#1f8a65]/25 disabled:opacity-40"
                                    title="Marquer payé"
                                  >
                                    <CheckCircle2 size={11} />
                                    <span className="hidden xl:inline">Payé</span>
                                  </button>
                                )}
                                {(isFailed || isRefunded) && hasClient && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => openStripeRequest(p)}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#635BFF]/12 px-2 text-[10px] font-bold text-[#a5a0ff] transition-colors hover:bg-[#635BFF]/20 disabled:opacity-40"
                                    title="Relancer via Stripe"
                                  >
                                    <Send size={11} />
                                    <span className="hidden xl:inline">Stripe</span>
                                  </button>
                                )}
                                {isPaid && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void downloadInvoice(p.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                                    title="Télécharger le reçu PDF"
                                  >
                                    <Download size={12} />
                                  </button>
                                )}
                                {isPaid && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void sendInvoiceEmail(p.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                                    title="Envoyer le reçu par e-mail"
                                  >
                                    <Mail size={12} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => openEditPayment(p)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                                  title="Modifier le paiement"
                                >
                                  <Pencil size={12} />
                                </button>

                                {/* ── Full actions menu ── */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() =>
                                      setRowMenuOpenId((id) =>
                                        id === p.id ? null : p.id,
                                      )
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                                    title="Toutes les actions"
                                    aria-expanded={menuOpen}
                                  >
                                    <MoreHorizontal size={13} />
                                  </button>
                                  {menuOpen && (
                                    <>
                                      <button
                                        type="button"
                                        className="fixed inset-0 z-40 cursor-default"
                                        aria-label="Fermer le menu"
                                        onClick={() => setRowMenuOpenId(null)}
                                      />
                                      <div className="absolute right-0 top-full z-50 mt-1 max-h-[min(70vh,420px)] min-w-[220px] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#141414] py-1 shadow-xl shadow-black/50">
                                        <p className="px-3 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                                          Relance
                                        </p>
                                        {isPending && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() =>
                                              void sendPaymentReminder(p.id)
                                            }
                                          >
                                            <Bell size={12} className="text-amber-300/80" />
                                            Envoyer un rappel
                                          </button>
                                        )}
                                        {hasClient && (isPending || isFailed || isRefunded) && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() => openStripeRequest(p)}
                                          >
                                            <Send size={12} className="text-[#a5a0ff]" />
                                            {isPending
                                              ? "Envoyer lien Stripe"
                                              : "Relancer via Stripe"}
                                          </button>
                                        )}
                                        {hasClient && (
                                          <Link
                                            href={`/coach/clients/${p.client!.id}`}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() => setRowMenuOpenId(null)}
                                          >
                                            <MessageSquare size={12} className="text-white/40" />
                                            Fiche client (message)
                                          </Link>
                                        )}

                                        <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                                          Statut
                                        </p>
                                        {!isPaid && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() =>
                                              void markPaymentStatus(p, "paid")
                                            }
                                          >
                                            <CheckCircle2 size={12} className="text-[#7fe2bf]" />
                                            Marquer payé
                                          </button>
                                        )}
                                        {!isPending && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() =>
                                              void markPaymentStatus(p, "pending")
                                            }
                                          >
                                            <RotateCcw size={12} className="text-amber-300/80" />
                                            Remettre en attente
                                          </button>
                                        )}
                                        {isPending && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() =>
                                              void markPaymentStatus(p, "failed")
                                            }
                                          >
                                            <AlertCircle size={12} className="text-red-300/80" />
                                            Marquer échoué
                                          </button>
                                        )}
                                        {isPaid && (
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() =>
                                              void markPaymentStatus(p, "refunded")
                                            }
                                          >
                                            <ArrowDownRight size={12} className="text-white/40" />
                                            Marquer remboursé
                                          </button>
                                        )}

                                        <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                                          Documents
                                        </p>
                                        {isPaid ? (
                                          <>
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                              onClick={() =>
                                                void downloadInvoice(p.id)
                                              }
                                            >
                                              <Download size={12} />
                                              Télécharger reçu PDF
                                            </button>
                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                              onClick={() =>
                                                void sendInvoiceEmail(p.id)
                                              }
                                            >
                                              <Mail size={12} />
                                              Envoyer reçu e-mail
                                            </button>
                                          </>
                                        ) : (
                                          <p className="px-3 py-1.5 text-[11px] text-white/35">
                                            Reçu dispo une fois payé
                                          </p>
                                        )}

                                        <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">
                                          Gestion
                                        </p>
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                          onClick={() => openEditPayment(p)}
                                        >
                                          <Pencil size={12} />
                                          Modifier
                                        </button>
                                        {hasClient && (
                                          <Link
                                            href={`/coach/clients/${p.client!.id}/profil`}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/75 hover:bg-white/[0.05]"
                                            onClick={() => setRowMenuOpenId(null)}
                                          >
                                            <ExternalLink size={12} />
                                            Ouvrir le client
                                          </Link>
                                        )}
                                        <div className="my-1 h-px bg-white/[0.06]" />
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-red-300/90 hover:bg-red-500/10"
                                          onClick={() => void deletePayment(p)}
                                        >
                                          <Trash2 size={12} />
                                          Supprimer
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {actionToast && (
              <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#181818] px-4 py-2.5 text-[12px] font-semibold text-white shadow-xl">
                {actionToast}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL: Add payment ───────────────────────────────────────────────── */}
      {showAddPayment && (
        <Modal
          title="Enregistrer un paiement"
          onClose={() => {
            if (paySaving) return;
            setShowAddPayment(false);
            resetPayForm();
          }}
        >
          <form onSubmit={addPayment} className="space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Client *
              </label>
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={payForm.client_name || payForm.client_search}
                onChange={(e) => {
                  if (payForm.client_id) {
                    setPayForm((f) => ({
                      ...f,
                      client_id: "",
                      client_name: "",
                      client_search: e.target.value,
                    }));
                  } else {
                    setPayForm((f) => ({
                      ...f,
                      client_search: e.target.value,
                    }));
                  }
                }}
                className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
              {filteredClients.length > 0 && !payForm.client_id && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0f0f0f] rounded-xl overflow-hidden z-10">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setPayForm((f) => ({
                          ...f,
                          client_id: c.id,
                          client_name: `${c.first_name} ${c.last_name}`,
                          client_search: "",
                        }))
                      }
                      className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-white/[0.05] transition-colors text-white/80 hover:text-white"
                    >
                      {c.first_name} {c.last_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Montant (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={payForm.amount_eur}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, amount_eur: e.target.value }))
                  }
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Statut
                </label>
                <select
                  value={payForm.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setPayForm((f) => ({
                      ...f,
                      status,
                      due_date:
                        (status === "pending" || status === "failed") &&
                        !f.due_date
                          ? defaultDueIn7()
                          : f.due_date,
                    }));
                  }}
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                >
                  <option value="paid">Payé</option>
                  <option value="pending">En attente</option>
                  <option value="failed">Échoué</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Méthode
                </label>
                <select
                  value={payForm.payment_method}
                  onChange={(e) => {
                    const method = e.target.value;
                    setPayForm((f) => {
                      const nextStatus =
                        method === "stripe"
                          ? "pending"
                          : f.status === "pending" && method !== "stripe"
                            ? "paid"
                            : f.status;
                      return {
                        ...f,
                        payment_method: method,
                        status: nextStatus,
                        due_date:
                          nextStatus === "pending" && !f.due_date
                            ? defaultDueIn7()
                            : f.due_date,
                      };
                    });
                  }}
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                >
                  <option value="manual">Manuel</option>
                  <option value="bank_transfer">Virement</option>
                  <option value="card">Carte</option>
                  <option value="cash">Espèces</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Date d’enregistrement
                </label>
                <input
                  type="date"
                  value={payForm.payment_date}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, payment_date: e.target.value }))
                  }
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                />
              </div>
              {(payForm.status === "pending" ||
                payForm.status === "failed" ||
                payForm.payment_method === "stripe") && (
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                    Échéance *
                  </label>
                  <input
                    type="date"
                    required={
                      payForm.status === "pending" ||
                      payForm.status === "failed" ||
                      payForm.payment_method === "stripe"
                    }
                    value={payForm.due_date || defaultDueIn7()}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, due_date: e.target.value }))
                    }
                    className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                  />
                  <p className="text-[11px] text-white/35">
                    Les rappels auto (paramètres coach, J-1 / J-3 / J-7) partent
                    de cette date.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Description
              </label>
              <input
                type="text"
                placeholder="Ex: Coaching Novembre"
                value={payForm.description}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Référence
              </label>
              <input
                type="text"
                placeholder="N° de facture, réf. virement..."
                value={payForm.reference}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, reference: e.target.value }))
                }
                className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>

            {/* Stripe → send payment request to client */}
            {payForm.payment_method === "stripe" && (
              <div className="space-y-2.5 rounded-xl border border-[#1f8a65]/20 bg-[#1f8a65]/[0.06] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7fe2bf]">
                  Demande de règlement Stripe
                </p>
                <p className="text-[12px] leading-relaxed text-white/50">
                  Crée un paiement en attente et envoie le lien sécurisé au
                  client (app STRYVR et/ou e-mail).
                </p>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/60 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={payForm.send_stripe_app}
                    onChange={(e) =>
                      setPayForm((f) => ({
                        ...f,
                        send_stripe_app: e.target.checked,
                        status:
                          e.target.checked || f.send_stripe_email
                            ? "pending"
                            : f.status,
                      }))
                    }
                    className="h-4 w-4 accent-[#1f8a65]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-white">
                      Dans l’application client
                    </span>
                    <span className="block text-[10px] text-white/40">
                      Notification push + écran de paiement STRYVR
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a]/60 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={payForm.send_stripe_email}
                    onChange={(e) =>
                      setPayForm((f) => ({
                        ...f,
                        send_stripe_email: e.target.checked,
                        status:
                          e.target.checked || f.send_stripe_app
                            ? "pending"
                            : f.status,
                      }))
                    }
                    className="h-4 w-4 accent-[#1f8a65]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-white">
                      Par e-mail
                    </span>
                    <span className="block text-[10px] text-white/40">
                      Lien Checkout Stripe dans la boîte mail du client
                    </span>
                  </span>
                </label>
              </div>
            )}

            {payError && (
              <p className="rounded-xl border border-red-500/20 bg-red-950/20 px-3 py-2 text-[12px] text-red-300">
                {payError}
              </p>
            )}
            {paySendStatus && (
              <p className="text-center text-[12px] font-medium text-[#7fe2bf]">
                {paySendStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={paySaving || !payForm.client_id || !payForm.amount_eur}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-[12px] rounded-xl disabled:opacity-50 transition-colors"
            >
              {paySaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : payForm.payment_method === "stripe" &&
                (payForm.send_stripe_app || payForm.send_stripe_email) ? (
                <Send size={15} />
              ) : (
                <Check size={15} />
              )}
              {payForm.payment_method === "stripe" &&
              (payForm.send_stripe_app || payForm.send_stripe_email)
                ? "Créer et envoyer"
                : "Enregistrer"}
            </button>
          </form>
        </Modal>
      )}

      {/* ── MODAL: Create formula ────────────────────────────────────────────── */}
      {showCreateFormula && (
        <Modal
          title="Nouvelle formule"
          onClose={() => setShowCreateFormula(false)}
        >
          <form onSubmit={createFormula} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Nom *
              </label>
              <input
                type="text"
                required
                placeholder="Coaching Premium"
                value={formulaForm.name}
                onChange={(e) =>
                  setFormulaForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Prix (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="99.00"
                  value={formulaForm.price_eur}
                  onChange={(e) =>
                    setFormulaForm((f) => ({ ...f, price_eur: e.target.value }))
                  }
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Facturation
                </label>
                <select
                  value={formulaForm.billing_cycle}
                  onChange={(e) =>
                    setFormulaForm((f) => ({
                      ...f,
                      billing_cycle: e.target.value,
                    }))
                  }
                  className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                >
                  <option value="one_time">Paiement unique</option>
                  <option value="weekly">Hebdo</option>
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Description
              </label>
              <input
                type="text"
                placeholder="Coaching personnalisé incluant..."
                value={formulaForm.description}
                onChange={(e) =>
                  setFormulaForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full h-[52px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Ce qui est inclus (une ligne par item)
              </label>
              <textarea
                value={formulaForm.features}
                onChange={(e) =>
                  setFormulaForm((f) => ({ ...f, features: e.target.value }))
                }
                rows={3}
                placeholder={
                  "Programme personnalisé\nSuivi hebdomadaire\nBilans mensuels"
                }
                className="w-full px-4 py-3 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={formulaSaving || !formulaForm.name}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-[12px] rounded-xl disabled:opacity-50 transition-colors"
            >
              {formulaSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Créer la formule
            </button>
          </form>
        </Modal>
      )}

      {/* ── MODAL: Edit payment ──────────────────────────────────────────────── */}
      {editPayment && (
        <Modal
          title="Modifier le paiement"
          onClose={() => {
            if (editSaving) return;
            setEditPayment(null);
            setEditError(null);
          }}
        >
          <form onSubmit={saveEditPayment} className="space-y-4">
            {editPayment.client && (
              <p className="text-[12px] text-white/55">
                Client :{" "}
                <span className="font-semibold text-white">
                  {editPayment.client.first_name} {editPayment.client.last_name}
                </span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Montant (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editForm.amount_eur}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, amount_eur: e.target.value }))
                  }
                  className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Date d’enregistrement *
                </label>
                <input
                  type="date"
                  required
                  value={editForm.payment_date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, payment_date: e.target.value }))
                  }
                  className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Statut
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setEditForm((f) => ({
                      ...f,
                      status,
                      due_date:
                        (status === "pending" || status === "failed") &&
                        !f.due_date
                          ? defaultDueIn7()
                          : f.due_date,
                    }));
                  }}
                  className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                >
                  <option value="paid">Payé</option>
                  <option value="pending">En attente</option>
                  <option value="failed">Échoué</option>
                  <option value="refunded">Remboursé</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Méthode
                </label>
                <select
                  value={editForm.payment_method}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      payment_method: e.target.value,
                    }))
                  }
                  className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                >
                  <option value="manual">Manuel</option>
                  <option value="bank_transfer">Virement</option>
                  <option value="card">Carte</option>
                  <option value="cash">Espèces</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Autre</option>
                </select>
              </div>
            </div>
            {(editForm.status === "pending" || editForm.status === "failed") && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                  Échéance *
                </label>
                <input
                  type="date"
                  required
                  value={editForm.due_date}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, due_date: e.target.value }))
                  }
                  className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white outline-none"
                />
                <p className="text-[11px] text-white/35">
                  Utilisée par les rappels automatiques (réglages coach).
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Description
              </label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Ex. Coaching mensuel"
                className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                Référence
              </label>
              <input
                type="text"
                value={editForm.reference}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, reference: e.target.value }))
                }
                placeholder="N° virement, facture…"
                className="w-full h-[48px] px-4 bg-[#0a0a0a] rounded-xl text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
              />
            </div>
            {editError && (
              <p className="text-[12px] text-red-400 font-medium">{editError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => {
                  setEditPayment(null);
                  setEditError(null);
                }}
                className="flex-1 h-11 rounded-xl bg-white/[0.04] text-[12px] font-bold text-white/70 hover:bg-white/[0.07] transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-[#1f8a65] hover:bg-[#217356] text-white font-bold text-[12px] disabled:opacity-50 transition-colors"
              >
                {editSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}

      {stripeRequestPay && (
        <SendPaymentLinkModal
          isOpen={true}
          onClose={() => {
            setStripeRequestPay(null);
            loadData();
          }}
          clientId={stripeRequestPay.client?.id ?? ""}
          amount={stripeRequestPay.amount_eur}
          formulaName={stripeRequestPay.description ?? stripeRequestPay.subscription?.formula?.name ?? "Coaching"}
          paymentId={stripeRequestPay.id}
          subscriptionId={stripeRequestPay.subscription?.id}
        />
      )}
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-[#181818] border-subtle rounded-2xl p-5 flex items-center gap-4 ${alert ? "border border-amber-400/30" : ""}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert ? "bg-amber-400/10" : "bg-white/[0.02]"}`}
      >
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <p className="text-xl font-black text-white font-mono">{value}</p>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.18em]">
          {label}
        </p>
        <p className="text-[11px] text-white/45 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-[#181818] border-subtle rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
          <h3 className="text-[13px] font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
