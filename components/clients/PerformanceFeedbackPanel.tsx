"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerformanceRecommendation } from "@/lib/performance/recommendations";
import type { PerformanceAnalysis } from "@/lib/performance/analyzer";

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface PerformanceSummaryResponse {
  analysis: PerformanceAnalysis;
  recommendations: PerformanceRecommendation[];
}

interface ProposalCard extends PerformanceRecommendation {
  proposal_id?: string; // présent après persistance en DB (GET /program-adjustments)
}

// ─── Labels FR ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PerformanceRecommendation["type"], string> = {
  increase_volume: "Augmenter le volume",
  decrease_volume: "Réduire le volume",
  increase_weight: "Augmenter la charge",
  swap_exercise: "Proposer un exercice alternatif",
  add_rest_day: "Ajouter un jour de repos",
};

const PRIORITY_COLORS: Record<
  PerformanceRecommendation["priority"],
  string
> = {
  high: "bg-red-500/15 text-red-400 border-red-500/20",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  low: "bg-white/[0.04] text-white/40 border-white/[0.06]",
};

const PRIORITY_LABELS: Record<PerformanceRecommendation["priority"], string> = {
  high: "Priorité haute",
  medium: "Priorité moyenne",
  low: "Priorité basse",
};

// ─── Helper : résumé valeur actuelle → proposée ───────────────────────────────

function buildValueSummary(rec: PerformanceRecommendation): string | null {
  if (rec.type === "increase_volume" || rec.type === "decrease_volume") {
    const current = rec.current_value.sets as number | undefined;
    const proposed = rec.proposed_value.sets as number | undefined;
    if (current !== undefined && proposed !== undefined) {
      return `${current} série${current > 1 ? "s" : ""} → ${proposed} série${proposed > 1 ? "s" : ""}`;
    }
  }
  if (rec.type === "increase_weight") {
    const currentKg = rec.current_value.current_weight_kg as number | null | undefined;
    if (currentKg !== null && currentKg !== undefined) {
      return `${currentKg} kg → +incrément configuré`;
    }
    return "Charge actuelle → +incrément configuré";
  }
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props {
  clientId: string;
}

export default function PerformanceFeedbackPanel({ clientId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<ProposalCard[]>([]);
  const [actioning, setActioning] = useState<Record<string, boolean>>({});

  // Fetch performance-summary — génère les recommandations à la volée
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/performance-summary?weeks=8`,
      );
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const json: PerformanceSummaryResponse = await res.json();
      setCards(json.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Approve / Reject — crée d'abord le proposal, puis l'approuve/rejette
  const handleAction = useCallback(
    async (
      rec: ProposalCard,
      action: "approve" | "reject",
      idx: number,
    ) => {
      const key = `${idx}-${action}`;
      setActioning((prev) => ({ ...prev, [key]: true }));

      try {
        // Étape 1 : créer le proposal en DB
        const createRes = await fetch(
          `/api/clients/${clientId}/program-adjustments/create`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exercise_id: rec.exercise_id,
              type: rec.type,
              reason: rec.reason,
              proposed_value: rec.proposed_value,
              current_value: rec.current_value,
            }),
          },
        );

        let proposalId: string | undefined = rec.proposal_id;

        if (createRes.ok) {
          const created = await createRes.json();
          proposalId = created.data?.id;
        }

        // Étape 2 : si un proposal_id est disponible, appliquer l'action
        if (proposalId) {
          await fetch(`/api/clients/${clientId}/program-adjustments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposal_id: proposalId, action }),
          });
        }

        // Retirer optimistiquement la card
        setCards((prev) => prev.filter((_, i) => i !== idx));
      } catch {
        // Pas de toast — retrait silencieux en cas d'erreur non fatale
      } finally {
        setActioning((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [clientId],
  );

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <section className="space-y-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
          Recommandations programme
        </p>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40 mb-3">
          Recommandations programme
        </p>
        <p className="text-[12px] text-red-400/80">{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
        Recommandations programme
      </p>

      {cards.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] border border-[0.3px] border-white/[0.06] px-4 py-3">
          <p className="text-[12px] text-white/40">
            Aucune recommandation — le programme est bien calibré.
          </p>
        </div>
      ) : (
        cards.map((rec, idx) => {
          const valueSummary = buildValueSummary(rec);
          const approveKey = `${idx}-approve`;
          const rejectKey = `${idx}-reject`;
          const isApproving = actioning[approveKey];
          const isRejecting = actioning[rejectKey];
          const isBusy = isApproving || isRejecting;

          return (
            <div
              key={`${rec.type}-${rec.exercise_id ?? "global"}-${idx}`}
              className="rounded-xl bg-white/[0.02] border border-[0.3px] border-white/[0.06] px-4 py-3 space-y-2"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Priority badge */}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.12em] border border-[0.3px] ${PRIORITY_COLORS[rec.priority]}`}
                  >
                    {PRIORITY_LABELS[rec.priority]}
                  </span>
                  {/* Exercise name + type */}
                  <span className="text-[12px] font-semibold text-white">
                    {rec.exercise_name !== "Programme global"
                      ? rec.exercise_name
                      : null}
                    {rec.exercise_name !== "Programme global" && (
                      <span className="text-white/40 font-normal">
                        {" "}— {TYPE_LABELS[rec.type]}
                      </span>
                    )}
                    {rec.exercise_name === "Programme global" && (
                      <span>{TYPE_LABELS[rec.type]}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <p className="text-[11px] text-white/55 leading-relaxed">
                {rec.reason}
              </p>

              {/* Value summary */}
              {valueSummary && (
                <p className="text-[11px] font-medium text-white/70">
                  {valueSummary}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleAction(rec, "approve", idx)}
                  disabled={isBusy}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] bg-[#1f8a65]/10 text-[#1f8a65] hover:bg-[#1f8a65]/20 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  {isApproving ? "…" : "Approuver"}
                </button>
                <button
                  onClick={() => handleAction(rec, "reject", idx)}
                  disabled={isBusy}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/60 active:scale-[0.97] transition-all disabled:opacity-40"
                >
                  {isRejecting ? "…" : "Rejeter"}
                </button>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
