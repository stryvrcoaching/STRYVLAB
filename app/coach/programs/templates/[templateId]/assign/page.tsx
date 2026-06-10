"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Users,
  CheckCircle2,
  Loader2,
  Search,
  AlertTriangle,
  Ban,
  ArrowLeftRight,
} from "lucide-react";
import Link from "next/link";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import {
  rankTemplates,
  scoreLabel,
  scoreBadgeClass,
  EQUIPMENT_CATEGORY_LABELS,
  inferEquipmentCategory,
  type Template,
  type ClientProfile,
  type MatchResult,
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
const SPORT_PRACTICES: Record<string, string> = {
  sedentary: "Sédentaire",
  light: "Légèrement actif",
  moderate: "Modérément actif",
  active: "Actif",
  athlete: "Athlète",
};

export default function AssignTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [nameOverride, setNameOverride] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showIncompatible, setShowIncompatible] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/program-templates/${templateId}`).then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ])
      .then(([tmplData, clientsData]) => {
        setTemplate(tmplData.template);
        setClients(clientsData.clients ?? []);
        if (tmplData.template) setNameOverride(tmplData.template.name);
      })
      .finally(() => setLoading(false));
  }, [templateId]);

  // ── Calcul des scores via le matcher 3 phases ──
  const allRanked: Array<any & { match: MatchResult }> = template
    ? clients
        .filter((c) => c.status === "active")
        .filter(
          (c) =>
            !search ||
            `${c.first_name} ${c.last_name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .map((c) => {
          // Infer equipment_category from individual equipment array if not explicitly set
          const equipmentCategory = c.equipment_category ?? inferEquipmentCategory(c.equipment ?? []);
          const profile: ClientProfile = {
            equipment_category: equipmentCategory,
            fitness_level: c.fitness_level ?? null,
            training_goal: c.training_goal ?? null,
            weekly_frequency: c.weekly_frequency ?? null,
            sport_practice: c.sport_practice ?? null,
          };
          const match = rankTemplates([template], profile)[0];
          return { ...c, match };
        })
        .sort((a, b) => {
          if (a.match.hardStop && !b.match.hardStop) return 1;
          if (!a.match.hardStop && b.match.hardStop) return -1;
          return b.match.score - a.match.score;
        })
    : [];

  const compatible = allRanked.filter((c) => !c.match.hardStop);
  const incompatible = allRanked.filter((c) => c.match.hardStop);
  const displayedClients = showIncompatible ? allRanked : compatible;

  async function handleAssign() {
    if (!selectedClient) return;
    setAssigning(true);
    setAssignError("");
    const client = clients.find((c) => c.id === selectedClient);
    const finalName =
      nameOverride.trim() ||
      (client
        ? `${template!.name} — ${client.first_name} ${client.last_name}`
        : template!.name);
    try {
      const res = await fetch(`/api/program-templates/${templateId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient,
          name_override: finalName,
        }),
      });
      const d = await res.json();
      if (d.program_id) {
        setSuccess(true);
        setTimeout(() => router.push(`/coach/clients/${selectedClient}/protocoles/entrainement`), 1500);
      } else {
        setAssignError(d.error ?? "Erreur lors de la création du programme");
      }
    } catch {
      setAssignError("Erreur réseau");
    } finally {
      setAssigning(false);
    }
  }

  const topBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push("/coach/programs/templates")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            Templates
          </p>
          <p className="text-[13px] font-semibold text-white leading-none truncate">
            Assigner — {template?.name}
          </p>
        </div>
      </div>
    ),
    [router, template],
  );

  useSetTopBar(topBarLeft);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1f8a65] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] font-sans">
      <main className="max-w-2xl mx-auto px-8 py-6 flex flex-col gap-5">
        <div className="bg-[#181818] border-subtle rounded-2xl p-5 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
            Données du template
          </p>
          <p className="text-sm text-white/70">
            {GOALS[template?.goal ?? ""] ?? template?.goal}
            {" · "}
            {LEVELS[template?.level ?? ""] ?? template?.level}
            {" · "}
            {template?.frequency}j/sem.
            {" · "}
            {template?.weeks} sem.
            {template?.equipment_archetype && (
              <> · {EQUIPMENT_CATEGORY_LABELS[template.equipment_archetype]}</>
            )}
          </p>
        </div>

        {success ? (
          <div className="bg-[#181818] border-subtle rounded-2xl p-10 text-center">
            <CheckCircle2 size={48} className="text-[#1f8a65] mx-auto mb-4" />
            <p className="font-bold text-[#1f8a65] text-lg">Programme créé !</p>
            <p className="text-sm text-white/70 mt-1">
              Redirection vers le dossier client…
            </p>
          </div>
        ) : (
          <>
            {/* Nom du programme */}
            <div className="bg-[#181818] rounded-2xl p-5">
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider block mb-2">
                Nom du programme pour le client
              </label>
              <input
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0a0a0a] rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/40"
              />
            </div>

            {/* Sélection client */}
            <div className="bg-[#181818] border-subtle rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Users size={14} className="text-[#1f8a65]" />
                  Choisir un client
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <span className="text-[#1f8a65] font-semibold">
                    {compatible.length} compatibles
                  </span>
                  {incompatible.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-red-400">
                        {incompatible.length} incompatibles
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un client…"
                  className="w-full pl-9 pr-4 h-10 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/25 focus:ring-2 focus:ring-[#1f8a65]/40"
                />
              </div>

              <p className="text-[10px] text-white/60 -mt-2">
                Triés par compatibilité — critères éliminatoires : équipement,
                fréquence (±1 toléré), niveau ±1
              </p>

              <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto">
                {displayedClients.length === 0 && (
                  <div className="text-center py-8 text-white/60 text-sm">
                    {search
                      ? "Aucun client trouvé"
                      : "Aucun client compatible avec ce template"}
                  </div>
                )}

                {displayedClients.map((client, idx) => {
                  const { match } = client;
                  const isSelected = selectedClient === client.id;
                  const isTop =
                    !match.hardStop && idx === 0 && match.score >= 65;
                  const badgeClass = scoreBadgeClass(
                    match.score,
                    match.hardStop,
                  );
                  const label = scoreLabel(match.score, match.hardStop);
                  const hasSubstitutions = match.substitutions.length > 0;

                  return (
                    <button
                      key={client.id}
                      onClick={() => {
                        if (match.hardStop) return;
                        setSelectedClient(client.id);
                        setNameOverride(
                          `${template!.name} — ${client.first_name} ${client.last_name}`,
                        );
                      }}
                      disabled={match.hardStop}
                      className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                        match.hardStop
                          ? "opacity-50 cursor-not-allowed bg-[#0a0a0a]"
                          : isSelected
                            ? "bg-[#1f8a65]/10 ring-2 ring-[#1f8a65]/40"
                            : isTop
                              ? "bg-[#0a0a0a] ring-1 ring-[#1f8a65]/20 hover:bg-white/[0.04]"
                              : "bg-[#0a0a0a] hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          match.hardStop
                            ? "bg-[#0a0a0a] text-white/50"
                            : isSelected
                              ? "bg-[#1f8a65] text-white"
                              : "bg-white/[0.04] text-white/80"
                        }`}
                      >
                        {match.hardStop ? (
                          <Ban size={14} />
                        ) : (
                          <>
                            {client.first_name[0]}
                            {client.last_name[0]}
                          </>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-white text-sm truncate">
                            {client.first_name} {client.last_name}
                          </p>
                          {isTop && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65] shrink-0">
                              Recommandé
                            </span>
                          )}
                          {hasSubstitutions && !match.hardStop && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/70 shrink-0 flex items-center gap-0.5">
                              <ArrowLeftRight size={9} />
                              {match.substitutions.length} substitution
                              {match.substitutions.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {/* Profil structuré */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {client.equipment_category && (
                            <span className="text-[9px] font-medium text-[#1f8a65]/80">
                              {EQUIPMENT_CATEGORY_LABELS[
                                client.equipment_category as keyof typeof EQUIPMENT_CATEGORY_LABELS
                              ] ?? client.equipment_category}
                            </span>
                          )}
                          {client.training_goal && (
                            <span className="text-[9px] text-white/70">
                              {GOALS[client.training_goal] ??
                                client.training_goal}
                            </span>
                          )}
                          {client.fitness_level && (
                            <span className="text-[9px] text-white/70">
                              {LEVELS[client.fitness_level] ??
                                client.fitness_level}
                            </span>
                          )}
                          {client.weekly_frequency != null && (
                            <span className="text-[9px] font-mono text-white/70">
                              {client.weekly_frequency}j/sem.
                            </span>
                          )}
                          {client.sport_practice && (
                            <span className="text-[9px] text-white/70">
                              {SPORT_PRACTICES[client.sport_practice] ??
                                client.sport_practice}
                            </span>
                          )}
                          {!client.training_goal &&
                            !client.fitness_level &&
                            !client.weekly_frequency && (
                              <span className="text-[9px] text-white/40 italic">
                                Profil incomplet
                              </span>
                            )}
                        </div>

                        {/* Raison du hard stop */}
                        {match.hardStop && match.hardStopReason && (
                          <p className="text-[9px] text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={9} />
                            {match.hardStopReason}
                          </p>
                        )}

                        {/* Warning fréquence ±1 */}
                        {!match.hardStop && match.warning && (
                          <p className="text-[9px] text-white/70 mt-1 flex items-center gap-1">
                            <AlertTriangle size={9} />
                            {match.warning}
                          </p>
                        )}

                        {/* Substitutions */}
                        {hasSubstitutions && !match.hardStop && (
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            {match.substitutions
                              .slice(0, 2)
                              .map(
                                (
                                  sub: import("@/lib/matching/template-matcher").SubstitutionResult,
                                  i: number,
                                ) => (
                                  <p
                                    key={i}
                                    className="text-[9px] text-white/70 flex items-center gap-1"
                                  >
                                    <ArrowLeftRight size={8} />
                                    <span className="line-through opacity-60">
                                      {sub.originalExercise}
                                    </span>
                                    {" → "}
                                    <span className="font-medium">
                                      {sub.substitute?.name ??
                                        "à remplacer manuellement"}
                                    </span>
                                  </p>
                                ),
                              )}
                            {match.substitutions.length > 2 && (
                              <p className="text-[9px] text-white/60">
                                +{match.substitutions.length - 2} substitution
                                {match.substitutions.length - 2 > 1
                                  ? "s"
                                  : ""}{" "}
                                supplémentaire
                                {match.substitutions.length - 2 > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Score badge */}
                      {!match.hardStop && (
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full ${badgeClass}`}
                          >
                            {match.score}
                          </span>
                          <span className="text-[9px] text-white/70">
                            {label}
                          </span>
                        </div>
                      )}

                      {isSelected && (
                        <CheckCircle2
                          size={16}
                          className="text-[#1f8a65] shrink-0 mt-2"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Toggle clients incompatibles */}
              {incompatible.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowIncompatible((v) => !v)}
                  className="text-xs text-white/70 hover:text-white transition-colors text-center py-1"
                >
                  {showIncompatible
                    ? "Masquer les clients incompatibles"
                    : `Voir ${incompatible.length} client${incompatible.length > 1 ? "s" : ""} incompatible${incompatible.length > 1 ? "s" : ""}`}
                </button>
              )}
            </div>

            {assignError && (
              <p className="text-xs text-red-400 bg-white/[0.03] rounded-xl px-3 py-2">
                {assignError}
              </p>
            )}

            <button
              onClick={handleAssign}
              disabled={!selectedClient || assigning}
              className="flex items-center justify-center gap-2 bg-[#1f8a65] text-white font-bold py-3.5 rounded-xl hover:bg-[#217356] transition-colors disabled:opacity-40 text-sm"
            >
              {assigning ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {assigning
                ? "Création du programme…"
                : "Créer le programme pour ce client"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
