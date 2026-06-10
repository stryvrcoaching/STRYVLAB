"use client";

import { useState } from "react";
import { X, Calculator, Check } from "lucide-react";
import type { NutritionClientData } from "@/lib/nutrition/types";
import type { BiometricsConfig } from "./useNutritionStudio";
import {
  calculateBMRMifflin,
  calculateBMRKatchMcArdle,
} from "@/lib/nutrition/calculators";
import type { MissingDataKey } from "./missingData";

interface Props {
  missingKey: MissingDataKey | null;
  clientData: NutritionClientData | null;
  biometricsConfig: BiometricsConfig;
  onSave: (fieldValue: Record<string, unknown>) => Promise<void>;
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
  bf: { label: "Masse grasse", unit: "%", canCalculate: false },
  steps: { label: "Pas quotidiens", unit: "pas", canCalculate: false },
  lean_mass: { label: "Masse maigre", unit: "kg", canCalculate: false },
  muscle_mass: { label: "Masse musculaire", unit: "kg", canCalculate: false },
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

export default function MissingDataPanel({
  missingKey,
  clientData,
  biometricsConfig,
  onSave,
  onClose,
  saving = false,
}: Props) {
  const [manualValue, setManualValue] = useState<string>("");
  const [selectedFormula, setSelectedFormula] = useState<"mifflin" | "katch">(
    "mifflin",
  );
  const [error, setError] = useState<string | null>(null);

  if (!missingKey || !clientData) return null;

  const config = CONFIG[missingKey];
  const fieldKey = FIELD_MAP[missingKey];

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
    } catch (err) {
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
      await onSave({ [fieldKey]: numValue });
      setManualValue("");
      setError(null);
    } catch (err) {
      setError("Erreur sauvegarde");
    }
  };

  return (
    <div className="bg-white/[0.02] border-t border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-white/60">
          Ajouter {config.label.toLowerCase()}
        </p>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* BMR calculator options */}
      {missingKey === "bmr" && (
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

      {/* Manual input */}
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

      {/* Error */}
      {error && <p className="text-[10px] text-red-400">{error}</p>}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !manualValue}
        className="w-full py-2 px-3 rounded-lg bg-[#1f8a65] text-white text-[11px] font-semibold hover:bg-[#217356] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <Check size={13} />
        Enregistrer
      </button>
    </div>
  );
}
