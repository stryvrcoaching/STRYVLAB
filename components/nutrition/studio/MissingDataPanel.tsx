"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Calculator, Check, Sigma, Sparkles } from "lucide-react";
import type { NutritionClientData } from "@/lib/nutrition/types";
import {
  calculateBMRKatchMcArdle,
  calculateBMRMifflin,
} from "@/lib/nutrition/calculators";
import type { MissingDataKey } from "./missingData";
import {
  getBodyCompositionEstimateMethods,
  getBodyCompositionMissingInputs,
  type CompositionEstimateMethod,
} from "@/lib/nutrition/bodyCompositionResolver";

interface Props {
  missingKey: MissingDataKey | null;
  clientData: NutritionClientData | null;
  onSave: (
    fieldValue: Record<string, unknown>,
    options?: {
      sourcePatch?: Partial<Record<string, "estimated">>;
    },
  ) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}

const CONFIG: Record<
  MissingDataKey,
  { label: string; unit?: string; canCalculate: boolean }
> = {
  bmr: { label: "BMR", unit: "kcal", canCalculate: true },
  weight: { label: "Poids", unit: "kg", canCalculate: false },
  height: { label: "Taille", unit: "cm", canCalculate: false },
  bf: { label: "Masse grasse", unit: "%", canCalculate: true },
  steps: { label: "Pas quotidiens", unit: "pas", canCalculate: false },
  lean_mass: { label: "Masse maigre", unit: "kg", canCalculate: true },
  muscle_mass: { label: "Masse musculaire", unit: "kg", canCalculate: true },
};

const FIELD_MAP: Record<MissingDataKey, string> = {
  bmr: "bmr_kcal_measured",
  weight: "weight_kg",
  height: "height_cm",
  bf: "body_fat_pct",
  steps: "daily_steps",
  lean_mass: "lean_mass_kg",
  muscle_mass: "muscle_mass_kg",
};

type ResolutionMode = "estimate" | "manual";

function EstimateCard({
  method,
  selected,
  onSelect,
}: {
  method: CompositionEstimateMethod;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
        selected
          ? "border-[#1f8a65]/50 bg-[#1f8a65]/12"
          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-white/88">{method.label}</p>
          <p className="mt-1 text-[10px] text-white/50 leading-relaxed">
            {method.description}
          </p>
        </div>
        <div
          className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
            selected ? "bg-[#1f8a65]/20 text-[#7fe0b8]" : "bg-white/[0.06] text-white/70"
          }`}
        >
          {method.primaryValue}
          {method.primaryValueLabel === "% masse grasse" ? "%" : " kg"}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <p className="text-white/35">% MG</p>
          <p className="mt-1 text-white/85">
            {method.bodyFatPct != null ? `${method.bodyFatPct}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <p className="text-white/35">MMaigre</p>
          <p className="mt-1 text-white/85">
            {method.leanMassKg != null ? `${method.leanMassKg} kg` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-2 py-2">
          <p className="text-white/35">MMusc.</p>
          <p className="mt-1 text-white/85">
            {method.muscleMassKg != null ? `${method.muscleMassKg} kg` : "—"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-amber-300/85 leading-relaxed">
        {method.caution}
      </p>
    </button>
  );
}

export default function MissingDataPanel({
  missingKey,
  clientData,
  onSave,
  onClose,
  saving = false,
}: Props) {
  const [manualValue, setManualValue] = useState<string>("");
  const [selectedFormula, setSelectedFormula] = useState<"mifflin" | "katch">(
    "mifflin",
  );
  const [mode, setMode] = useState<ResolutionMode>("manual");
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const estimateMethods = useMemo(
    () => getBodyCompositionEstimateMethods(missingKey, clientData),
    [clientData, missingKey],
  );
  const selectedMethod = estimateMethods.find((method) => method.id === selectedMethodId) ?? estimateMethods[0] ?? null;
  const missingInputs = useMemo(
    () => getBodyCompositionMissingInputs(missingKey, clientData),
    [clientData, missingKey],
  );
  const config = missingKey ? CONFIG[missingKey] : null;
  const fieldKey = missingKey ? FIELD_MAP[missingKey] : null;
  const canEstimate = Boolean(config?.canCalculate && estimateMethods.length > 0);

  useEffect(() => {
    setError(null);
    setManualValue("");
    setSelectedMethodId(null);
    setMode(canEstimate ? "estimate" : "manual");
  }, [canEstimate, missingKey]);

  if (!missingKey || !clientData || !config || !fieldKey) return null;

  const handleCalculateBMR = async () => {
    try {
      let bmr: number | null = null;

      if (selectedFormula === "mifflin") {
        if (!clientData?.weight_kg || !clientData?.height_cm) {
          setError("Poids et taille requis pour Mifflin-St Jeor");
          return;
        }
        bmr = calculateBMRMifflin(
          clientData.weight_kg,
          clientData.height_cm,
          clientData.age ?? 30,
          clientData.gender === "female" ? "F" : "M",
        );
      } else {
        if (!clientData?.weight_kg || !clientData?.body_fat_pct) {
          setError("Poids et % masse grasse requis pour Katch-McArdle");
          return;
        }
        bmr = calculateBMRKatchMcArdle(
          clientData.weight_kg,
          clientData.body_fat_pct,
        );
      }

      if (bmr) {
        setManualValue(Math.round(bmr).toString());
        setError(null);
      }
    } catch {
      setError("Erreur calcul BMR");
    }
  };

  const handleSave = async () => {
    if (!manualValue) {
      setError("Valeur requise");
      return;
    }
    const numValue = parseFloat(manualValue);
    if (isNaN(numValue)) {
      setError("Nombre invalide");
      return;
    }
    try {
      const payload: Record<string, unknown> = { [fieldKey]: numValue };
      if (missingKey === "bf") {
        payload.body_fat_source = "measured";
        payload.body_fat_source_method = "manual_entry";
      }
      if (missingKey === "lean_mass") {
        payload.lean_mass_source = "measured";
        payload.lean_mass_source_method = "manual_entry";
      }
      if (missingKey === "muscle_mass") {
        payload.muscle_mass_source = "measured";
        payload.muscle_mass_source_method = "manual_entry";
      }
      await onSave(payload);
      setManualValue("");
      setError(null);
    } catch {
      setError("Erreur sauvegarde");
    }
  };

  const handleApplyEstimate = async () => {
    if (!selectedMethod) {
      setError("Aucune méthode d'estimation disponible");
      return;
    }

    const payload: Record<string, unknown> = {};
    const sourcePatch: Partial<Record<string, "estimated">> = {};

    if (selectedMethod.bodyFatPct != null) {
      payload.body_fat_pct = selectedMethod.bodyFatPct;
      payload.body_fat_source = "estimated";
      payload.body_fat_source_method = selectedMethod.id;
      sourcePatch.body_fat_pct = "estimated";
    }
    if (selectedMethod.leanMassKg != null) {
      payload.lean_mass_kg = selectedMethod.leanMassKg;
      payload.lean_mass_source = "estimated";
      payload.lean_mass_source_method = selectedMethod.id;
      sourcePatch.lean_mass_kg = "estimated";
    }
    if (selectedMethod.muscleMassKg != null) {
      payload.muscle_mass_kg = selectedMethod.muscleMassKg;
      payload.muscle_mass_source = "estimated";
      payload.muscle_mass_source_method = selectedMethod.id;
      sourcePatch.muscle_mass_kg = "estimated";
    }

    if (Object.keys(payload).length === 0) {
      setError("Cette estimation ne produit aucune valeur exploitable");
      return;
    }

    try {
      await onSave(payload, { sourcePatch });
      setError(null);
    } catch {
      setError("Erreur lors de l'estimation");
    }
  };

  return (
    <div className="bg-white/[0.02] border-t border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-white/72">
            Corriger {config.label.toLowerCase()}
          </p>
          <p className="mt-1 text-[10px] text-white/40">
            Choisis une estimation si le coach n’a pas la mesure directe.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {canEstimate && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.03] p-1 border border-white/[0.06]">
          <button
            onClick={() => setMode("estimate")}
            className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors ${
              mode === "estimate"
                ? "bg-[#1f8a65] text-white"
                : "text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Estimer
            </span>
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition-colors ${
              mode === "manual"
                ? "bg-[#1f8a65] text-white"
                : "text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Check size={12} />
              Saisie manuelle
            </span>
          </button>
        </div>
      )}

      {mode === "estimate" && canEstimate && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#1f8a65]/20 bg-[#1f8a65]/8 px-3 py-2">
            <p className="text-[10px] text-[#9de3c7] leading-relaxed">
              Les valeurs enregistrées seront visibles comme <strong>estimées</strong> dans cette session du studio.
            </p>
          </div>

          <div className="space-y-2">
            {estimateMethods.map((method) => (
              <EstimateCard
                key={method.id}
                method={method}
                selected={selectedMethod?.id === method.id}
                onSelect={() => {
                  setSelectedMethodId(method.id);
                  setError(null);
                }}
              />
            ))}
          </div>

          <button
            onClick={handleApplyEstimate}
            disabled={saving || !selectedMethod}
            className="w-full py-2 px-3 rounded-lg bg-[#1f8a65] text-white text-[11px] font-semibold hover:bg-[#217356] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Sigma size={13} />
            Appliquer l'estimation
          </button>
        </div>
      )}

      {mode === "estimate" && !canEstimate && config.canCalculate && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-3">
          <p className="text-[10px] font-semibold text-amber-300">
            Estimation indisponible pour le moment
          </p>
          <p className="mt-1 text-[10px] text-white/55 leading-relaxed">
            Il manque encore: {missingInputs.join(", ") || "plusieurs signaux utiles"}.
          </p>
        </div>
      )}

      {mode === "manual" && missingKey === "bmr" && (
        <div className="space-y-2">
          <p className="text-[10px] text-white/50">Formule</p>
          <div className="flex gap-2">
            {(["mifflin", "katch"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFormula(f)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
                  selectedFormula === f
                    ? "bg-blue-500/30 border-[0.3px] border-blue-500/60 text-blue-300"
                    : "bg-white/[0.04] border-[0.3px] border-white/[0.06] text-white/60 hover:text-white/80"
                }`}
              >
                {f === "mifflin" ? "Mifflin" : "Katch"}
              </button>
            ))}
          </div>
          <button
            onClick={handleCalculateBMR}
            disabled={saving}
            className="w-full py-2 px-3 rounded-lg bg-blue-500/20 border-[0.3px] border-blue-500/40 text-[11px] font-medium text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Calculator size={13} />
            Calculer
          </button>
        </div>
      )}

      {mode === "manual" && (
        <>
          <div>
            <p className="text-[10px] text-white/50 mb-1">Valeur</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={manualValue}
                onChange={(e) => {
                  setManualValue(e.target.value);
                  setError(null);
                }}
                placeholder="0"
                className="flex-1 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-1.5 text-[12px] text-white outline-none focus:border-[#1f8a65]/40"
              />
              {config.unit && (
                <span className="text-[10px] text-white/35 w-8">{config.unit}</span>
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !manualValue}
            className="w-full py-2 px-3 rounded-lg bg-[#1f8a65] text-white text-[11px] font-semibold hover:bg-[#217356] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Check size={13} />
            Enregistrer
          </button>
        </>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
