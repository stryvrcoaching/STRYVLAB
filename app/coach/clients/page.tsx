"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  X,
  Loader2,
  Mail,
  Phone,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  User,
  Filter,
  LayoutGrid,
  List,
  Tag,
  CreditCard,
  ArrowRight,
  TrendingUp,
  ChevronDown,
  BarChart3,
  MessageSquareWarning,
  Bell,
  Salad,
  Dumbbell,
  ClipboardList,
  HeartPulse,
  Activity,
  MessageSquare,
} from "lucide-react";
import { useDockActions } from "@/components/layout/NavDock";
import { useDock } from "@/components/layout/DockContext";
import { Skeleton } from "@/components/ui/skeleton";
import ClientsActionStrip from "@/components/coach/ClientsActionStrip";
import ClientActionPanels from "@/components/coach/ClientActionPanels";
import {
  getTransformationPhaseLabel,
  TRANSFORMATION_PHASE_OPTIONS,
} from "@/lib/coach/transformationPhase";
import type { ClientActionItem } from "@/lib/coach/client-action-items";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tag = { id: string; name: string; color: string };

type Subscription = {
  id: string;
  status: string;
  formula: { name: string; price_eur: number; billing_cycle: string } | null;
};

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  goal: string | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
  transformation_phase: string | null;
  training_goal: string | null;
  fitness_level: string | null;
  created_at: string;
  profile_photo_url?: string | null;
  // enriched client-side
  tags?: Tag[];
  subscriptions?: Subscription[];
  lastActivity?: string | null;
};

type ClientNotification = {
  id: string;
  source: "coach" | "shared" | "legacy";
  clientId: string;
  clientName: string;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  category: string;
  categoryLabel: string;
  subcategory: string | null;
  eventLabel: string | null;
  status: string;
  actionUrl: string;
  createdAt: string;
};

type ClientStripStats = {
  total: number;
  active: number;
  withoutFormula: number;
  toFollow: number;
};

type WithoutFormulaRow = {
  clientId: string;
  clientName: string;
  createdAt: string | null;
};

type PlanningChoiceState = {
  item: ClientActionItem;
  suggestedMode: "agenda" | "kanban" | "both";
} | null;

function getPlanningRecommendationCopy(
  item: ClientActionItem,
  suggestedMode: "agenda" | "kanban" | "both",
) {
  if (item.kind === "upcoming_event_preparation") {
    return suggestedMode === "both"
      ? "Recommandé car un événement approche et il faut à la fois un rappel et une tâche de préparation."
      : "Recommandé car un événement approche et demande une préparation rapide."
  }

  if (item.kind === "missing_formula") {
    return "Recommandé car le sujet est commercial et doit être traité rapidement sans se perdre dans le flux."
  }

  if (item.kind === "assessment_review") {
    return suggestedMode === "agenda"
      ? "Recommandé car le sujet demande surtout un point de revue daté."
      : "Recommandé car le bilan doit être suivi dans l’organisation coach."
  }

  if (item.kind === "kanban_blocker") {
    return "Recommandé car une action est déjà dans le flux d’organisation et doit être reprise proprement."
  }

  if (item.kind === "coach_notification") {
    return "Recommandé car rien n’est encore planifié et le sujet doit être cadré avant d’être oublié."
  }

  return suggestedMode === "both"
    ? "Recommandé car cette priorité mérite à la fois un rappel et une trace opérationnelle."
    : suggestedMode === "kanban"
    ? "Recommandé car cette priorité doit être suivie comme une vraie tâche."
    : "Recommandé car cette priorité a surtout besoin d’un rappel daté."
}

const NOTIFICATION_BADGES: Record<string, { icon: React.ElementType; className: string }> = {
  assessment: { icon: ClipboardList, className: "bg-sky-500/10 text-sky-300" },
  training: { icon: Dumbbell, className: "bg-violet-500/10 text-violet-300" },
  nutrition: { icon: Salad, className: "bg-[#1f8a65]/12 text-[#8ef0c7]" },
  recovery: { icon: HeartPulse, className: "bg-amber-500/10 text-amber-300" },
  progress: { icon: Activity, className: "bg-cyan-500/10 text-cyan-300" },
  feedback: { icon: MessageSquare, className: "bg-pink-500/10 text-pink-300" },
  engagement: { icon: Bell, className: "bg-orange-500/10 text-orange-300" },
  admin: { icon: CreditCard, className: "bg-emerald-500/10 text-emerald-300" },
  system: { icon: Bell, className: "bg-white/[0.06] text-white/55" },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TRANSFORMATION_PHASE_FILTERS = TRANSFORMATION_PHASE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));
const GOAL_LABELS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  fat_loss: "Perte de gras",
  endurance: "Endurance",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athletic",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};
const STATUS_CONFIG = {
  active: { label: "Actif", cls: "bg-[#1f8a65]/15 text-[#1f8a65]" },
  inactive: { label: "Inactif", cls: "bg-amber-500/15 text-amber-400" },
  archived: { label: "Archivé", cls: "bg-white/[0.06] text-white/35" },
};
const SUB_STATUS_CONFIG: Record<string, { dot: string }> = {
  active: { dot: "bg-emerald-400" },
  trial: { dot: "bg-blue-400" },
  paused: { dot: "bg-amber-400" },
  cancelled: { dot: "bg-red-400" },
  expired: { dot: "bg-white/30" },
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  gender: string;  // 'male' | 'female' | 'other' | 'prefer_not_to_say'
};
const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  gender: "prefer_not_to_say",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(c: Client) {
  return `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`.toUpperCase();
}

function getPhaseText(client: Client) {
  return getTransformationPhaseLabel(client.transformation_phase);
}

function avatarColor(id: string) {
  const colors = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#0ea5e9",
    "#10b981",
    "#f59e0b",
    "#ef4444",
  ];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xfffffff;
  return colors[hash % colors.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoachClientsPage() {
  const router = useRouter();
  const { openClient } = useDock();

  const [clients, setClients] = useState<Client[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [pendingNotifs, setPendingNotifs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notificationsClient, setNotificationsClient] = useState<Client | null>(null);
  const [clientNotifications, setClientNotifications] = useState<ClientNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [withoutFormulaOpen, setWithoutFormulaOpen] = useState(false);
  const [toFollowOpen, setToFollowOpen] = useState(false);
  const [focusedClientIds, setFocusedClientIds] = useState<string[] | null>(null);
  const [actionStats, setActionStats] = useState<ClientStripStats>({
    total: 0,
    active: 0,
    withoutFormula: 0,
    toFollow: 0,
  });
  const [withoutFormulaRows, setWithoutFormulaRows] = useState<WithoutFormulaRow[]>([]);
  const [toFollowRows, setToFollowRows] = useState<ClientActionItem[]>([]);
  const [planningChoice, setPlanningChoice] = useState<PlanningChoiceState>(null);

  useDockActions({
    NEW_CLIENT: () => setShowModal(true),
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterSub, setFilterSub] = useState<string>("all"); // 'all' | 'with_sub' | 'no_sub'
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    const stored = window.localStorage.getItem("coach_clients_view_mode");
    return stored === "list" ? "list" : "grid";
  });

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/");
    });
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("coach_clients_view_mode", viewMode);
  }, [viewMode]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const [clientsRes, tagsRes, notifsRes, actionsRes] = await Promise.all([
      fetch("/api/clients"),
      fetch("/api/tags"),
      fetch("/api/coach/inbox?summary=true"),
      fetch("/api/coach/client-actions"),
    ]);

    const clientsData = clientsRes.ok
      ? await clientsRes.json()
      : { clients: [] };
    const tagsData = tagsRes.ok ? await tagsRes.json() : { tags: [] };
    const notifsData = notifsRes.ok ? await notifsRes.json() : { pending: {} };
    const actionsData = actionsRes.ok
      ? await actionsRes.json()
      : {
          stats: { total: 0, active: 0, withoutFormula: 0, toFollow: 0 },
          withoutFormula: [],
          toFollow: [],
        };
    
    setAllTags(tagsData.tags ?? []);
    setPendingNotifs(notifsData.pending ?? {});
    setActionStats(actionsData.stats ?? { total: 0, active: 0, withoutFormula: 0, toFollow: 0 });
    setWithoutFormulaRows(actionsData.withoutFormula ?? []);
    setToFollowRows(actionsData.toFollow ?? []);

    const baseClients: Client[] = clientsData.clients ?? [];

    // Setter clients + loading ensemble pour éviter le flash empty state
    setClients(baseClients);
    setLoading(false);
    // Note: React 18 batche ces deux setState dans le même render en mode concurrent

    // Enrichissement progressif en arrière-plan — un client à la fois pour éviter le N+1 en rafale
    for (const c of baseClients) {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/clients/${c.id}/tags`),
        fetch(`/api/clients/${c.id}/subscriptions`),
      ]);
      const tags = tRes.ok ? ((await tRes.json()).tags ?? []) : [];
      const subscriptions = sRes.ok
        ? ((await sRes.json()).subscriptions ?? [])
        : [];
      setClients((prev) =>
        prev.map((p) => (p.id === c.id ? { ...p, tags, subscriptions } : p)),
      );
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    if (
      q &&
      !`${c.first_name} ${c.last_name} ${c.email ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterPhase !== "all" && c.transformation_phase !== filterPhase) return false;
    if (filterTag !== "all" && !c.tags?.some((t) => t.id === filterTag))
      return false;
    if (
      filterSub === "with_sub" &&
      !c.subscriptions?.some((s) => s.status === "active")
    )
      return false;
    if (
      filterSub === "no_sub" &&
      c.subscriptions?.some((s) => s.status === "active")
    )
      return false;
    if (focusedClientIds && !focusedClientIds.includes(c.id)) return false;
    return true;
  });

  // ── Stats bar ──────────────────────────────────────────────────────────────

  const openClientProfile = useCallback((clientId: string) => {
    const client = clients.find((row) => row.id === clientId);
    if (client) {
      openClient({ id: client.id, firstName: client.first_name, lastName: client.last_name });
    }
    router.push(`/coach/clients/${clientId}`);
  }, [clients, openClient, router]);

  // ── Form ───────────────────────────────────────────────────────────────────

  const setField = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!form.email.trim()) {
      setError("L'email est obligatoire.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Une erreur est survenue.");
      setSubmitting(false);
      return;
    }

    setSuccess(
      `${data.client.first_name} ${data.client.last_name} a été ajouté.`,
    );
    setClients((prev) => [
      { ...data.client, tags: [], subscriptions: [] },
      ...prev,
    ]);
    setForm(EMPTY_FORM);
    setSubmitting(false);
    setTimeout(() => {
      setShowModal(false);
      setSuccess(null);
    }, 1500);
  };

  const openNotifications = useCallback(async (client: Client) => {
    setNotificationsClient(client);
    setNotificationsLoading(true);
    try {
      const res = await fetch(`/api/coach/inbox?client=${client.id}`);
      const data = await res.json().catch(() => ({ notifications: [] }));
      setClientNotifications(data.notifications ?? []);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const handleOpenNotificationsForClient = useCallback((clientId: string) => {
    const client = clients.find((row) => row.id === clientId);
    if (!client) return;
    void openNotifications(client);
  }, [clients, openNotifications]);

  const handlePlanPriority = useCallback(async (item: ClientActionItem, mode: "agenda" | "kanban" | "both") => {
    await fetch(`/api/coach/client-actions/${encodeURIComponent(item.priorityKey)}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        clientId: item.clientId,
        clientName: item.clientName,
        kind: item.kind,
        reason: item.reason,
      }),
    });
    await fetchClients();
  }, [fetchClients]);

  const handleMarkPriorityTreated = useCallback(async (item: ClientActionItem) => {
    await fetch(`/api/coach/client-actions/${encodeURIComponent(item.priorityKey)}/treat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: item.clientId,
        kind: item.kind,
        actionTaken: "mark_treated",
      }),
    });
    await fetchClients();
  }, [fetchClients]);

  const handleOpenKanbanForPriority = useCallback((_item: ClientActionItem) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dashboard_active_view", "kanban");
    }
    router.push("/dashboard");
  }, [router]);

  const handleRequestPlanChoice = useCallback((item: ClientActionItem, suggestedMode: "agenda" | "kanban" | "both") => {
    setPlanningChoice({ item, suggestedMode });
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    setClientNotifications((current) => current.filter((item) => item.id !== notificationId));
    await fetch(`/api/coach/inbox`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [notificationId] }),
    });
    if (notificationsClient) {
      setPendingNotifs((current) => ({
        ...current,
        [notificationsClient.id]: Math.max((current[notificationsClient.id] ?? 1) - 1, 0),
      }));
    }
  }, [notificationsClient]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!notificationsClient) return;
    const notificationIds = clientNotifications.map((notification) => notification.id);
    setClientNotifications([]);
    if (notificationIds.length === 0) return;
    await fetch(`/api/coach/inbox`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: notificationIds }),
    });
    setPendingNotifs((current) => ({
      ...current,
      [notificationsClient.id]: 0,
    }));
  }, [clientNotifications, notificationsClient]);

  const activeFiltersCount = [
    filterStatus !== "all",
    filterPhase !== "all",
    filterTag !== "all",
    filterSub !== "all",
    focusedClientIds !== null,
  ].filter(Boolean).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#121212] font-sans">
      <div className="p-6 max-w-[1200px] mx-auto">
        {/* STATS STRIP */}
        <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <ClientsActionStrip
            stats={actionStats}
            onOpenWithoutFormula={() => setWithoutFormulaOpen(true)}
            onOpenToFollow={() => setToFollowOpen(true)}
          />
        </div>

        {/* SEARCH + FILTERS BAR */}
        <div
          className={`flex items-center gap-3 mb-4 transition-all duration-500 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-[#0a0a0a] border-input pl-9 pr-4 h-10 text-[13px] text-white placeholder:text-white/25 outline-none"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 h-10 rounded-xl border-button text-xs font-semibold transition-all ${
              showFilters || activeFiltersCount > 0
                ? "bg-[#1f8a65] text-white"
                : "bg-[#181818] text-white/45 hover:text-white/80"
            }`}
          >
            <Filter size={13} />
            Filtres
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/20 text-white text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* View mode */}
          <div className="flex items-center gap-0.5 bg-[#181818] border-subtle rounded-xl p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${viewMode === "grid" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${viewMode === "list" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"}`}
            >
              <List size={13} />
            </button>
          </div>

          <p className="text-xs font-semibold text-white/30 ml-auto tabular-nums">
            {filtered.length} / {clients.length}
          </p>
        </div>

        {focusedClientIds !== null && (
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFocusedClientIds(null)}
              className="inline-flex items-center gap-2 rounded-full border border-[#8ef0c7]/16 bg-[#1f8a65]/10 px-4 py-2 text-[12px] font-semibold text-[#8ef0c7] transition-colors hover:bg-[#1f8a65]/16"
            >
              Vue prioritaire active
              <span className="text-white/42">·</span>
              Réinitialiser
            </button>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/34">
              {focusedClientIds.length} client{focusedClientIds.length > 1 ? "s" : ""} ciblé{focusedClientIds.length > 1 ? "s" : ""}
            </p>
          </div>
        )}

        {/* FILTER PANEL */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-[#181818] border-subtle rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Statut",
                    value: filterStatus,
                    onChange: setFilterStatus,
                    options: [
                      ["all", "Tous"],
                      ["active", "Actif"],
                      ["inactive", "Inactif"],
                      ["archived", "Archivé"],
                    ],
                  },
                  {
                    label: "Phase",
                    value: filterPhase,
                    onChange: setFilterPhase,
                    options: [
                      ["all", "Tous"],
                      ...TRANSFORMATION_PHASE_FILTERS.map((phase) => [phase.value, phase.label]),
                    ],
                  },
                  {
                    label: "Tag",
                    value: filterTag,
                    onChange: setFilterTag,
                    options: [
                      ["all", "Tous"],
                      ...allTags.map((t) => [t.id, t.name]),
                    ],
                  },
                  {
                    label: "Formule",
                    value: filterSub,
                    onChange: setFilterSub,
                    options: [
                      ["all", "Tous"],
                      ["with_sub", "Avec formule active"],
                      ["no_sub", "Sans formule"],
                    ],
                  },
                ].map(({ label, value, onChange, options }) => (
                  <div key={label} className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      {label}
                    </label>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full rounded-xl bg-[#0a0a0a] border-input px-3 h-10 text-[13px] text-white outline-none"
                    >
                      {options.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CLIENT LIST */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-[#181818] border-subtle rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="h-px bg-white/[0.05]" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#181818] flex items-center justify-center mb-4">
              <Users size={24} className="text-white/30" />
            </div>
            <p className="text-sm font-bold text-white mb-1">
              {search || activeFiltersCount > 0
                ? "Aucun résultat"
                : "Aucun client pour l'instant"}
            </p>
            <p className="text-xs text-white/45 mb-6">
              {search || activeFiltersCount > 0
                ? "Ajustez vos filtres."
                : "Créez votre premier client pour commencer le suivi."}
            </p>
            {!search && activeFiltersCount === 0 && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] transition-colors"
              >
                <UserPlus size={14} />
                Créer un client
              </button>
            )}
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((client, i) => (
              <ClientCard
                key={client.id}
                client={client}
                index={i}
                pendingCount={pendingNotifs[client.id] || 0}
                onOpenNotifications={() => openNotifications(client)}
                onClick={() => {
                  openClient({ id: client.id, firstName: client.first_name, lastName: client.last_name });
                  router.push(`/coach/clients/${client.id}`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-[#181818] border-subtle rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Client
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden md:table-cell">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden lg:table-cell">
                    Phase / objectif / niveau
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Formule
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 hidden md:table-cell">
                    Tags
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                    Statut
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    index={i}
                    pendingCount={pendingNotifs[client.id] || 0}
                    onOpenNotifications={() => openNotifications(client)}
                    onClick={() => {
                      openClient({ id: client.id, firstName: client.first_name, lastName: client.last_name });
                      router.push(`/coach/clients/${client.id}`);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientActionPanels
        withoutFormulaOpen={withoutFormulaOpen}
        toFollowOpen={toFollowOpen}
        withoutFormula={withoutFormulaRows}
        toFollow={toFollowRows}
        onCloseWithoutFormula={() => setWithoutFormulaOpen(false)}
        onCloseToFollow={() => setToFollowOpen(false)}
        onHeaderWithoutFormulaClick={() => {
          setFilterSub("no_sub");
          setFocusedClientIds(null);
          setWithoutFormulaOpen(false);
        }}
        onHeaderToFollowClick={() => {
          setFocusedClientIds(toFollowRows.map((item) => item.clientId));
          setToFollowOpen(false);
        }}
        onOpenClient={openClientProfile}
        onAssignFormula={openClientProfile}
        onOpenNotifications={handleOpenNotificationsForClient}
        onOpenAssessments={openClientProfile}
        onOpenKanban={handleOpenKanbanForPriority}
        onPlanPriority={handlePlanPriority}
        onRequestPlanChoice={handleRequestPlanChoice}
        onMarkTreated={handleMarkPriorityTreated}
      />

      <AnimatePresence>
        {planningChoice && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md z-[74]"
              onClick={() => setPlanningChoice(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="fixed inset-0 z-[75] flex items-center justify-center p-4"
            >
              <div
                className="w-full max-w-md rounded-2xl bg-[#181818] border-subtle p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">
                      Organisation
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      Planifier cette priorité
                    </h3>
                    <p className="mt-1 text-[12px] text-white/45">
                      {planningChoice.item.clientName} · {planningChoice.item.reason}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlanningChoice(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/55"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <div className="rounded-xl bg-white/[0.03] border-subtle px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/32">
                      Pourquoi cette reco
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-white/58">
                      {getPlanningRecommendationCopy(planningChoice.item, planningChoice.suggestedMode)}
                    </p>
                  </div>
                  {[
                    {
                      mode: "agenda" as const,
                      title: "Créer une alerte",
                      desc: "Ajoute un rappel dans l’agenda coach.",
                    },
                    {
                      mode: "kanban" as const,
                      title: "Ajouter au kanban",
                      desc: "Transforme la priorité en tâche à suivre.",
                    },
                    {
                      mode: "both" as const,
                      title: "Les deux",
                      desc: "Crée une alerte et une tâche liées.",
                    },
                  ].map((option) => {
                    const recommended = option.mode === planningChoice.suggestedMode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={async () => {
                          const item = planningChoice.item;
                          setPlanningChoice(null);
                          await handlePlanPriority(item, option.mode);
                        }}
                        className={`w-full rounded-2xl border-subtle px-4 py-4 text-left transition-colors ${
                          recommended ? "bg-[#1f8a65]/10 hover:bg-[#1f8a65]/15" : "bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-white">
                              {option.title}
                            </p>
                            <p className="mt-1 text-[12px] text-white/45">
                              {option.desc}
                            </p>
                          </div>
                          {recommended && (
                            <span className="rounded-full bg-[#1f8a65]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7fe2bf]">
                              Recommandé
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MODAL CRÉATION CLIENT */}
      <AnimatePresence>
        {notificationsClient && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-md z-[72]"
              onClick={() => setNotificationsClient(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="fixed inset-x-4 top-[8vh] z-[73] mx-auto w-full max-w-2xl rounded-[28px] border border-white/[0.08] bg-[#181818] p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Notifications athlète
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">
                    {notificationsClient.first_name} {notificationsClient.last_name}
                  </h3>
                  <p className="mt-1 text-[12px] text-white/45">
                    Historique des alertes encore en attente pour ce client.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {clientNotifications.length > 0 && !notificationsLoading ? (
                    <button
                      onClick={() => void markAllNotificationsRead()}
                      className="rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/70"
                    >
                      Tout marquer comme lu
                    </button>
                  ) : null}
                  <button
                    onClick={() => setNotificationsClient(null)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/55"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {notificationsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="mt-3 h-3 w-full" />
                      </div>
                    ))}
                  </div>
                ) : clientNotifications.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center">
                    <p className="text-sm font-semibold text-white">Aucune notification en attente</p>
                  </div>
                ) : (
                  clientNotifications.map((notification) => {
                    const badge = NOTIFICATION_BADGES[notification.category] ?? NOTIFICATION_BADGES.system;
                    const BadgeIcon = badge.icon;
                    return (
                      <div
                        key={notification.id}
                        className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${badge.className}`}>
                                <BadgeIcon size={11} />
                                {notification.categoryLabel}
                              </span>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-white">
                              {notification.title || "Notification coach"}
                            </p>
                            {notification.body && (
                              <p className="mt-2 text-[12px] leading-relaxed text-white/60">
                                {notification.body}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-white/35">
                              {timeAgo(notification.createdAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => {
                                setNotificationsClient(null);
                                router.push(notification.actionUrl);
                              }}
                              className="rounded-xl bg-white/[0.08] px-3 py-2 text-[11px] font-bold text-white/80"
                            >
                              Ouvrir
                            </button>
                            <button
                              onClick={() => markNotificationRead(notification.id)}
                              className="rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white/65"
                            >
                              Marquer lu
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}

        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-[70]"
              onClick={() => !submitting && setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#181818] border-subtle rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-7 pt-7 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1f8a65]/20 flex items-center justify-center">
                      <User
                        size={16}
                        className="text-[#1f8a65]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        Nouveau client
                      </h2>
                      <p className="text-xs text-white/45">
                        Remplissez les informations du client
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                    className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mx-7 mb-2 p-3 bg-red-500/10 rounded-xl flex items-center gap-2"
                    >
                      <AlertCircle
                        size={13}
                        className="text-red-400 shrink-0"
                      />
                      <p className="text-xs text-red-400 font-semibold">
                        {error}
                      </p>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mx-7 mb-2 p-3 bg-[#1f8a65]/10 rounded-xl flex items-center gap-2"
                    >
                      <CheckCircle2
                        size={13}
                        className="text-[#1f8a65] shrink-0"
                      />
                      <p className="text-xs text-[#1f8a65] font-semibold">
                        {success}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Jean"
                        value={form.firstName}
                        onChange={(e) => setField("firstName", e.target.value)}
                        className="w-full rounded-xl bg-[#0a0a0a] px-4 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                        Nom *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dupont"
                        value={form.lastName}
                        onChange={(e) => setField("lastName", e.target.value)}
                        className="w-full rounded-xl bg-[#0a0a0a] px-4 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />
                      <input
                        type="email"
                        required
                        placeholder="jean@email.com"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        className="w-full rounded-xl bg-[#0a0a0a] pl-9 pr-4 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                      Téléphone
                    </label>
                    <div className="relative">
                      <Phone
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />
                      <input
                        type="tel"
                        placeholder="+33 6 ..."
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        className="w-full rounded-xl bg-[#0a0a0a] pl-9 pr-4 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                      Notes
                    </label>
                    <div className="relative">
                      <FileText
                        size={13}
                        className="absolute left-3 top-3 text-white/25"
                      />
                      <textarea
                        placeholder="Contraintes, historique, remarques..."
                        value={form.notes}
                        onChange={(e) => setField("notes", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl bg-[#0a0a0a] pl-9 pr-4 py-2.5 text-[13px] text-white placeholder:text-white/20 outline-none resize-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-1">
                      Genre
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) => setField("gender", e.target.value)}
                      className="w-full rounded-xl bg-[#0a0a0a] px-4 h-10 text-[13px] text-white outline-none cursor-pointer"
                    >
                      <option value="prefer_not_to_say">Préférez ne pas dire</option>
                      <option value="male">Homme</option>
                      <option value="female">Femme</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Création
                        en cours...
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Créer le client
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ClientCard({
  client,
  index,
  pendingCount,
  onOpenNotifications,
  onClick,
}: {
  client: Client;
  index: number;
  pendingCount?: number;
  onOpenNotifications: () => void;
  onClick: () => void;
}) {
  const activeSub = client.subscriptions?.find((s) => s.status === "active");
  const color = avatarColor(client.id);
  const statusCfg = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.active;
  const phaseText = getPhaseText(client);
  const [entering, setEntering] = useState(false);

  function handleClick() {
    if (entering) return;
    setEntering(true);
    setTimeout(() => onClick(), 320);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: entering ? 0.97 : 1,
        backgroundColor: entering ? "rgba(31,138,101,0.08)" : undefined,
      }}
      transition={
        entering
          ? { duration: 0.18, ease: "easeIn" }
          : { delay: index * 0.04 }
      }
      onClick={handleClick}
      className="bg-[#181818] border-subtle rounded-2xl p-5 hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer"
    >
      {/* Avatar + name + status */}
      <div className="flex items-start gap-3 mb-4">
        <div className="relative">
          {client.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.profile_photo_url}
              alt={`${client.first_name} ${client.last_name}`}
              className="w-11 h-11 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
              style={{ backgroundColor: color }}
            >
              {getInitials(client)}
            </div>
          )}
          {!!pendingCount && pendingCount > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenNotifications();
              }}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#181818] bg-red-500 text-[10px] font-black text-white"
            >
              {pendingCount}
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white text-sm truncate">
            {client.first_name} {client.last_name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}
            >
              {statusCfg.label}
            </span>
            {phaseText && (
              <span className="text-[10px] text-[#7fe0b8] font-semibold">
                {phaseText}
              </span>
            )}
            {phaseText && client.training_goal && <span className="text-white/15">·</span>}
            {client.training_goal && (
              <span className="text-[10px] text-white/35 font-medium">
                {GOAL_LABELS[client.training_goal] ?? client.training_goal}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-1.5 mb-4">
        {client.email && (
          <div className="flex items-center gap-2 text-xs text-white/45">
            <Mail size={11} className="shrink-0 text-white/30" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-white/45">
            <Phone size={11} className="shrink-0 text-white/30" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.fitness_level && (
          <div className="flex items-center gap-2 text-xs text-white/45">
            <BarChart3 size={11} className="shrink-0 text-white/30" />
            <span>
              {LEVEL_LABELS[client.fitness_level] ?? client.fitness_level}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {client.tags && client.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {client.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {client.tags.length > 3 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/45">
              +{client.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: formule + date */}
      <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between">
        {activeSub ? (
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${SUB_STATUS_CONFIG[activeSub.status]?.dot ?? "bg-gray-400"}`}
            />
            <span className="text-[11px] font-semibold text-white/45 truncate max-w-[120px]">
              {activeSub.formula?.name ?? "Formule active"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            <span className="text-[11px] text-white/30 font-medium">
              Pas de formule
            </span>
          </div>
        )}
        <p className="text-[10px] text-white/30 font-medium">
          {new Date(client.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>

      {client.status === "inactive" && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#1f8a65]/15 border border-[#1f8a65]/30 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#7fe2bf]">
            <Mail size={12} /> Accès STRYVR à envoyer
          </span>
          <ArrowRight size={13} className="text-[#7fe2bf]" />
        </div>
      )}
    </motion.div>
  );
}

function ClientRow({
  client,
  index,
  pendingCount,
  onOpenNotifications,
  onClick,
}: {
  client: Client;
  index: number;
  pendingCount?: number;
  onOpenNotifications: () => void;
  onClick: () => void;
}) {
  const activeSubs =
    client.subscriptions?.filter((s) => s.status === "active") ?? [];
  const color = avatarColor(client.id);
  const statusCfg = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.active;
  const phaseText = getPhaseText(client);
  const [entering, setEntering] = useState(false);

  function handleClick() {
    if (entering) return;
    setEntering(true);
    setTimeout(() => onClick(), 280);
  }

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: entering ? 0.6 : 1, x: 0 }}
      transition={entering ? { duration: 0.15 } : { delay: index * 0.03 }}
      onClick={handleClick}
      className="border-b border-white/[0.07] last:border-0 hover:bg-white/[0.04] cursor-pointer transition-colors"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            {client.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.profile_photo_url}
                alt={`${client.first_name} ${client.last_name}`}
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
                style={{ backgroundColor: color }}
              >
                {getInitials(client)}
              </div>
            )}
            {!!pendingCount && pendingCount > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenNotifications();
                }}
                className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-[#181818] bg-red-500 text-[8px] font-black text-white"
              >
                {pendingCount > 1 ? pendingCount : ""}
              </button>
            )}
          </div>
          <span className="font-semibold text-white text-sm">
            {client.first_name} {client.last_name}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="space-y-0.5">
          {client.email && (
            <p className="text-xs text-white/45 truncate max-w-[160px]">
              {client.email}
            </p>
          )}
          {client.phone && (
            <p className="text-xs text-white/35">{client.phone}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="space-y-0.5">
          {phaseText && (
            <p className="text-xs text-[#7fe0b8] font-semibold">
              {phaseText}
            </p>
          )}
          {client.training_goal && (
            <p className="text-xs text-white font-medium">
              {GOAL_LABELS[client.training_goal]}
            </p>
          )}
          {client.fitness_level && (
            <p className="text-xs text-white/35">
              {LEVEL_LABELS[client.fitness_level]}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          {activeSubs.length === 0 ? (
            <span className="text-[11px] text-white/30">—</span>
          ) : (
            activeSubs.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${SUB_STATUS_CONFIG[s.status]?.dot ?? "bg-gray-400"}`}
                />
                <span className="text-xs font-medium text-white truncate max-w-[120px]">
                  {s.formula?.name ?? "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {(client.tags ?? []).slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {(client.tags?.length ?? 0) > 2 && (
            <span className="text-[10px] text-white/30">
              +{(client.tags?.length ?? 0) - 2}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}
        >
          {statusCfg.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <ChevronDown size={14} className="text-white/25 -rotate-90" />
      </td>
    </motion.tr>
  );
}
