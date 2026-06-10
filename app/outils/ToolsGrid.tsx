"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

import { useSetTopBar } from "@/components/layout/useSetTopBar";

import {
  Utensils,
  BarChart3,
  RefreshCw,
  HeartPulse,
  Droplet,
  Dumbbell,
  Moon,
  Search,
  XCircle,
  Brain,
  Activity,
  Layers,
  Lock,
  ArrowRight,
} from "lucide-react";

// ─── Tool registry ────────────────────────────────────────────────────────────

const TOOLS = [
  // Niveau 1 — Physiologie (actifs)
  {
    id: "macros",
    href: "macros",
    status: "active" as const,
    icon: Utensils,
    type: "Nutrition",
    title: "Kcal & Macros",
    description: "Besoins caloriques & macronutriments (BMR + NEAT + EAT + TEF).",
    code: "CALC_01",
    keywords: ["manger", "diète", "régime", "protéines", "glucides", "lipides", "calories", "poids", "maigrir", "muscler"],
  },
  {
    id: "bodyFat",
    href: "body-fat",
    status: "active" as const,
    icon: BarChart3,
    type: "Composition",
    title: "Body Fat %",
    description: "Estimation masse grasse via Navy Method & Jackson-Pollock.",
    code: "MEAS_01",
    keywords: ["gras", "fat", "img", "masse", "poids", "maigrir", "sèche", "mensurations", "ventre"],
  },
  {
    id: "cycleSync",
    href: "cycle-sync",
    status: "active" as const,
    icon: Moon,
    type: "Protocole Hormonal",
    title: "Cycle Sync",
    description: "Nutrition et training adaptés aux fluctuations hormonales.",
    code: "HORM_01",
    keywords: ["femme", "règles", "menstruel", "pms", "hormones", "cycle", "period", "fille", "ovulation"],
  },
  {
    id: "carbCycling",
    href: "carb-cycling",
    status: "active" as const,
    icon: RefreshCw,
    type: "Glycogène",
    title: "Carb Cycling",
    description: "Stratégie glucidique cyclique pour la performance.",
    code: "DIET_02",
    keywords: ["sucre", "glucides", "rebond", "refeed", "sèche", "pdm", "insuline", "énergie", "fatigue"],
  },
  {
    id: "hydratation",
    href: "hydratation",
    status: "active" as const,
    icon: Droplet,
    type: "Santé",
    title: "Hydratation",
    description: "Besoins hydriques selon climat, activité et taux de sudation.",
    code: "HYDR_01",
    keywords: ["eau", "boire", "soif", "h2o", "water", "litres", "bouteille", "sueur", "chaleur"],
  },
  {
    id: "hrZones",
    href: "hr-zones",
    status: "active" as const,
    icon: HeartPulse,
    type: "Cardio",
    title: "HR Zones",
    description: "Zones cardiaques cibles via méthode Karvonen (FC réserve).",
    code: "CARD_01",
    keywords: ["coeur", "bpm", "frequence", "courir", "endurance", "vma", "seuil", "pulsation", "jogging"],
  },
  {
    id: "oneRM",
    href: "1rm",
    status: "active" as const,
    icon: Dumbbell,
    type: "Force",
    title: "1RM Calculator",
    description: "Charge maximale théorique & zones de force (Brzycki, Epley).",
    code: "STR_01",
    keywords: ["muscu", "force", "max", "poids", "haltère", "barre", "bench", "squat", "deadlift", "rep"],
  },
  // Niveau 2 — Systémique (en dev)
  {
    id: "neuroProfile",
    href: "neuro-profile",
    status: "dev" as const,
    icon: Brain,
    type: "Neurologie",
    title: "Neuro Profiler",
    description: "Test de dominance neurochimique (Braverman) pour adapter la programmation.",
    code: "NEURO_01",
    keywords: ["cerveau", "mental", "dopamine", "sérotonine", "test", "psychologie"],
  },
  {
    id: "stressLoad",
    href: "stress-load",
    status: "dev" as const,
    icon: Activity,
    type: "Systémique",
    title: "Charge Allostatique",
    description: "Évaluation du risque de burnout métabolique et saturation HPA.",
    code: "SYS_01",
    keywords: ["stress", "cortisol", "fatigue", "sommeil", "récupération"],
  },
  {
    id: "mrv",
    href: "mrv-calculator",
    status: "dev" as const,
    icon: Layers,
    type: "Programmation",
    title: "MRV Estimator",
    description: "Maximum Recoverable Volume. La limite théorique de sets par semaine.",
    code: "VOL_01",
    keywords: ["volume", "sets", "séries", "hypertrophie", "récupération"],
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToolsGrid() {
  const [searchQuery, setSearchQuery] = useState("");

  // TopBar — left content stable, right re-renders with searchQuery
  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
          Espace Coach
        </p>
        <p className="text-[13px] font-semibold text-white leading-none">
          Calculatrices Lab
        </p>
      </div>
    ),
    [],
  );

  const topBarRight = useMemo(
    () => (
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 text-white/30 pointer-events-none"
          size={14}
          strokeWidth={1.75}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un outil..."
          className="w-56 pl-8 pr-8 h-8 bg-white/[0.04] border-[0.3px] border-white/[0.06] rounded-lg text-[12px] font-medium text-white placeholder:text-white/25 outline-none transition-all focus:bg-white/[0.06]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <XCircle size={13} />
          </button>
        )}
      </div>
    ),
    [searchQuery],
  );

  useSetTopBar(topBarLeft, topBarRight);

  const filteredTools = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return TOOLS;
    return TOOLS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const activeTools = filteredTools.filter((t) => t.status === "active");
  const devTools = filteredTools.filter((t) => t.status === "dev");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 md:px-8 pt-8 pb-24 max-w-7xl mx-auto">

        {/* ── Active tools ── */}
        {activeTools.length > 0 && (
          <section className="mb-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-5">
              Physiologie — Actifs
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.id}
                    href={`/outils/${tool.href}`}
                    className="group block focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1f8a65]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] rounded-2xl"
                  >
                    <div className="h-full flex flex-col justify-between bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-5 transition-colors duration-150 hover:bg-white/[0.04]">
                      {/* Top */}
                      <div>
                        <div className="flex items-start justify-between mb-6">
                          <div className="w-11 h-11 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] flex items-center justify-center text-white/50 group-hover:text-[#1f8a65] transition-colors duration-150">
                            <Icon size={20} strokeWidth={1.5} />
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-mono text-white/30 group-hover:text-[#1f8a65]/60 transition-colors">
                              {tool.code}
                            </span>
                            <span className="px-2 py-0.5 bg-white/[0.03] border-[0.3px] border-white/[0.06] rounded-full text-[9px] text-white/35 font-medium">
                              {tool.type}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-[15px] font-semibold text-white tracking-tight mb-2">
                          {tool.title}
                        </h3>
                        <p className="text-[12px] text-white/45 leading-relaxed">
                          {tool.description}
                        </p>
                      </div>

                      {/* Bottom */}
                      <div className="flex items-center justify-between mt-6 pt-4 border-t-[0.3px] border-white/[0.06]">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30 group-hover:text-white/60 transition-colors">
                          Initialiser
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/[0.03] border-[0.3px] border-white/[0.06] flex items-center justify-center group-hover:bg-[#1f8a65] group-hover:border-transparent transition-all duration-150">
                          <ArrowRight size={11} className="text-white/30 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Dev tools ── */}
        {devTools.length > 0 && (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/25 mb-5">
              Systémique — En Développement
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.id}
                    className="h-full flex flex-col justify-between bg-white/[0.01] border-[0.3px] border-white/[0.06] rounded-2xl p-5 opacity-40 cursor-not-allowed"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-6">
                        <div className="w-11 h-11 rounded-xl bg-white/[0.03] flex items-center justify-center text-white/20">
                          <Icon size={20} strokeWidth={1.5} />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-mono text-white/20">{tool.code}</span>
                          <span className="px-2 py-0.5 bg-white/[0.02] rounded-full text-[9px] text-white/20 font-medium flex items-center gap-1">
                            <Lock size={8} strokeWidth={1.75} />
                            Locked
                          </span>
                        </div>
                      </div>
                      <h3 className="text-[15px] font-semibold text-white/30 tracking-tight mb-2">
                        {tool.title}
                      </h3>
                      <p className="text-[12px] text-white/20 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-6 pt-4 border-t-[0.3px] border-white/[0.04]">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/20">
                        Module en développement
                      </span>
                      <div className="w-6 h-6 rounded-full bg-white/[0.03] flex items-center justify-center">
                        <Lock size={10} className="text-white/20" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {filteredTools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
              <Search size={20} className="text-white/20" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-medium text-white/40 mb-1">
              Aucun outil trouvé
            </p>
            <p className="text-[12px] text-white/25">
              Essayez d'autres mots-clés.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 text-[12px] font-medium text-[#1f8a65] hover:text-[#1f8a65]/70 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        )}

        <footer className="mt-20 pt-8 border-t-[0.3px] border-white/[0.06] text-center">
          <p className="text-[10px] font-medium tracking-[0.14em] text-white/20 uppercase">
            © {new Date().getFullYear()} STRYV lab
          </p>
        </footer>
      </div>
    </main>
  );
}
