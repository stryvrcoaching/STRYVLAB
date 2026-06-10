"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, X, Calculator, Check, AlertTriangle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { NutritionClientData } from "@/lib/nutrition/types";
import type { TrainingConfig, LifestyleConfig } from "./useNutritionStudio";
import type { BMRSource } from "@/lib/nutrition/calculators";
import {
  calculateBMRKatchMcArdle,
  calculateBMRMifflin,
  calculateLBMFromBF,
  describeBMRFormula,
} from "@/lib/nutrition/calculators";

interface BiometricsConfig {
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  muscle_mass_kg: number | null;
  visceral_fat_level: number | null;
  bmr_kcal_measured: number | null;
  bmr_source: BMRSource;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientData: NutritionClientData | null;
  onUpdateTraining: (field: string, value: string) => void;
  onUpdateLifestyle: (field: string, value: string) => void;
  onUpdateBiometrics: (field: string, value: string | BMRSource) => void;
  trainingConfig: TrainingConfig;
  lifestyleConfig: LifestyleConfig;
  biometricsConfig: BiometricsConfig;
}

function NumberInput({
  label,
  value,
  onChange,
  unit,
  onBlur,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  unit?: string;
  onBlur?: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
      <span className="text-[10px] font-semibold text-white/50">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder="—"
          className="w-20 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-1 text-[11px] text-white text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
        />
        {unit && <span className="text-[9px] text-white/35 w-6">{unit}</span>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 mt-4 mb-2">
      {children}
    </p>
  );
}

function SourceBadge({ source }: { source: BMRSource }) {
  const colors = {
    measured: "bg-green-500/20 text-green-400",
    estimated: "bg-gray-500/20 text-gray-400",
    calculated: "bg-blue-500/20 text-blue-400",
  };
  const labels = {
    measured: "Mesurée",
    estimated: "Estimée",
    calculated: "Calculée",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded-md text-[8px] font-semibold ${colors[source]}`}
    >
      {labels[source]}
    </span>
  );
}

export default function ParameterAdjustmentPanel({
  isOpen,
  onClose,
  clientData,
  onUpdateTraining,
  onUpdateLifestyle,
  onUpdateBiometrics,
  trainingConfig,
  lifestyleConfig,
  biometricsConfig,
}: Props) {
  const [showBMRCalculator, setShowBMRCalculator] = useState(false);
  const [bmrFormula, setBMRFormula] = useState<
    "katch-mcardle" | "mifflin-st-jeor"
  >("katch-mcardle");
  const [bmrResult, setBMRResult] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [heightInput, setHeightInput] = useState<string>(
    biometricsConfig.height_cm?.toString() ?? ""
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save debounce 500ms
  const triggerAutoSave = () => {
    setSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Update height input when biometricsConfig changes
  useEffect(() => {
    setHeightInput(biometricsConfig.height_cm?.toString() ?? "");
  }, [biometricsConfig.height_cm]);

  const handleCalculateBMR = () => {
    let result: number | null = null;

    if (
      bmrFormula === "katch-mcardle" &&
      biometricsConfig.weight_kg &&
      biometricsConfig.body_fat_pct !== null
    ) {
      result = calculateBMRKatchMcArdle(
        biometricsConfig.weight_kg,
        biometricsConfig.body_fat_pct,
      );
    } else if (
      bmrFormula === "mifflin-st-jeor" &&
      biometricsConfig.weight_kg &&
      biometricsConfig.height_cm &&
      clientData?.age
    ) {
      result = calculateBMRMifflin(
        biometricsConfig.weight_kg,
        biometricsConfig.height_cm,
        clientData.age,
        clientData.gender === "female"
          ? "F"
          : clientData.gender === "male"
            ? "M"
            : null,
      );
    }

    if (result) {
      setBMRResult(result);
    }
  };

  const handleApplyBMR = () => {
    if (bmrResult) {
      onUpdateBiometrics("bmr_kcal_measured", bmrResult.toString());
      onUpdateBiometrics("bmr_source", "calculated");
      setShowBMRCalculator(false);
      setBMRResult(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[400px] bg-[#181818] z-50 flex flex-col border-l border-white/[0.06]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              <h3 className="text-[13px] font-semibold text-white">
                Ajuster les paramètres
              </h3>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-0">
              {/* Height quick-add if missing */}
              {!biometricsConfig.height_cm && (
                <div className="bg-amber-500/15 border-[0.3px] border-amber-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-amber-300 mb-2">
                        Taille manquante
                      </p>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={heightInput}
                          onChange={(e) => setHeightInput(e.target.value)}
                          placeholder="170"
                          className="flex-1 rounded-lg bg-white/[0.04] border-[0.3px] border-amber-500/40 px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/20 focus:border-amber-500/60"
                        />
                        <span className="text-[9px] text-white/35">cm</span>
                        <button
                          onClick={() => {
                            if (heightInput) {
                              onUpdateBiometrics("height_cm", heightInput);
                              triggerAutoSave();
                            }
                          }}
                          className="rounded-lg bg-amber-500/30 border-[0.3px] border-amber-500/50 px-2 py-1 text-[9px] font-medium text-amber-300 hover:bg-amber-500/40 transition-all"
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Training Section */}
              <SectionLabel>Entraînement</SectionLabel>
              <NumberInput
                label="Fréquence hebdomadaire"
                value={trainingConfig.weeklyFrequency ?? ""}
                onChange={(v) => {
                  onUpdateTraining("weekly_frequency", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="jours"
              />
              <NumberInput
                label="Durée séance"
                value={trainingConfig.sessionDurationMin ?? ""}
                onChange={(v) => {
                  onUpdateTraining("session_duration_min", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="min"
              />
              <NumberInput
                label="Calories entraînement"
                value={trainingConfig.trainingCaloriesWeekly ?? ""}
                onChange={(v) => {
                  onUpdateTraining("training_calories_weekly", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="kcal"
              />
              <NumberInput
                label="Fréquence cardio"
                value={trainingConfig.cardioFrequency ?? ""}
                onChange={(v) => {
                  onUpdateTraining("cardio_frequency", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="séances"
              />
              <NumberInput
                label="Durée cardio"
                value={trainingConfig.cardioDurationMin ?? ""}
                onChange={(v) => {
                  onUpdateTraining("cardio_duration_min", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="min"
              />
              <NumberInput
                label="Étapes quotidiennes"
                value={trainingConfig.dailySteps ?? ""}
                onChange={(v) => {
                  onUpdateTraining("daily_steps", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="pas"
              />

              {/* Lifestyle Section */}
              <SectionLabel>Hygiène de vie</SectionLabel>
              <NumberInput
                label="Heures sommeil"
                value={lifestyleConfig.sleepDurationH ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("sleep_duration_h", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="h"
              />
              <NumberInput
                label="Qualité sommeil"
                value={lifestyleConfig.sleepQuality ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("sleep_quality", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="/ 10"
              />
              <NumberInput
                label="Niveau de stress"
                value={lifestyleConfig.stressLevel ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("stress_level", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="/ 10"
              />
              <NumberInput
                label="Heures travail"
                value={lifestyleConfig.workHoursPerWeek ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("work_hours_per_week", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="h"
              />
              <NumberInput
                label="Caféine quotidienne"
                value={lifestyleConfig.caffeineDailyMg ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("caffeine_daily_mg", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="mg"
              />
              <NumberInput
                label="Alcool hebdomadaire"
                value={lifestyleConfig.alcoholWeekly ?? ""}
                onChange={(v) => {
                  onUpdateLifestyle("alcohol_weekly", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="verre"
              />

              {/* Biometrics Section */}
              <SectionLabel>Composition corporelle</SectionLabel>
              <NumberInput
                label="Poids"
                value={biometricsConfig.weight_kg ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("weight_kg", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="kg"
              />
              <NumberInput
                label="Taille"
                value={biometricsConfig.height_cm ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("height_cm", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="cm"
              />
              <NumberInput
                label="Graisse corporelle"
                value={biometricsConfig.body_fat_pct ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("body_fat_pct", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="%"
              />
              <NumberInput
                label="Masse maigre"
                value={biometricsConfig.lean_mass_kg ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("lean_mass_kg", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="kg"
              />
              <NumberInput
                label="Masse musculaire"
                value={biometricsConfig.muscle_mass_kg ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("muscle_mass_kg", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="kg"
              />
              <NumberInput
                label="Graisse viscérale"
                value={biometricsConfig.visceral_fat_level ?? ""}
                onChange={(v) => {
                  onUpdateBiometrics("visceral_fat_level", v);
                  triggerAutoSave();
                }}
                onBlur={triggerAutoSave}
                unit="level"
              />

              {/* Metabolism Section */}
              <SectionLabel>Métabolisme</SectionLabel>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-white/50">
                    BMR
                  </span>
                  <SourceBadge source={biometricsConfig.bmr_source} />
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={biometricsConfig.bmr_kcal_measured ?? ""}
                    onChange={(e) => {
                      onUpdateBiometrics("bmr_kcal_measured", e.target.value);
                      triggerAutoSave();
                    }}
                    onBlur={triggerAutoSave}
                    placeholder="—"
                    className="w-20 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-1 text-[11px] text-white text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
                  />
                  <span className="text-[9px] text-white/35 w-6">kcal</span>
                </div>
              </div>

              {/* Calculate Button */}
              <button
                onClick={() => setShowBMRCalculator(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-500/20 border-[0.3px] border-blue-500/40 text-[11px] font-medium text-blue-300 hover:bg-blue-500/30 transition-all"
              >
                <Calculator size={14} />
                Calculer le BMR
              </button>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] p-4 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] font-medium text-white/60 hover:text-white/80 transition-all"
              >
                <X size={12} />
                Fermer
              </button>
              <button
                onClick={onClose}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-medium transition-all ${
                  saved
                    ? "bg-green-500/20 border-[0.3px] border-green-500/40 text-green-300"
                    : "bg-[#1f8a65] border-[0.3px] border-[#1f8a65] text-white hover:bg-[#217356]"
                }`}
              >
                {saved ? (
                  <>
                    <Check size={12} />
                    Enregistré
                  </>
                ) : (
                  <>
                    <ChevronLeft size={12} />
                    Fait, retour
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* BMR Calculator Modal */}
          {showBMRCalculator && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={() => setShowBMRCalculator(false)}
            >
              <div
                className="bg-[#181818] rounded-2xl p-6 max-w-sm w-full border-[0.3px] border-white/[0.06]"
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="text-[13px] font-semibold text-white mb-4">
                  Calculer le BMR
                </h4>

                {/* Formula selection */}
                <div className="space-y-2 mb-4">
                  <label className="text-[10px] font-semibold text-white/50 uppercase">
                    Formule
                  </label>
                  <div className="flex gap-2">
                    {(["katch-mcardle", "mifflin-st-jeor"] as const).map(
                      (formula) => (
                        <button
                          key={formula}
                          onClick={() => setBMRFormula(formula)}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all ${
                            bmrFormula === formula
                              ? "bg-blue-500/30 border-[0.3px] border-blue-500/60 text-blue-300"
                              : "bg-white/[0.04] border-[0.3px] border-white/[0.06] text-white/60 hover:text-white/80"
                          }`}
                        >
                          {formula === "katch-mcardle"
                            ? "Katch-McArdle"
                            : "Mifflin-St Jeor"}
                        </button>
                      ),
                    )}
                  </div>
                  <p className="text-[9px] text-white/40 mt-1">
                    {describeBMRFormula(bmrFormula)}
                  </p>
                </div>

                {/* Result display */}
                {bmrResult && (
                  <div className="bg-white/[0.04] rounded-lg p-3 mb-4 border-[0.3px] border-white/[0.06]">
                    <p className="text-[10px] text-white/50 mb-1">
                      Résultat estimé
                    </p>
                    <p className="text-[18px] font-bold text-green-400">
                      {bmrResult} kcal
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      handleCalculateBMR();
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-blue-500/20 border-[0.3px] border-blue-500/40 text-[11px] font-medium text-blue-300 hover:bg-blue-500/30 transition-all"
                  >
                    Calculer
                  </button>
                  <button
                    onClick={handleApplyBMR}
                    disabled={!bmrResult}
                    className="flex-1 py-2 px-3 rounded-lg bg-green-500/20 border-[0.3px] border-green-500/40 text-[11px] font-medium text-green-300 hover:bg-green-500/30 disabled:opacity-50 transition-all"
                  >
                    Appliquer
                  </button>
                  <button
                    onClick={() => {
                      setShowBMRCalculator(false);
                      setBMRResult(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] font-medium text-white/60 hover:text-white/80 transition-all"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
