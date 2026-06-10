"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, Settings, Calculator } from "lucide-react";
import type { NutritionClientData } from "@/lib/nutrition/types";
import type { BMRSource } from "@/lib/nutrition/calculators";
import { calculateBMRMifflin } from "@/lib/nutrition/calculators";
import { getNutritionSignalSourceLabel, type NutritionSignalKey } from "@/lib/nutrition/dataGovernance";
import type { MacroResult } from "@/lib/formulas/macros";
import type {
  TrainingConfig,
  LifestyleConfig,
  BiometricsConfig,
  NutritionDataMode,
} from "./useNutritionStudio";
import ParameterAdjustmentPanel from "./ParameterAdjustmentPanel";
import MissingDataAlerts from "./MissingDataAlerts";
import MissingDataPanel from "./MissingDataPanel";
import type { MissingDataKey } from "./missingData";

interface Props {
  clientData: NutritionClientData | null;
  onClientDataChange?: (data: NutritionClientData) => void;
  clientId?: string;
  loading: boolean;
  trainingConfig: TrainingConfig;
  lifestyleConfig: LifestyleConfig;
  biometricsConfig: BiometricsConfig;
  onTrainingChange: (patch: Partial<TrainingConfig>) => void;
  onLifestyleChange: (patch: Partial<LifestyleConfig>) => void;
  onBiometricsChange: (patch: Partial<BiometricsConfig>) => void;
  macroResult: MacroResult | null;
  submissions?: Array<{ id: string; date: string; status: string }>;
  dataMode?: NutritionDataMode;
  anchorDate?: string | null;
  realtimeWindowDays?: number;
  onDataModeChange?: (mode: NutritionDataMode) => void;
  selectedSubmissionId?: string | null;
  onSubmissionChange?: (submissionId: string) => void;
  dataSource?: Record<string, 'selected' | 'fallback' | 'manual'>;
  focusMissingDataKey?: MissingDataKey | null;
  onFocusHandled?: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 mb-2">
      {children}
    </p>
  );
}

function FormulaBadge({ text }: { text: string }) {
  return (
    <div className="rounded-lg border-[0.3px] border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] text-white/70 leading-relaxed">{text}</p>
    </div>
  );
}

function DataRow({
  label,
  value,
  unit,
  source,
  warning,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  source?: string;
  warning?: boolean;
}) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-white/50">{label}</span>
      <div className="flex items-center gap-1.5">
        {warning && <AlertTriangle size={10} className="text-amber-400" />}
        <span
          className={`text-[12px] font-medium ${warning ? "text-amber-400" : "text-white/85"}`}
        >
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
        {source && <span className="text-[9px] text-white/25">{source}</span>}
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number | null;
  unit?: string;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-white/50">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[12px] text-white text-right outline-none focus:border-[#1f8a65]/40"
        />
        {unit && <span className="text-[10px] text-white/35 w-6">{unit}</span>}
      </div>
    </div>
  );
}

export default function ClientIntelligencePanel({
  clientData,
  onClientDataChange,
  clientId,
  loading,
  trainingConfig,
  lifestyleConfig,
  biometricsConfig,
  onTrainingChange,
  onLifestyleChange,
  onBiometricsChange,
  macroResult,
  submissions,
  dataMode = "bilan",
  anchorDate,
  realtimeWindowDays = 7,
  onDataModeChange,
  selectedSubmissionId,
  onSubmissionChange,
  dataSource = {},
  focusMissingDataKey,
  onFocusHandled,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [showBilanDropdown, setShowBilanDropdown] = useState(false);
  const [selectedMissingData, setSelectedMissingData] = useState<MissingDataKey | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!focusMissingDataKey) return;
    setSelectedMissingData(focusMissingDataKey);
    setPanelOpen(true);
    onFocusHandled?.();
  }, [focusMissingDataKey, onFocusHandled]);

  const handleMissingDataSave = useCallback(
    async (fieldValue: Record<string, unknown>) => {
      if (!clientId) return;
      setCompleting(true);
      try {
        // Build PATCH URL with submission ID (ties data to specific bilan)
        const patchUrl = new URL(
          `/api/clients/${clientId}/nutrition-data`,
          typeof window !== "undefined" ? window.location.origin : "",
        );
        patchUrl.searchParams.set("mode", dataMode);
        if (dataMode === "bilan" && selectedSubmissionId) {
          patchUrl.searchParams.set("submissionId", selectedSubmissionId);
        }

        const res = await fetch(patchUrl.toString(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldValue),
        });
        if (!res.ok) throw new Error("Erreur lors de la sauvegarde");

        // Refetch updated client data with same submission ID
        const refetchUrl = new URL(
          `/api/clients/${clientId}/nutrition-data`,
          typeof window !== "undefined" ? window.location.origin : "",
        );
        refetchUrl.searchParams.set("mode", dataMode);
        if (dataMode === "bilan" && selectedSubmissionId) {
          refetchUrl.searchParams.set("submissionId", selectedSubmissionId);
        }
        const refetchRes = await fetch(refetchUrl.toString());
        const refetchData = await refetchRes.json();
        const freshClient: NutritionClientData = refetchData.client;

        onClientDataChange?.(freshClient);
        onBiometricsChange({
          weight_kg: freshClient.weight_kg,
          height_cm: freshClient.height_cm,
          body_fat_pct: freshClient.body_fat_pct,
          lean_mass_kg: freshClient.lean_mass_kg,
          muscle_mass_kg: freshClient.muscle_mass_kg,
          visceral_fat_level: freshClient.visceral_fat_level,
          bmr_kcal_measured: freshClient.bmr_kcal_measured,
        } as Partial<BiometricsConfig>);

        setSelectedMissingData(null);
      } catch (err) {
        console.error("Failed to save missing data:", err);
      } finally {
        setCompleting(false);
      }
    },
    [clientId, dataMode, selectedSubmissionId, onBiometricsChange]
  );

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        {/* Client header */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
          <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
        </div>
        {/* Section label + rows */}
        <div className="space-y-2">
          <div className="h-2 w-16 rounded bg-white/[0.04]" />
          <div className="h-3 w-full rounded bg-white/[0.05]" />
          <div className="h-3 w-full rounded bg-white/[0.05]" />
          {/* BF% bar */}
          <div className="py-1 space-y-1.5">
            <div className="flex justify-between">
              <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
              <div className="h-2.5 w-8 rounded bg-white/[0.04]" />
            </div>
            <div className="h-[3px] w-full rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-3 w-full rounded bg-white/[0.05]" />
          <div className="h-3 w-full rounded bg-white/[0.05]" />
        </div>
        {/* Métabolisme */}
        <div className="space-y-2">
          <div className="h-2 w-20 rounded bg-white/[0.04]" />
          <div className="h-3 w-full rounded bg-white/[0.05]" />
          <div className="h-3 w-3/4 rounded bg-white/[0.05]" />
        </div>
        {/* Button */}
        <div className="h-8 w-full rounded-lg bg-white/[0.04]" />
        {/* TDEE card */}
        <div className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-4 flex flex-col items-center gap-2">
          <div className="h-2 w-16 rounded bg-white/[0.04]" />
          <div className="h-8 w-20 rounded bg-white/[0.06]" />
          <div className="h-2 w-12 rounded bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (!clientData) return null;

  const cd = clientData;
  const bfPct = cd.body_fat_pct ?? macroResult?.estimatedBF;
  const lbm = cd.lean_mass_kg ?? macroResult?.leanMass;
  const bmr =
    dataMode === "realtime"
      ? macroResult?.breakdown.bmr
      : (cd.bmr_kcal_measured ?? macroResult?.breakdown.bmr);
  const bmrSource = cd.bmr_kcal_measured ? "● balance" : "◐ estimé";
  const tdee = macroResult?.tdee;
  const sourceLabel = (key: NutritionSignalKey) =>
    getNutritionSignalSourceLabel(key, dataMode, dataSource[key]);
  const formulaSummary =
    dataMode === "realtime"
      ? `Calcul du jour base sur ${macroResult?.dataProvenance.bmrSource === "mifflin" ? "Mifflin-St Jeor" : "une estimation metabolique"} avec le poids recent, la taille, l'activite et la recuperation de la semaine.`
      : `Calcul base sur le bilan selectionne, puis enrichi avec les donnees recentes autorisees autour du ${anchorDate ?? "bilan actif"}.`;
  const informativeRows = [
    {
      key: "muscle",
      label: "Masse musculaire",
      value: cd.muscle_mass_kg,
      unit: "kg",
      source: sourceLabel("muscle_mass_kg"),
      warning: false,
    },
    {
      key: "visceral",
      label: "Graisse viscerale",
      value: cd.visceral_fat_level,
      unit: undefined,
      source: sourceLabel("visceral_fat_level"),
      warning: (cd.visceral_fat_level ?? 0) >= 10,
    },
  ].filter((row) => row.value != null);

  return (
    <>
      <div className="h-full overflow-y-auto scrollbar-hide p-4 pb-40 space-y-4">
        {/* Client header */}
        <div>
          <p className="text-[13px] font-semibold text-white leading-tight">
            {cd.name}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            {cd.gender === "female" ? "Femme" : "Homme"} · {cd.age} ans
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Source des données
          </span>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.03] p-1 border-[0.3px] border-white/[0.06]">
            <button
              onClick={() => onDataModeChange?.("realtime")}
              className={`h-8 rounded-md text-[10px] font-medium transition-colors ${dataMode === "realtime"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/55 hover:text-white/80 hover:bg-white/[0.05]"
                }`}
            >
              Temps réel
            </button>
            <button
              onClick={() => onDataModeChange?.("bilan")}
              className={`h-8 rounded-md text-[10px] font-medium transition-colors ${dataMode === "bilan"
                  ? "bg-[#1f8a65] text-white"
                  : "text-white/55 hover:text-white/80 hover:bg-white/[0.05]"
                }`}
            >
              Bilan
            </button>
          </div>
          <p className="text-[10px] text-white/35 leading-relaxed">
            {dataMode === "realtime"
              ? `Moyennes recentes ancrees au ${anchorDate ?? "jour courant"} sur ${realtimeWindowDays} jours.`
              : `Calcul ancre au bilan selectionne (${anchorDate ?? "date indisponible"}).`}
          </p>
          {dataMode === "realtime" && (
            <p className="text-[10px] text-white/28 leading-relaxed">
              En temps reel, le calcul du jour privilegie surtout le poids, la taille, l'activite et la recuperation recentes. Les donnees de composition corporelle du dernier bilan restent seulement indicatives.
            </p>
          )}
        </div>

        <FormulaBadge text={formulaSummary} />

        {/* Bilan sélectionné */}
        {dataMode === "bilan" && submissions && submissions.length > 0 && (
          <div className="relative">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                Bilan sélectionné
              </span>
              <button
                onClick={() => setShowBilanDropdown(!showBilanDropdown)}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[10px] text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-all"
              >
                {submissions.find(s => s.id === (selectedSubmissionId ?? submissions[0]?.id))?.date ?? submissions[0]?.date}
              </button>
            </div>

            {showBilanDropdown && (
              <div className="absolute top-full right-0 mt-1.5 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-lg shadow-lg z-10 min-w-[180px]">
                {submissions.map((sub, idx) => (
                  <button
                    key={sub.id}
                    onClick={() => {
                      onSubmissionChange?.(sub.id);
                      setShowBilanDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] transition-colors ${idx > 0 ? "border-t-[0.3px] border-white/[0.06]" : ""
                      } ${selectedSubmissionId === sub.id
                        ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{sub.date}</span>
                      {selectedSubmissionId === sub.id && <span>✓</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Missing data alerts */}
        <MissingDataAlerts
          clientData={clientData}
          macroResult={macroResult}
          dataMode={dataMode}
          dataSource={dataSource}
          onDataClick={setSelectedMissingData}
        />

        <div>
          <SectionLabel>Utilisé dans le calcul</SectionLabel>
          <DataRow
            label="Poids"
            value={cd.weight_kg}
            unit="kg"
            source={sourceLabel("weight_kg")}
          />
          <DataRow
            label="Taille"
            value={cd.height_cm}
            unit="cm"
            source={sourceLabel("height_cm")}
          />
          {dataMode !== "realtime" && bfPct != null && (
            <DataRow
              label="Masse grasse"
              value={bfPct.toFixed(1)}
              unit="%"
              source={sourceLabel("body_fat_pct")}
            />
          )}
          {dataMode !== "realtime" && (
            <DataRow
              label="Masse maigre"
              value={lbm != null ? lbm.toFixed(1) : null}
              unit="kg"
              source={sourceLabel("lean_mass_kg")}
            />
          )}
          <DataRow
            label={dataMode === "realtime" ? "BMR estimé du jour" : "BMR"}
            value={bmr != null ? Math.round(bmr) : null}
            unit="kcal"
            source={
              dataMode === "realtime"
                ? "estimation du jour"
                : cd.bmr_kcal_measured
                  ? sourceLabel("bmr_kcal_measured")
                  : bmrSource
            }
          />
          <DataRow
            label="Pas"
            value={cd.daily_steps != null ? Math.round(cd.daily_steps) : null}
            source={sourceLabel("daily_steps")}
          />
          <DataRow
            label="Sommeil"
            value={
              cd.sleep_duration_h != null ? cd.sleep_duration_h.toFixed(1) : null
            }
            unit="h"
            source={sourceLabel("sleep_duration_h")}
          />
          <DataRow
            label="Qualité sommeil"
            value={
              cd.sleep_quality != null ? cd.sleep_quality.toFixed(1) : null
            }
            source={sourceLabel("sleep_quality")}
          />
          <DataRow
            label="Stress"
            value={cd.stress_level != null ? cd.stress_level.toFixed(1) : null}
            source={sourceLabel("stress_level")}
          />
        </div>

        {informativeRows.length > 0 && (
          <div>
            <SectionLabel>Informatif uniquement</SectionLabel>
            {informativeRows.map((row) => (
              <DataRow
                key={row.key}
                label={row.label}
                value={typeof row.value === "number" ? row.value.toFixed(row.unit === "kg" ? 1 : 0) : row.value}
                unit={row.unit}
                source={row.source}
                warning={row.warning}
              />
            ))}
          </div>
        )}

        {/* Parameters button */}
        <button
          onClick={() => setPanelOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] font-medium text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-all"
        >
          <Settings size={12} />
          Ajuster les paramètres
        </button>

        {/* Large TDEE display */}
        {tdee && (
          <div className="rounded-xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/25 p-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1f8a65]/60 mb-1">
              TDEE estimé
            </p>
            <p className="text-[28px] font-black text-[#1f8a65] leading-none">
              {Math.round(tdee)}
            </p>
            <p className="text-[10px] text-[#1f8a65]/50 mt-1">kcal/jour</p>
          </div>
        )}
      </div>

      {/* Slide-in panel */}
      <ParameterAdjustmentPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        clientData={clientData}
        onUpdateTraining={(field, value) => {
          const numValue = value === "" ? null : Number(value);
          const fieldMap: Record<string, keyof TrainingConfig> = {
            weekly_frequency: "weeklyFrequency",
            session_duration_min: "sessionDurationMin",
            training_calories_weekly: "trainingCaloriesWeekly",
            cardio_frequency: "cardioFrequency",
            cardio_duration_min: "cardioDurationMin",
            daily_steps: "dailySteps",
          };
          const key = fieldMap[field];
          if (key)
            onTrainingChange({ [key]: numValue } as Partial<TrainingConfig>);
        }}
        onUpdateLifestyle={(field, value) => {
          const numValue = value === "" ? null : Number(value);
          const fieldMap: Record<string, keyof LifestyleConfig> = {
            sleep_duration_h: "sleepDurationH",
            sleep_quality: "sleepQuality",
            stress_level: "stressLevel",
            work_hours_per_week: "workHoursPerWeek",
            caffeine_daily_mg: "caffeineDailyMg",
            alcohol_weekly: "alcoholWeekly",
          };
          const key = fieldMap[field];
          if (key)
            onLifestyleChange({ [key]: numValue } as Partial<LifestyleConfig>);
        }}
        onUpdateBiometrics={(field, value) => {
          if (field === "bmr_source") {
            onBiometricsChange({ bmr_source: value as BMRSource });
          } else {
            const numValue = value === "" ? null : Number(value);
            onBiometricsChange({
              [field]: numValue,
            } as Partial<BiometricsConfig>);
          }
        }}
        trainingConfig={trainingConfig}
        lifestyleConfig={lifestyleConfig}
        biometricsConfig={biometricsConfig}
      />

      {/* Missing data panel (inline) */}
      {selectedMissingData && clientData && (
        <MissingDataPanel
          missingKey={selectedMissingData}
          clientData={clientData}
          biometricsConfig={biometricsConfig}
          onSave={handleMissingDataSave}
          onClose={() => setSelectedMissingData(null)}
          saving={completing}
        />
      )}
    </>
  );
}
