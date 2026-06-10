"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Dumbbell, Moon, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  detectDayRoles,
  buildScheduleSlots,
  computeMacroDelta,
  type MacroDelta,
} from "@/lib/programs/nutritionAlign";
import type { NutritionProtocol, NutritionProtocolDay } from "@/lib/nutrition/types";

interface Program {
  id: string;
  name: string;
  is_client_visible: boolean;
  program_sessions?: { days_of_week?: number[] | null; day_of_week?: number | null }[];
}

interface Props {
  clientId: string;
  program: Program;
  source: "save" | "toggle";
  onClose: () => void;
  onConfirm: () => void;
}

const DOW_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// days_of_week in DB: ISO 1=Mon…7=Sun
const DOW_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

export default function NutritionAlignModal({ clientId, program, source, onClose, onConfirm }: Props) {
  const [activeProtocol, setActiveProtocol] = useState<NutritionProtocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [trainingDayId, setTrainingDayId] = useState<string>("");
  const [restDayId, setRestDayId] = useState<string>("");
  const [recalcEnabled, setRecalcEnabled] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const protRes = await fetch(`/api/clients/${clientId}/nutrition-protocols`);
      const protJson = await protRes.json();

      const protocols: NutritionProtocol[] = protJson.protocols ?? [];
      const shared = protocols.find((p) => p.status === "shared") ?? null;
      setActiveProtocol(shared);

      if (shared?.days?.length) {
        const roles = detectDayRoles(shared.days);
        setTrainingDayId(roles.trainingDayId ?? shared.days[0]?.id ?? "");
        setRestDayId(roles.restDayId ?? shared.days[0]?.id ?? "");
      }
      setLoading(false);
    }
    load();
  }, [clientId]);

  const trainingDows = useMemo(() => {
    const set = new Set<number>();
    for (const s of program.program_sessions ?? []) {
      const dows: number[] = s.days_of_week?.length ? s.days_of_week : (s.day_of_week != null ? [s.day_of_week] : []);
      for (const d of dows) set.add(d);
    }
    return set;
  }, [program.program_sessions]);

  const days = activeProtocol?.days ?? [];

  const macroDelta: MacroDelta | null = useMemo(() => {
    if (!activeProtocol?.days || !trainingDayId || !restDayId) return null;
    return computeMacroDelta(activeProtocol.days, trainingDayId, restDayId);
  }, [activeProtocol, trainingDayId, restDayId]);

  const canRecalc = macroDelta !== null;

  async function fireVisibility() {
    if (source === "toggle") {
      await fetch(`/api/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_client_visible: true }),
      });
    }
  }

  async function handleSkip() {
    await fireVisibility();
    onClose();
  }

  async function handleAlign() {
    if (!activeProtocol) { await fireVisibility(); onConfirm(); return; }

    setSubmitting(true);
    try {
      const trainingDay = days.find((d) => d.id === trainingDayId);
      const restDay = days.find((d) => d.id === restDayId);
      if (!trainingDay || !restDay) { await fireVisibility(); onConfirm(); return; }

      const slots = buildScheduleSlots(
        program.program_sessions ?? [],
        trainingDay.position,
        restDay.position,
      );

      type DayPatch = { id: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
      let daysPatch: DayPatch[] | undefined;
      if (recalcEnabled && macroDelta) {
        daysPatch = days.map((d) => {
          if (d.id === trainingDayId) {
            const ratio = macroDelta.trainingKcal / (macroDelta.restKcal || 1);
            return {
              id: d.id,
              calories: macroDelta.trainingKcal,
              protein_g: d.protein_g != null ? Math.round(d.protein_g * ratio) : undefined,
              carbs_g: d.carbs_g != null ? Math.round(d.carbs_g * ratio) : undefined,
              fat_g: d.fat_g != null ? Math.round(d.fat_g * ratio) : undefined,
            };
          }
          return { id: d.id };
        });
      }

      const payload: Record<string, unknown> = { schedule_slots: slots };
      if (daysPatch) payload.days = daysPatch;

      await fetch(`/api/clients/${clientId}/nutrition-protocols/${activeProtocol.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await fireVisibility();
      onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleSkip} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#181818] border border-white/[0.06] flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Nutrition Studio</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-white">Aligner la nutrition</h2>
            <p className="mt-0.5 text-[12px] text-white/40">Programme « {program.name} » publié</p>
          </div>
          <button
            onClick={handleSkip}
            className="mt-0.5 rounded-lg bg-white/[0.04] p-1.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-white/30" />
            </div>
          ) : !activeProtocol ? (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-center space-y-3">
              <p className="text-[13px] text-white/50">Aucun protocole nutrition actif pour ce client.</p>
              <Link
                href={`/coach/clients/${clientId}/protocoles/nutrition/new`}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1f8a65] hover:text-[#7fe2bf] transition-colors"
              >
                Créer un protocole <ArrowRight size={12} />
              </Link>
            </div>
          ) : (
            <>
              {/* Mapping selects */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">Mapping des jours</p>
                <div className="space-y-2">
                  <DaySelect
                    icon={<Dumbbell size={12} />}
                    label="Jour entraînement"
                    value={trainingDayId}
                    days={days}
                    onChange={setTrainingDayId}
                    accent
                  />
                  <DaySelect
                    icon={<Moon size={12} />}
                    label="Jour repos"
                    value={restDayId}
                    days={days}
                    onChange={setRestDayId}
                  />
                </div>
              </div>

              {/* Week preview */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/30">Aperçu semaine</p>
                <div className="grid grid-cols-7 gap-1">
                  {DOW_DISPLAY_ORDER.map((dow, i) => {
                    const isTraining = trainingDows.has(dow);
                    const assignedDay = isTraining
                      ? days.find((d) => d.id === trainingDayId)
                      : days.find((d) => d.id === restDayId);
                    return (
                      <div
                        key={dow}
                        className={`rounded-xl p-1.5 flex flex-col items-center gap-1 ${
                          isTraining ? "bg-[#1f8a65]/10 border border-[#1f8a65]/20" : "bg-white/[0.03] border border-white/[0.06]"
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-[0.08em] ${isTraining ? "text-[#7fe2bf]" : "text-white/30"}`}>
                          {DOW_LABELS[i]}
                        </span>
                        {isTraining ? (
                          <Dumbbell size={9} className="text-[#1f8a65]" />
                        ) : (
                          <Moon size={9} className="text-white/20" />
                        )}
                        {assignedDay?.calories != null && (
                          <span className="text-[8px] text-white/40">{assignedDay.calories} kcal</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Macro recalc */}
              <div className={`rounded-xl border p-3 space-y-2 ${canRecalc ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-50"}`}>
                <label className={`flex items-center gap-2.5 ${canRecalc ? "cursor-pointer" : "cursor-not-allowed"}`}>
                  <input
                    type="checkbox"
                    checked={recalcEnabled}
                    disabled={!canRecalc}
                    onChange={(e) => setRecalcEnabled(e.target.checked)}
                    className="accent-[#1f8a65] w-3.5 h-3.5"
                  />
                  <span className="text-[12px] font-medium text-white/70">Recalculer les macros selon les séances</span>
                </label>
                {!canRecalc && (
                  <p className="text-[11px] text-white/30 pl-6">Les deux jours doivent avoir des calories définies dans le protocole</p>
                )}
                {canRecalc && recalcEnabled && macroDelta && (
                  <div className="pl-6 space-y-1">
                    <MacroLine label="Jour entraînement" kcal={macroDelta.trainingKcal} delta={macroDelta.delta} />
                    <MacroLine label="Jour repos" kcal={macroDelta.restKcal} delta={0} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="h-8 px-4 rounded-xl text-[12px] font-bold uppercase tracking-[0.1em] text-white/40 hover:text-white/70 transition-colors"
          >
            Passer
          </button>
          {activeProtocol && (
            <button
              onClick={handleAlign}
              disabled={submitting || !trainingDayId || !restDayId}
              className="flex items-center gap-1.5 h-8 px-4 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[#217356] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={11} className="animate-spin" /> : null}
              Aligner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DaySelect({
  icon,
  label,
  value,
  days,
  onChange,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  days: NutritionProtocolDay[];
  onChange: (id: string) => void;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 min-w-[130px] text-[11px] font-semibold ${accent ? "text-[#7fe2bf]" : "text-white/40"}`}>
        {icon}
        {label}
      </div>
      <ArrowRight size={10} className="text-white/20 shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-7 rounded-lg bg-[#0a0a0a] border border-white/[0.08] text-[12px] text-white/80 px-2 appearance-none cursor-pointer"
      >
        {days.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}{d.calories != null ? ` — ${d.calories} kcal` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function MacroLine({ label, kcal, delta }: { label: string; kcal: number; delta: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className="text-[11px] font-mono text-white/70">
        {kcal} kcal
        {delta > 0 && <span className="text-[#7fe2bf] ml-1">(+{delta})</span>}
      </span>
    </div>
  );
}
