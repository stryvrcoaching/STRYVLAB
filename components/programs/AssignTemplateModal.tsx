"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Ban,
  ArrowLeftRight,
} from "lucide-react";
import {
  rankTemplates,
  scoreLabel,
  scoreBadgeClass,
  EQUIPMENT_CATEGORY_LABELS,
  type Template,
  type ClientProfile,
  type MatchResult,
  type SubstitutionResult,
} from "@/lib/matching/template-matcher";

const GOALS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  endurance: "Endurance",
  fat_loss: "Perte de gras",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athletic",
};
const LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};

interface Props {
  clientId: string;
  clientProfile: ClientProfile;
  clientName: string;
  onClose: () => void;
  onAssigned: () => void;
}

export default function AssignTemplateModal({
  clientId,
  clientProfile,
  clientName,
  onClose,
  onAssigned,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [nameOverride, setNameOverride] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showIncompatible, setShowIncompatible] = useState(false);

  useEffect(() => {
    fetch("/api/program-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    const filtered = templates.filter((t) =>
      !search || t.name.toLowerCase().includes(search.toLowerCase())
    );
    return filtered
      .map((t) => {
        const match = rankTemplates([t], clientProfile)[0];
        return { template: t, match };
      })
      .sort((a, b) => {
        if (a.match.hardStop && !b.match.hardStop) return 1;
        if (!a.match.hardStop && b.match.hardStop) return -1;
        return b.match.score - a.match.score;
      });
  }, [templates, clientProfile, search]);

  const compatible = ranked.filter((r) => !r.match.hardStop);
  const incompatible = ranked.filter((r) => r.match.hardStop);
  const displayed = showIncompatible ? ranked : compatible;

  async function handleAssign() {
    if (!selectedTemplate) return;
    setAssigning(true);
    setAssignError("");
    const finalName = nameOverride.trim() || `${selectedTemplate.name} — ${clientName}`;
    try {
      const res = await fetch(`/api/program-templates/${selectedTemplate.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, name_override: finalName }),
      });
      const d = await res.json();
      if (d.program_id) {
        setSuccess(true);
        setTimeout(() => {
          onAssigned();
          onClose();
        }, 1200);
      } else {
        setAssignError(d.error ?? "Erreur lors de la création du programme");
      }
    } catch {
      setAssignError("Erreur réseau");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              {clientName}
            </p>
            <p className="text-[15px] font-bold text-white leading-tight">
              Assigner un template
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <CheckCircle2 size={40} className="text-[#1f8a65] mb-4" />
            <p className="font-bold text-[#1f8a65] text-[15px]">Programme créé !</p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-6 pt-4 pb-3 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un template…"
                  className="w-full pl-9 pr-4 h-10 bg-[#0a0a0a] rounded-xl text-[13px] text-white outline-none placeholder:text-white/25 focus:ring-1 focus:ring-[#1f8a65]/40"
                />
              </div>
              {!loading && (
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <span className="text-[#1f8a65] font-semibold">{compatible.length} compatibles</span>
                  {incompatible.length > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="text-red-400">{incompatible.length} incompatibles</span>
                    </>
                  )}
                  <span className="text-white/20 ml-auto">Triés par score de compatibilité</span>
                </div>
              )}
            </div>

            {/* Liste templates */}
            <div className="flex-1 overflow-y-auto px-6 pb-3 space-y-2">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                ))
              ) : displayed.length === 0 ? (
                <div className="text-center py-10 text-white/40 text-sm">
                  {search ? "Aucun template trouvé" : "Aucun template compatible"}
                </div>
              ) : (
                displayed.map(({ template: t, match }, idx) => {
                  const isSelected = selectedTemplate?.id === t.id;
                  const isTop = !match.hardStop && idx === 0 && match.score >= 65;
                  const badgeClass = scoreBadgeClass(match.score, match.hardStop);
                  const label = scoreLabel(match.score, match.hardStop);

                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (match.hardStop) return;
                        setSelectedTemplate(t);
                        setNameOverride(`${t.name} — ${clientName}`);
                      }}
                      disabled={match.hardStop}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                        match.hardStop
                          ? "opacity-40 cursor-not-allowed bg-white/[0.02]"
                          : isSelected
                          ? "bg-[#1f8a65]/10 ring-1 ring-[#1f8a65]/40"
                          : isTop
                          ? "bg-white/[0.03] ring-1 ring-[#1f8a65]/20 hover:bg-white/[0.05]"
                          : "bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                        match.hardStop ? "bg-white/[0.04] text-white/30" : isSelected ? "bg-[#1f8a65] text-white" : "bg-white/[0.06] text-white/70"
                      }`}>
                        {match.hardStop ? <Ban size={13} /> : t.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-white text-[13px] truncate">{t.name}</p>
                          {isTop && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65] shrink-0">
                              Recommandé
                            </span>
                          )}
                          {match.substitutions.length > 0 && !match.hardStop && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/60 shrink-0 flex items-center gap-0.5">
                              <ArrowLeftRight size={9} />
                              {match.substitutions.length} substitution{match.substitutions.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-white/50">{GOALS[t.goal] ?? t.goal}</span>
                          <span className="text-[10px] text-white/40">·</span>
                          <span className="text-[10px] text-white/50">{LEVELS[t.level] ?? t.level}</span>
                          <span className="text-[10px] text-white/40">·</span>
                          <span className="text-[10px] font-mono text-white/50">{t.frequency}j/sem.</span>
                          <span className="text-[10px] text-white/40">·</span>
                          <span className="text-[10px] font-mono text-white/50">{t.weeks} sem.</span>
                          {t.equipment_archetype && (
                            <>
                              <span className="text-[10px] text-white/40">·</span>
                              <span className="text-[10px] text-[#1f8a65]/80">
                                {EQUIPMENT_CATEGORY_LABELS[t.equipment_archetype as keyof typeof EQUIPMENT_CATEGORY_LABELS] ?? t.equipment_archetype}
                              </span>
                            </>
                          )}
                        </div>
                        {match.hardStop && match.hardStopReason && (
                          <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={9} /> {match.hardStopReason}
                          </p>
                        )}
                        {!match.hardStop && match.warning && (
                          <p className="text-[9px] text-white/50 mt-1 flex items-center gap-1">
                            <AlertTriangle size={9} /> {match.warning}
                          </p>
                        )}
                        {match.substitutions.length > 0 && !match.hardStop && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {match.substitutions.slice(0, 2).map((sub: SubstitutionResult, i: number) => (
                              <p key={i} className="text-[9px] text-white/50 flex items-center gap-1">
                                <ArrowLeftRight size={8} />
                                <span className="line-through opacity-60">{sub.originalExercise}</span>
                                {" → "}
                                <span className="font-medium">{sub.substitute?.name ?? "à remplacer"}</span>
                              </p>
                            ))}
                            {match.substitutions.length > 2 && (
                              <p className="text-[9px] text-white/40">+{match.substitutions.length - 2} substitution{match.substitutions.length - 2 > 1 ? "s" : ""}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {!match.hardStop && (
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${badgeClass}`}>{match.score}</span>
                          <span className="text-[9px] text-white/40">{label}</span>
                        </div>
                      )}
                      {isSelected && <CheckCircle2 size={15} className="text-[#1f8a65] shrink-0 mt-2" />}
                    </button>
                  );
                })
              )}

              {incompatible.length > 0 && (
                <button
                  onClick={() => setShowIncompatible((v) => !v)}
                  className="w-full text-[11px] text-white/40 hover:text-white/60 transition-colors text-center py-1"
                >
                  {showIncompatible
                    ? "Masquer les templates incompatibles"
                    : `Voir ${incompatible.length} template${incompatible.length > 1 ? "s" : ""} incompatible${incompatible.length > 1 ? "s" : ""}`}
                </button>
              )}
            </div>

            {/* Footer */}
            {selectedTemplate && (
              <div className="px-6 py-4 border-t border-white/[0.06] shrink-0 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 block mb-1.5">
                    Nom du programme
                  </label>
                  <input
                    value={nameOverride}
                    onChange={(e) => setNameOverride(e.target.value)}
                    className="w-full px-3 h-10 bg-[#0a0a0a] rounded-xl text-[13px] text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40"
                  />
                </div>
                {assignError && (
                  <p className="text-[11px] text-red-400">{assignError}</p>
                )}
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="w-full h-10 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assigning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {assigning ? "Création du programme…" : "Créer le programme pour ce client"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
