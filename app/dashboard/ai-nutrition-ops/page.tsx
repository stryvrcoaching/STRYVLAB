"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, CheckCircle2, ChevronRight, Filter, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { InlineInfoTooltip } from "@/components/dashboard/InlineInfoTooltip";
import { DashboardSectionNav } from "@/components/dashboard/DashboardSectionNav";

type FeedbackStatus = "pending" | "reviewed" | "exported";
type FeedbackSource = "voice" | "text";

type FeedbackItem = {
  id: string;
  client_id: string;
  meal_id: string | null;
  source: FeedbackSource;
  transcript: string;
  meal_type: string | null;
  parsed_payload: any;
  corrected_payload: any;
  notes: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_email: string | null;
  metrics: {
    score?: number;
    precision?: number;
    recall?: number;
    id_match_rate?: number;
    quantity_accuracy?: number;
    meal_type_match?: boolean;
  } | null;
  issues: string[];
};

type OpsStats = {
  total: number;
  pending: number;
  reviewed: number;
  exported: number;
  voice: number;
  text: number;
  averageScore: number;
  topIssues: Array<{ key: string; label: string; count: number }>;
};

type LlmTraceStats = {
  windowHours: number;
  totalErrors: number;
  topErrorTypes: Array<{ key: string; count: number }>;
};

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  reviewed: "bg-sky-500/15 text-sky-300",
  exported: "bg-emerald-500/15 text-emerald-300",
};

const SOURCE_STYLES: Record<FeedbackSource, string> = {
  voice: "bg-white/[0.06] text-white/75",
  text: "bg-white/[0.06] text-white/55",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactPercent(value: number | undefined): string {
  if (typeof value !== "number") return "0%";
  return `${Math.round(value * 100)}%`;
}

function ItemList({ items }: { items: any[] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-[12px] text-white/30">Aucun aliment</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} className="rounded-xl bg-black/20 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-medium text-white">{item.name}</p>
            <p className="text-[11px] text-white/45">{item.quantity_g} g</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/35">
            <span>{item.food_item_id ? "catalogue" : "manuel"}</span>
            {item.category_l1 ? <span>{item.category_l1}</span> : null}
            {item.category_l2 ? <span>{item.category_l2}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AiNutritionOpsPage() {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [llmTraceStats, setLlmTraceStats] = useState<LlmTraceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | FeedbackSource>("all");
  const [search, setSearch] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useSetTopBar(
    <div className="flex flex-col leading-tight">
      <p className="text-[9px] font-medium text-white/30 uppercase tracking-[0.14em]">Ops interne</p>
      <p className="text-[13px] font-semibold text-white">Opérations IA</p>
    </div>,
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/dashboard/ai-nutrition-ops");
      if (res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setFeedbacks(data.feedbacks ?? []);
      setStats(data.stats ?? null);
      setLlmTraceStats(data.llmTraceStats ?? null);
      setSelectedId((current) => current ?? data.feedbacks?.[0]?.id ?? null);
    } catch {
      setError("Impossible de charger la console ops ou accès refusé.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredFeedbacks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return feedbacks.filter((feedback) => {
      if (statusFilter !== "all" && feedback.status !== statusFilter) return false;
      if (sourceFilter !== "all" && feedback.source !== sourceFilter) return false;
      if (!query) return true;
      const haystack = [
        feedback.client_name,
        feedback.client_email ?? "",
        feedback.transcript,
        feedback.issues.join(" "),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [feedbacks, search, sourceFilter, statusFilter]);

  const selected = filteredFeedbacks.find((feedback) => feedback.id === selectedId) ?? filteredFeedbacks[0] ?? null;

  useEffect(() => {
    if (!selected && filteredFeedbacks[0]) {
      setSelectedId(filteredFeedbacks[0].id);
    }
  }, [filteredFeedbacks, selected]);

  const updateStatus = async (id: string, status: FeedbackStatus) => {
    setUpdatingStatus(id);
    try {
      const res = await fetch("/api/dashboard/ai-nutrition-ops", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("update_failed");
      const previousStatus = feedbacks.find((feedback) => feedback.id === id)?.status ?? null;
      setFeedbacks((current) =>
        current.map((feedback) =>
          feedback.id === id
            ? { ...feedback, status, updated_at: new Date().toISOString() }
            : feedback,
        ),
      );
      setStats((current) => {
        if (!current) return current;
        const next = { ...current };
        if (previousStatus && previousStatus !== status) {
          next[previousStatus] -= 1;
          next[status] += 1;
        }
        return next;
      });
    } catch {
      setError("Impossible de mettre à jour le statut.");
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <div className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="h-[720px] rounded-2xl bg-white/[0.03] animate-pulse" />
            <div className="h-[720px] rounded-2xl bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] px-3 py-5 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <DashboardSectionNav items={[
          { id: 'ai-summary', label: 'Synthèse', description: 'Volume et qualité' },
          { id: 'ai-errors', label: 'Erreurs IA', description: 'Incidents récents' },
          { id: 'ai-feedbacks', label: 'Retours', description: 'File de traitement' },
        ]} />

        <section id="ai-summary" className="scroll-mt-40 rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f8a65]/15">
                  <Brain size={16} className="text-[#1f8a65]" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Observabilite IA</p>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[22px] font-semibold text-white">Qualité de l’analyse nutritionnelle</h1>
                    <InlineInfoTooltip title="Qualité de l’analyse nutritionnelle" body="Console d’exploitation pour relire les interprétations, qualifier les corrections et repérer les régressions IA." />
                  </div>
                </div>
              </div>
              <p className="mt-3 max-w-[760px] text-[13px] leading-6 text-white/45">
                Relire les interprétations voix et texte, corriger les écarts et repérer les régressions avant qu’elles ne se répètent.
              </p>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-[12px] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw size={13} />
              Rafraichir
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <div className="rounded-xl bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Total</p>
                <InlineInfoTooltip title="Total" body="Volume total de feedbacks de parsing remontés dans cette console." />
              </div>
              <p className="mt-1 text-[22px] font-semibold text-white">{stats?.total ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Pending</p>
              <p className="mt-1 text-[22px] font-semibold text-amber-300">{stats?.pending ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Reviewed</p>
              <p className="mt-1 text-[22px] font-semibold text-sky-300">{stats?.reviewed ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Voice</p>
              <p className="mt-1 text-[22px] font-semibold text-white">{stats?.voice ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Text</p>
              <p className="mt-1 text-[22px] font-semibold text-white">{stats?.text ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Score moyen</p>
              <p className="mt-1 text-[22px] font-semibold text-white">{stats?.averageScore ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(stats?.topIssues ?? []).map((issue) => (
              <span key={issue.key} className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-white/55">
                {issue.label} · {issue.count}
              </span>
            ))}
          </div>
        </section>

        <section id="ai-errors" className="scroll-mt-40 rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">LLM traces</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-white">Erreurs IA récentes</h2>
                <InlineInfoTooltip title="Erreurs IA récentes" body="Récapitulatif des erreurs LLM captées sur la fenêtre récente pour identifier les pannes dominantes." />
              </div>
            </div>
            <span className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-white/55">
              fenêtre {llmTraceStats?.windowHours ?? 24}h
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Total erreurs</p>
              <p className="mt-1 text-[24px] font-semibold text-white">{llmTraceStats?.totalErrors ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Types dominants</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(llmTraceStats?.topErrorTypes ?? []).length > 0 ? (
                  (llmTraceStats?.topErrorTypes ?? []).map((item) => (
                    <span key={item.key} className="rounded-full bg-white/[0.05] px-3 py-1 text-[11px] text-white/55">
                      {item.key} · {item.count}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-white/30">Aucune erreur LLM récente ou table non alimentée.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
            {error}
          </div>
        ) : null}

        <section id="ai-feedbacks" className="scroll-mt-40 grid grid-cols-1 items-start gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <Search size={13} className="text-white/30" />
              <InlineInfoTooltip title="Filtres feedbacks" body="Recherche et segmentation rapide des feedbacks à relire dans la file de traitement." />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Client, transcript, type d'erreur"
                className="h-10 flex-1 rounded-xl bg-black/20 px-3 text-[12px] text-white outline-none placeholder:text-white/20"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="rounded-xl bg-black/20 p-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/30">
                  <Filter size={11} />
                  Statut
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | FeedbackStatus)}
                  className="h-9 w-full rounded-lg bg-transparent text-[12px] text-white outline-none"
                >
                  <option value="all">Tous</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="exported">Exported</option>
                </select>
              </label>

              <label className="rounded-xl bg-black/20 p-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/30">
                  <SlidersHorizontal size={11} />
                  Source
                </div>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as "all" | FeedbackSource)}
                  className="h-9 w-full rounded-lg bg-transparent text-[12px] text-white outline-none"
                >
                  <option value="all">Toutes</option>
                  <option value="voice">Voice</option>
                  <option value="text">Text</option>
                </select>
              </label>
            </div>

            <div className="mt-4 space-y-2">
              {filteredFeedbacks.map((feedback) => (
                <button
                  key={feedback.id}
                  onClick={() => setSelectedId(feedback.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                    selected?.id === feedback.id
                      ? "border-[#1f8a65]/40 bg-[#1f8a65]/10"
                      : "border-white/[0.05] bg-black/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-white">{feedback.client_name}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/45">{feedback.transcript}</p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-white/20" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] ${STATUS_STYLES[feedback.status]}`}>{feedback.status}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] ${SOURCE_STYLES[feedback.source]}`}>{feedback.source}</span>
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/50">
                      score {feedback.metrics?.score ?? 0}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/30">
                    {feedback.issues.map((issue) => (
                      <span key={issue}>{issue}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-5">
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold text-white">{selected.client_name}</h2>
                      <InlineInfoTooltip title="Détail correction" body="Vue complète avant/après correction pour juger la qualité réelle de parsing et la valeur de la correction manuelle." />
                      <span className={`rounded-full px-2.5 py-1 text-[10px] ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] ${SOURCE_STYLES[selected.source]}`}>{selected.source}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/35">
                      {selected.client_email ?? "Sans email"} · {formatDate(selected.created_at)}
                    </p>
                    <p className="mt-3 rounded-xl bg-black/20 px-3 py-3 text-[13px] leading-6 text-white/75">
                      {selected.transcript}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["pending", "reviewed", "exported"] as FeedbackStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(selected.id, status)}
                        disabled={updatingStatus === selected.id || selected.status === status}
                        className={`rounded-xl px-3 py-2 text-[12px] transition-colors ${
                          selected.status === status
                            ? "bg-white/[0.10] text-white"
                            : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {updatingStatus === selected.id && selected.status !== status ? "..." : status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Score</p>
                    <p className="mt-1 text-[20px] font-semibold text-white">{selected.metrics?.score ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Precision</p>
                    <p className="mt-1 text-[20px] font-semibold text-white">{compactPercent(selected.metrics?.precision)}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Recall</p>
                    <p className="mt-1 text-[20px] font-semibold text-white">{compactPercent(selected.metrics?.recall)}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">ID match</p>
                    <p className="mt-1 text-[20px] font-semibold text-white">{compactPercent(selected.metrics?.id_match_rate)}</p>
                  </div>
                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/30">Quantite</p>
                    <p className="mt-1 text-[20px] font-semibold text-white">{compactPercent(selected.metrics?.quantity_accuracy)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-white">Parse initial</h3>
                      <span className="text-[11px] text-white/30">{selected.parsed_payload?.meal_type ?? "n/a"}</span>
                    </div>
                    <ItemList items={selected.parsed_payload?.items ?? []} />
                  </div>
                  <div className="rounded-2xl bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-white">Correction finale</h3>
                      <span className="text-[11px] text-white/30">{selected.corrected_payload?.meal_type ?? "n/a"}</span>
                    </div>
                    <ItemList items={selected.corrected_payload?.items ?? []} />
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#1f8a65]" />
                    <h3 className="text-[13px] font-semibold text-white">Types d'ecarts</h3>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.issues.map((issue) => (
                      <span key={issue} className="rounded-full bg-black/20 px-3 py-1 text-[11px] text-white/60">
                        {issue}
                      </span>
                    ))}
                  </div>
                  {selected.notes ? (
                    <p className="mt-4 text-[12px] leading-6 text-white/50">{selected.notes}</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[540px] items-center justify-center text-[13px] text-white/30">
                Aucun feedback sur ce filtre.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
