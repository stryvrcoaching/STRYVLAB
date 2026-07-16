"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { BlockConfig, ResponseMap } from "@/types/assessment";
import { evaluateCondition } from "@/lib/assessments/condition";
import MetricField from "./MetricField";
import PointsEarnedOverlay from "@/components/client/PointsEarnedOverlay";

interface Props {
  submissionId: string;
  blocks: BlockConfig[];
  token: string;
  clientName: string;
  isCoach?: boolean;
  /** Réponses initiales (mode édition coach) — pré-remplit le formulaire */
  initialResponses?: ResponseMap;
  /** Callback appelé après sauvegarde réussie en mode coach */
  onSaved?: () => void;
}

export default function AssessmentForm({
  submissionId,
  blocks,
  token,
  clientName,
  isCoach,
  initialResponses,
  onSaved,
}: Props) {
  const [responses, setResponses] = useState<ResponseMap>(initialResponses ?? {});
  const [currentBlock, setCurrentBlock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [error, setError] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const block = blocks[currentBlock];
  const isLast = currentBlock === blocks.length - 1;

  // ── Calculs auto bidirectionnels ────────────────────────────────────────────
  // Trouve le blockId qui contient un field_key donné
  function findBlockId(fieldKey: string): string | null {
    for (const blk of blocks) {
      if (blk.fields.some((f) => f.key === fieldKey)) return blk.id;
    }
    return null;
  }

  function getVal(fieldKey: string, prev: ResponseMap): number | null {
    const bid = findBlockId(fieldKey);
    if (!bid) return null;
    const v = prev[bid]?.[fieldKey];
    return typeof v === "number" && !isNaN(v) ? v : null;
  }

  // Applique les dérivations sans écraser un champ qui vient d'être édité manuellement
  function applyDerived(
    prev: ResponseMap,
    changedBlockId: string,
    changedKey: string,
  ): ResponseMap {
    const next = { ...prev };

    function set(fieldKey: string, value: number) {
      const bid = findBlockId(fieldKey);
      if (!bid) return;
      next[bid] = { ...(next[bid] ?? {}), [fieldKey]: Math.round(value * 100) / 100 };
    }

    const weight = getVal("weight_kg", next);
    const bf_pct = getVal("body_fat_pct", next);
    const bf_kg = getVal("fat_mass_kg", next);
    const mm_kg = getVal("muscle_mass_kg", next);
    const mm_pct = getVal("muscle_mass_pct", next);
    const height = getVal("height_cm", next);

    // body_fat_pct ↔ fat_mass_kg (via weight)
    if (weight && weight > 0) {
      if (changedKey === "body_fat_pct" && bf_pct !== null) {
        set("fat_mass_kg", (weight * bf_pct) / 100);
        set("lean_mass_kg", weight * (1 - bf_pct / 100));
      } else if (changedKey === "fat_mass_kg" && bf_kg !== null) {
        set("body_fat_pct", (bf_kg / weight) * 100);
        set("lean_mass_kg", weight - bf_kg);
      } else if (changedKey === "weight_kg") {
        if (bf_pct !== null) {
          set("fat_mass_kg", (weight * bf_pct) / 100);
          set("lean_mass_kg", weight * (1 - bf_pct / 100));
        } else if (bf_kg !== null) {
          set("body_fat_pct", (bf_kg / weight) * 100);
          set("lean_mass_kg", weight - bf_kg);
        }
        // muscle_mass_kg et muscle_mass_pct sont des valeurs directes de balance — pas de calcul bidirectionnel
      }
    }

    // BMI depuis weight + height
    if (changedKey === "weight_kg" || changedKey === "height_cm") {
      const w = weight ?? getVal("weight_kg", next);
      const h = height ?? getVal("height_cm", next);
      if (w && h && h > 0) {
        set("bmi", w / ((h / 100) * (h / 100)));
      }
    }

    // waist_hip_ratio depuis waist_cm + hips_cm
    if (changedKey === "waist_cm" || changedKey === "hips_cm") {
      const waist = getVal("waist_cm", next);
      const hips = getVal("hips_cm", next);
      if (waist && hips && hips > 0) {
        set("waist_hip_ratio", waist / hips);
      }
    }

    // calories_target (lecture seule) depuis macros : P×4 + C×4 + F×9
    if (
      changedKey === "protein_g" ||
      changedKey === "carbs_g" ||
      changedKey === "fat_g"
    ) {
      const p = getVal("protein_g", next);
      const c = getVal("carbs_g", next);
      const f = getVal("fat_g", next);
      // Recalcule dès qu'au moins une macro est renseignée
      const kcal = ((p ?? 0) * 4) + ((c ?? 0) * 4) + ((f ?? 0) * 9);
      if (kcal > 0) set("calories_target", kcal);
    }

    // Agrégats mensurations : max(droit, gauche) → champ dominant
    if (changedKey === "arm_right_cm" || changedKey === "arm_left_cm") {
      const r = getVal("arm_right_cm", next);
      const l = getVal("arm_left_cm", next);
      const dominant = r !== null && l !== null ? Math.max(r, l) : (r ?? l);
      if (dominant !== null) set("arm_cm", dominant);
    }
    if (changedKey === "thigh_right_cm" || changedKey === "thigh_left_cm") {
      const r = getVal("thigh_right_cm", next);
      const l = getVal("thigh_left_cm", next);
      const dominant = r !== null && l !== null ? Math.max(r, l) : (r ?? l);
      if (dominant !== null) set("thigh_cm", dominant);
    }
    if (changedKey === "calf_right_cm" || changedKey === "calf_left_cm") {
      const r = getVal("calf_right_cm", next);
      const l = getVal("calf_left_cm", next);
      const dominant = r !== null && l !== null ? Math.max(r, l) : (r ?? l);
      if (dominant !== null) set("calf_cm", dominant);
    }

    return next;
  }

  function setValue(
    blockId: string,
    fieldKey: string,
    value: string | number | string[] | boolean,
  ) {
    setResponses((prev) => {
      const withValue = {
        ...prev,
        [blockId]: { ...(prev[blockId] ?? {}), [fieldKey]: value },
      };
      // Dérivations uniquement sur les champs numériques
      if (typeof value === "number") {
        return applyDerived(withValue, blockId, fieldKey);
      }
      return withValue;
    });
  }

  const buildPayload = useCallback(
    (submit = false) => {
      const responseList: object[] = [];
      for (const blk of blocks) {
        const blkResponses = responses[blk.id] ?? {};
        for (const field of blk.fields) {
          if (!field.visible) continue;
          if (!evaluateCondition(field.show_if, responses)) continue;
          const val = blkResponses[field.key];
          if (val === undefined || val === "") continue;
          const row: Record<string, unknown> = {
            block_id: blk.id,
            field_key: field.key,
          };
          if (
            field.input_type === "number" ||
            field.input_type === "scale_1_10"
          ) {
            row.value_number = val;
          } else if (field.input_type === "multiple_choice") {
            row.value_json = val;
          } else if (field.input_type === "boolean") {
            row.value_text = val ? "true" : "false";
          } else if (field.input_type === "photo_upload") {
            row.storage_path = val; // storage_path Supabase, déjà uploadé par le widget
          } else if (field.input_type === "meal_journal") {
            try {
              row.value_json = JSON.parse(val as string);
            } catch {
              row.value_text = val as string;
            }
          } else {
            row.value_text = val;
          }
          responseList.push(row);
        }
      }
      return { responses: responseList, submit };
    },
    [blocks, responses],
  );

  const autoSave = useCallback(async () => {
    if (Object.keys(responses).length === 0) return;
    setSaving(true);
    try {
      const endpoint = isCoach
        ? `/api/assessments/submissions/${submissionId}/responses`
        : `/api/assessments/public/${token}/responses`;
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(false)),
      });
    } catch {
      /* ignore autosave errors */
    }
    setSaving(false);
  }, [responses, submissionId, token, isCoach, buildPayload]);

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(autoSave, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [responses, autoSave]);

  async function handleSubmit() {
    setError("");
    // Validation required — ignorer les champs masqués par condition
    for (const blk of blocks) {
      for (const field of blk.fields) {
        if (!field.required || !field.visible) continue;
        if (!evaluateCondition(field.show_if, responses)) continue;
        const val = responses[blk.id]?.[field.key];
        if (val === undefined || val === "") {
          setError(
            `Champ requis manquant : "${field.label}" dans ${blk.label}`,
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isCoach
        ? `/api/assessments/submissions/${submissionId}/responses`
        : `/api/assessments/public/${token}/responses`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Erreur lors de la soumission");
        return;
      }
      const result = await res.json().catch(() => null);
      if (isCoach && onSaved) {
        onSaved();
        return;
      }
      setPointsEarned(Number(result?.points_earned ?? 0));
      setSubmitted(true);
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#080808] font-sans flex items-center justify-center p-6">
        {!isCoach && <PointsEarnedOverlay open={pointsEarned > 0} points={pointsEarned} />}
        <div className="bg-[#111111] rounded-2xl p-10 text-center max-w-sm w-full">
          <Image src="/logo/logo-stryvr-silver.png" alt="STRYVR" width={40} height={40} className="mx-auto mb-5 h-10 w-10 object-contain" />
          <CheckCircle2 size={56} className="text-[#f2f2f2] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Bilan soumis !
          </h2>
          <p className="text-[12px] text-white/60">
            Merci {clientName}. Votre coach a été notifié.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#080808] px-6 py-4 border-b border-white/[0.06]">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Image
                src="/logo/logo-stryvr-silver.png"
                alt="STRYVR"
                width={24}
                height={24}
                className="w-6 h-6 object-contain"
              />
              <h1 className="font-semibold text-white">{clientName}</h1>
            </div>
            <div className="flex items-center gap-2">
              {saving && (
                <Loader2 size={14} className="animate-spin text-white/60" />
              )}
              <span className="text-[11px] text-white/60 font-medium">
                {currentBlock + 1} / {blocks.length}
              </span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f2f2f2] rounded-full transition-all duration-500"
              style={{
                width: `${((currentBlock + 1) / blocks.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </header>

      {/* Block */}
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-[#111111] rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            {block.label}
          </h2>
          <div className="flex flex-col gap-6">
            {block.fields
              .filter(
                (f) => f.visible && evaluateCondition(f.show_if, responses),
              )
              .map((field) => (
                <MetricField
                  key={field.key}
                  field={field}
                  value={responses[block.id]?.[field.key]}
                  onChange={(val) => setValue(block.id, field.key, val)}
                  submissionToken={isCoach ? undefined : token}
                  submissionId={isCoach ? submissionId : undefined}
                  blockId={block.id}
                />
              ))}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[12px] text-red-400 bg-red-500/10 rounded-lg px-4 py-3 font-medium">
            {error}
          </p>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentBlock((v) => Math.max(0, v - 1))}
            disabled={currentBlock === 0}
            className="flex items-center gap-2 text-[12px] font-medium text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={16} />
            Précédent
          </button>

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#f2f2f2] text-[#080808] text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-2.5 rounded-xl hover:bg-white transition-colors disabled:opacity-50 active:scale-[0.99]"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {submitting ? "Envoi…" : "Soumettre"}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentBlock((v) => Math.min(blocks.length - 1, v + 1))
              }
              className="flex items-center gap-2 bg-white/[0.05] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-6 py-2.5 rounded-lg hover:bg-white/[0.08] transition-colors active:scale-[0.99]"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
