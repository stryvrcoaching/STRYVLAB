"use client";

import { useState } from "react";
import { X, Calculator, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NutritionClientData } from "@/lib/nutrition/types";
import type { BiometricsConfig } from "./useNutritionStudio";
import {
  calculateBMRMifflin,
  calculateBMRKatchMcArdle,
} from "@/lib/nutrition/calculators";

type MissingDataKey = "bmr" | "weight" | "height" | "bf" | "steps";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  missingKey: MissingDataKey | null;
  clientData: NutritionClientData | null;
  biometricsConfig: BiometricsConfig;
  onApply: (fieldValue: Record<string, unknown>) => Promise<void>;
  completing?: boolean;
}

const MODAL_CONFIG: Record<
  MissingDataKey,
  {
    title: string;
    description: string;
    fields: Array<{
      key: string;
      label: string;
      unit?: string;
      required?: boolean;
    }>;
  }
> = {
  bmr: {
    title: "Calculer le BMR",
    description:
      "Deux formules disponibles : Mifflin-St Jeor (plus précise) ou Katch-McArdle (si composition connue)",
    fields: [{ key: "formula", label: "Formule", required: true }],
  },
  weight: {
    title: "Ajouter le poids",
    description: "Saisir le poids corporel actuel",
    fields: [{ key: "weight_kg", label: "Poids", unit: "kg", required: true }],
  },
  height: {
    title: "Ajouter la taille",
    description: "Saisir la taille",
    fields: [{ key: "height_cm", label: "Taille", unit: "cm", required: true }],
  },
  bf: {
    title: "Ajouter le % masse grasse",
    description: "Saisir le pourcentage de masse grasse",
    fields: [
      { key: "body_fat_pct", label: "Masse grasse", unit: "%", required: true },
    ],
  },
  steps: {
    title: "Ajouter les pas quotidiens",
    description: "Saisir la moyenne de pas par jour",
    fields: [
      {
        key: "daily_steps",
        label: "Pas quotidiens",
        unit: "pas",
        required: true,
      },
    ],
  },
};

export default function CompleteMissingDataModal({
  isOpen,
  onClose,
  missingKey,
  clientData,
  biometricsConfig,
  onApply,
  completing = false,
}: Props) {
  const [selectedFormula, setSelectedFormula] = useState<"mifflin" | "katch">(
    "mifflin",
  );
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !missingKey || !clientData) return null;

  const config = MODAL_CONFIG[missingKey];

  const handleCalculate = async () => {
    if (missingKey !== "bmr" || !clientData.weight_kg || !clientData.height_cm)
      return;

    setLoading(true);
    setError(null);
    try {
      let bmr: number;

      if (selectedFormula === "mifflin") {
        const result = calculateBMRMifflin(
          clientData.weight_kg,
          clientData.height_cm,
          clientData.age ?? 0,
          (clientData.gender === 'M' || clientData.gender === 'F') ? clientData.gender : null,
        )
        if (result === null) throw new Error("Données insuffisantes pour calculer le BMR")
        bmr = result
      } else {
        // Katch-McArdle requires lean mass
        if (!clientData.lean_mass_kg && !clientData.body_fat_pct) {
          setError(
            "Composition corporelle requise pour Katch-McArdle. Entrez le % masse grasse ou LBM d'abord.",
          );
          return;
        }

        let lbm = clientData.lean_mass_kg;
        if (!lbm && clientData.body_fat_pct) {
          lbm = clientData.weight_kg * ((100 - clientData.body_fat_pct) / 100);
        }

        if (!lbm) return;

        // Katch-McArdle: BMR = 370 + 21.6 × LBM — lbm already computed above
        bmr = Math.round(370 + 21.6 * lbm)
      }

      await onApply({
        bmr_kcal_measured: Math.round(bmr),
        bmr_source: "calculated",
      });
      onClose();
    } catch (err) {
      console.error("Calculate BMR error:", err);
      setError("Erreur lors du calcul. Vérifiez les données et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualApply = async () => {
    if (!config.fields[0]) return;
    const field = config.fields[0].key;
    const value = manualValues[field];
    if (!value) {
      setError("Veuillez entrer une valeur");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onApply({ [field]: parseFloat(value) });
      onClose();
    } catch (err) {
      console.error("Apply manual value error:", err);
      setError("Erreur lors de la sauvegarde. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const isBMRMode = missingKey === "bmr";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] bg-[#181818] rounded-2xl border-[0.3px] border-white/[0.06] w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-white">
              {config.title}
            </h3>
            <p className="text-[10px] text-white/50 mt-1">
              {config.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/60 hover:bg-white/[0.08] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-5">
          {isBMRMode ? (
            <div className="space-y-3">
              {/* Formula selector */}
              <div>
                <p className="text-[10px] font-semibold text-white/60 mb-2">
                  Choisir formule
                </p>
                <div className="space-y-2">
                  {[
                    {
                      id: "mifflin",
                      label: "Mifflin-St Jeor",
                      desc: "Plus précise (général)",
                    },
                    {
                      id: "katch",
                      label: "Katch-McArdle",
                      desc: "Plus précise (composition connue)",
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() =>
                        setSelectedFormula(option.id as "mifflin" | "katch")
                      }
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border-[0.3px] transition-all ${
                        selectedFormula === option.id
                          ? "bg-[#1f8a65]/10 border-[#1f8a65]/40 text-[#1f8a65]"
                          : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="mt-0.5">
                        {selectedFormula === option.id ? (
                          <Check size={14} />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border-[0.3px] border-white/[0.2]" />
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-[11px] font-medium">
                          {option.label}
                        </div>
                        <div className="text-[9px] text-white/40 mt-0.5">
                          {option.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Formula explanation */}
                {selectedFormula === "katch" &&
                  !clientData.lean_mass_kg &&
                  !clientData.body_fat_pct && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border-[0.3px] border-amber-500/20 text-[10px] text-amber-300/80">
                      ⚠ Composition corporelle requise (LBM ou %)
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-semibold text-white/60 mb-2">
                Valeur
              </p>
              <input
                type="number"
                placeholder="0"
                value={manualValues[config.fields[0]?.key] ?? ""}
                onChange={(e) =>
                  setManualValues({
                    ...manualValues,
                    [config.fields[0]?.key]: e.target.value,
                  })
                }
                className="w-full rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 py-2 text-[12px] text-white outline-none focus:border-[#1f8a65]/40"
              />
              {config.fields[0]?.unit && (
                <p className="text-[9px] text-white/40 mt-1">
                  Unité: {config.fields[0].unit}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border-[0.3px] border-red-500/20 text-[11px] text-red-300/80">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-white/[0.04] text-white/60 text-[12px] font-medium hover:bg-white/[0.06] hover:text-white/80 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={isBMRMode ? handleCalculate : handleManualApply}
            disabled={loading || completing}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#1f8a65] text-white text-[12px] font-semibold hover:bg-[#217356] active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            {isBMRMode ? (
              <>
                <Calculator size={13} />
                Calculer
              </>
            ) : (
              <>
                <Check size={13} />
                Appliquer
              </>
            )}
          </button>
        </div>
      </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
