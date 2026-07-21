"use client";

import { useRef, useState } from "react";
import { Camera, Upload, X, Loader2, Check, ChevronDown, ChevronUp, Info } from "lucide-react";
import { FieldConfig } from "@/types/assessment";
import type { AssessmentResponseValue } from "@/types/assessment";
import MealJournalField from "./MealJournalField";
import FoodPreferencesField from "./FoodPreferencesField";

interface Props {
  field: FieldConfig;
  value: AssessmentResponseValue | undefined;
  onChange: (value: AssessmentResponseValue) => void;
  previewMode?: boolean;
  // token de la soumission publique — requis pour upload côté client
  submissionToken?: string;
  // id de la soumission — requis pour upload côté coach
  submissionId?: string;
  blockId?: string;
}

// Widget photo dédié — gère l'upload vers Supabase Storage via signed URL
function PhotoUploadWidget({
  field,
  value,
  onChange,
  previewMode,
  submissionToken,
  submissionId,
  blockId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  // value = storage_path une fois uploadé
  const uploaded = typeof value === "string" && value.length > 0;

  async function handleFile(file: File) {
    setUploadError("");

    // Validation locale — aligner avec bucket Supabase (31457280 bytes = 30 Mo)
    if (!file.type.startsWith("image/")) {
      setUploadError("Format non supporté — JPG, PNG ou WEBP uniquement");
      return;
    }
    const MAX_FILE_SIZE = 31457280; // 30 Mo
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Taille max : 30 Mo");
      return;
    }

    // Prévisualisation immédiate
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";

      // Obtenir la signed upload URL
      const urlEndpoint = submissionToken
        ? `/api/assessments/public/${submissionToken}/upload-url`
        : `/api/assessments/submissions/${submissionId}/upload-url`;

      const urlRes = await fetch(urlEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field_key: field.key,
          block_id: blockId,
          file_extension: ext,
        }),
      });

      if (!urlRes.ok) {
        const d = await urlRes.json();
        setUploadError(d.error || "Impossible d'obtenir l'URL d'upload");
        setPreview(null);
        return;
      }

      const { upload_url, storage_path } = await urlRes.json();

      // Upload direct vers Supabase Storage
      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        // Extraire le message d'erreur détaillé si disponible
        let errorMsg = "Échec de l'upload — réessayez";
        try {
          const errorData = await uploadRes.json();
          if (errorData.message) errorMsg = errorData.message;
        } catch {
          // Si la réponse n'est pas JSON, utiliser le status
          if (uploadRes.status === 413) {
            errorMsg = "Fichier trop volumineux (max 30 Mo)";
          }
        }
        setUploadError(errorMsg);
        setPreview(null);
        return;
      }

      // Communiquer le storage_path au parent (sera enregistré dans les réponses)
      onChange(storage_path);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Erreur réseau — réessayez";
      setUploadError(errMsg);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    setUploadError("");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const { label, required, helper } = field;
  const [guideOpen, setGuideOpen] = useState(false);

  // Détection guide photo : helper multiligne avec "📸"
  const isPhotoGuide = helper?.startsWith("📸");

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <label className="text-[12px] font-semibold text-white flex items-center gap-1.5">
          <Camera size={14} className="text-white/40 shrink-0" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
        {uploaded && !uploading && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#1f8a65] shrink-0">
            <Check size={12} />
            Uploadée
          </span>
        )}
      </div>

      {helper && !isPhotoGuide && (
        <p className="text-[11px] text-white/40 mb-2">{helper}</p>
      )}

      {/* Guide photo — accordion */}
      {isPhotoGuide && helper && (
        <div className="mb-3 rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-white/60">
              <Info size={13} className="text-[#1f8a65] shrink-0" />
              Guide photo — comment bien prendre la photo
            </span>
            {guideOpen ? (
              <ChevronUp size={13} className="text-white/40 shrink-0" />
            ) : (
              <ChevronDown size={13} className="text-white/40 shrink-0" />
            )}
          </button>
          {guideOpen && (
            <div className="px-3 pb-3 border-t border-white/[0.04]">
              <div className="pt-2.5 flex flex-col gap-1.5">
                {helper
                  .split("\n")
                  .filter((line) => line.trim().length > 0)
                  .map((line, i) => {
                    const isBullet = line.trim().startsWith("•");
                    const isTitle = line.trim().startsWith("📸");
                    if (isTitle) {
                      return (
                        <p key={i} className="text-[11px] font-semibold text-white/70 mb-1">
                          {line.trim()}
                        </p>
                      );
                    }
                    if (isBullet) {
                      const parts = line.trim().slice(2).split(" : ");
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[#1f8a65] text-[11px] mt-0.5 shrink-0">•</span>
                          <p className="text-[11px] text-white/55 leading-relaxed">
                            {parts.length > 1 ? (
                              <>
                                <span className="font-semibold text-white/75">{parts[0]}</span>
                                {" : "}
                                {parts.slice(1).join(" : ")}
                              </>
                            ) : (
                              line.trim().slice(2)
                            )}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <p key={i} className="text-[11px] text-white/40">
                        {line.trim()}
                      </p>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zone de drop / preview */}
      <div
        className={`relative rounded-card overflow-hidden border-2 transition-all ${
          uploaded
            ? "border-green-300/60 bg-green-50/30"
            : "border-dashed border-white/80 bg-surface-light"
        }`}
        style={{ minHeight: "140px" }}
        onClick={() => !uploading && !uploaded && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (previewMode) return;
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {preview || uploaded ? (
          /* État : photo présente */
          <div className="flex flex-col items-center justify-center p-4 gap-2">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={label}
                className="max-h-40 rounded-lg object-cover shadow-md"
              />
            )}
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 size={16} className="animate-spin" />
                Upload en cours…
              </div>
            )}
            {uploaded && !uploading && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-secondary/60">
                  Photo enregistrée
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                >
                  <X size={12} />
                  Supprimer
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (previewMode) return;
                    inputRef.current?.click();
                  }}
                  className="text-xs font-bold text-accent hover:opacity-80 transition-opacity"
                >
                  Remplacer
                </button>
              </div>
            )}
          </div>
        ) : (
          /* État : vide */
          <div
            className="flex flex-col items-center justify-center gap-3 p-6 cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (previewMode) return;
              if (e.key === "Enter") inputRef.current?.click();
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center">
              <Upload size={20} className="text-secondary/60" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                Cliquez ou glissez une photo
              </p>
              <p className="text-xs text-secondary/60 mt-0.5">
                {previewMode ? "Aperçu visuel du champ photo" : "JPG, PNG, WEBP · max 30 Mo"}
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <p className="mt-1.5 text-xs font-medium text-red-500">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={previewMode}
        onChange={(e) => {
          if (previewMode) return;
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

// Accordion guide pour les champs de mensuration (helper commençant par "📏")
function MeasureGuideAccordion({ helper }: { helper: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-white/60">
          <Info size={13} className="text-[#1f8a65] shrink-0" />
          Comment prendre cette mesure ?
        </span>
        {open ? (
          <ChevronUp size={13} className="text-white/40 shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-white/40 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-white/[0.04]">
          <div className="pt-2.5 flex flex-col gap-1.5">
            {helper
              .split("\n")
              .filter((line) => line.trim().length > 0)
              .map((line, i) => {
                const isBullet = line.trim().startsWith("•");
                const isTitle = line.trim().startsWith("📏");
                if (isTitle) {
                  return (
                    <p key={i} className="text-[11px] font-semibold text-white/70 mb-1">
                      {line.trim()}
                    </p>
                  );
                }
                if (isBullet) {
                  const parts = line.trim().slice(2).split(" : ");
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[#1f8a65] text-[11px] mt-0.5 shrink-0">•</span>
                      <p className="text-[11px] text-white/55 leading-relaxed">
                        {parts.length > 1 ? (
                          <>
                            <span className="font-semibold text-white/75">{parts[0]}</span>
                            {" : "}
                            {parts.slice(1).join(" : ")}
                          </>
                        ) : (
                          line.trim().slice(2)
                        )}
                      </p>
                    </div>
                  );
                }
                return (
                  <p key={i} className="text-[11px] text-white/40">
                    {line.trim()}
                  </p>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MetricField({
  field,
  value,
  onChange,
  previewMode,
  submissionToken,
  submissionId,
  blockId,
}: Props) {
  const {
    input_type,
    label,
    unit,
    min,
    max,
    step,
    options,
    required,
    placeholder,
    helper,
  } = field;

  const labelEl = (
    <div className="flex items-start justify-between gap-2 mb-1.5">
      <label className="text-[12px] font-semibold text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {unit && (
          <span className="text-white/60 font-normal ml-1">({unit})</span>
        )}
      </label>
    </div>
  );

  // Accordion guide pour les helpers 📏 (mensurations)
  const isMeasureGuide = helper?.startsWith("📏");

  const measureGuideEl = isMeasureGuide && helper ? (
    <MeasureGuideAccordion helper={helper} />
  ) : null;

  if (input_type === "number") {
    return (
      <div>
        {labelEl}
        {helper && !isMeasureGuide && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        {measureGuideEl}
        <input
          type="number"
          min={min}
          max={max}
          step={step ?? 0.1}
          value={(value as number) ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : parseFloat(e.target.value))
          }
          onWheel={(e) => e.currentTarget.blur()}
          placeholder={
            placeholder ??
            (min !== undefined && max !== undefined ? `${min} – ${max}` : "")
          }
          className="w-full bg-[#0a0a0a] rounded-lg px-4 py-3 text-[13px] font-mono text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20 transition-all"
        />
      </div>
    );
  }

  if (input_type === "text") {
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Votre ${label.toLowerCase()}…`}
          className="w-full bg-[#0a0a0a] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20 transition-all"
        />
      </div>
    );
  }

  if (input_type === "textarea") {
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Votre ${label.toLowerCase()}…`}
          className="w-full bg-[#0a0a0a] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20 transition-all resize-none"
        />
      </div>
    );
  }

  if (input_type === "date") {
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#0a0a0a] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20 transition-all"
        />
      </div>
    );
  }

  if (input_type === "boolean") {
    const checked = value === true || value === "true";
    return (
      <div>
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors ${
            checked ? "bg-[#1f4637]" : "bg-white/[0.03] hover:bg-white/[0.05]"
          }`}
        >
          <div
            className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0 ${
              checked
                ? "bg-[#1f8a65] text-white"
                : "bg-white/[0.02] border border-white/[0.08]"
            }`}
          >
            {checked && <span className="text-[9px] font-bold">✓</span>}
          </div>
          <span className="text-[12px] font-semibold text-white">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        </button>
      </div>
    );
  }

  if (input_type === "scale_1_10") {
    const current = value as number | undefined;
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`flex-1 py-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                current === n
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-white/40 mt-1.5 px-1">
          <span>Faible</span>
          <span>Élevé</span>
        </div>
      </div>
    );
  }

  if (input_type === "single_choice") {
    const current = (value as string) ?? "";
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <div className="flex flex-wrap gap-2">
          {(options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(current === opt ? "" : opt)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                current === opt
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (input_type === "multiple_choice") {
    const current: string[] = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      const next = current.includes(opt)
        ? current.filter((v) => v !== opt)
        : [...current, opt];
      onChange(next);
    };
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <div className="flex flex-wrap gap-2">
          {(options ?? []).map((opt) => {
            const selected = current.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                  selected
                    ? "bg-[#1f8a65] text-white"
                    : "bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                {selected && <span className="mr-1 text-[9px]">✓</span>}
                {opt}
              </button>
            );
          })}
        </div>
        {current.length > 0 && (
          <p className="text-[9px] text-white/40 mt-1.5">
            {current.length} sélectionné{current.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }

  if (input_type === "photo_upload") {
    return (
      <PhotoUploadWidget
        field={field}
        value={value}
        onChange={onChange}
        previewMode={previewMode}
        submissionToken={submissionToken}
        submissionId={submissionId}
        blockId={blockId}
      />
    );
  }

  if (input_type === "meal_journal") {
    return (
      <div>
        {helper && <p className="text-[11px] text-white/40 mb-2">{helper}</p>}
        <MealJournalField
          value={value as string | undefined}
          onChange={(v) => onChange(v)}
          submissionToken={submissionToken}
          submissionId={submissionId}
        />
      </div>
    );
  }

  if (input_type === "food_preferences") {
    const catalogEndpoint = submissionToken
      ? `/api/assessments/public/${submissionToken}/food-items`
      : submissionId
        ? `/api/assessments/submissions/${submissionId}/food-items`
        : undefined;
    return (
      <div>
        {labelEl}
        {helper && <p className="text-[11px] text-white/40 mb-3">{helper}</p>}
        <FoodPreferencesField
          value={value}
          onChange={onChange}
          catalogEndpoint={catalogEndpoint}
          previewMode={previewMode}
        />
      </div>
    );
  }

  return null;
}
