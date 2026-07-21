"use client";

import type { SectionPresentation, SectionType } from "@/types/coach-page";
import { resolveSectionPresentation } from "@/types/coach-page";
import { FieldCharCount, LIMITS } from "./FieldCharCount";

interface Props {
  type: Exclude<SectionType, "hero" | "custom">;
  value?: SectionPresentation;
  onChange: (value: SectionPresentation) => void;
}

/** Shared controls for native-section headers and layout. */
export function SectionPresentationEditor({ type, value, onChange }: Props) {
  const presentation = resolveSectionPresentation(type, value);
  const set = <K extends keyof SectionPresentation>(
    field: K,
    next: SectionPresentation[K],
  ) => onChange({ ...presentation, [field]: next });

  return (
    <fieldset className="space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <legend className="px-1 text-[11px] font-semibold text-white/70">
        Présentation de la section
      </legend>
      <p className="-mt-1 text-[11px] leading-relaxed text-white/40">
        Ces éléments sont optionnels : efface un champ pour ne pas l’afficher sur la page.
      </p>

      <PresentationField
        label="Sur-titre"
        max={LIMITS.sectionEyebrow}
        onChange={(eyebrow) => set("eyebrow", eyebrow)}
        value={presentation.eyebrow ?? ""}
      />
      <PresentationField
        label="Titre"
        max={LIMITS.sectionTitle}
        onChange={(title) => set("title", title)}
        value={presentation.title ?? ""}
      />
      <div>
        <label className={labelClass}>Sous-titre</label>
        <textarea
          className={inputClass}
          maxLength={LIMITS.sectionSubtitle}
          onChange={(event) => set("subtitle", event.target.value.slice(0, LIMITS.sectionSubtitle))}
          rows={3}
          value={presentation.subtitle ?? ""}
        />
        <FieldCharCount max={LIMITS.sectionSubtitle} value={presentation.subtitle ?? ""} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Alignement"
          onChange={(text_align) => set("text_align", text_align as SectionPresentation["text_align"])}
          options={[{ value: "left", label: "À gauche" }, { value: "center", label: "Centré" }]}
          value={presentation.text_align ?? "left"}
        />
        <SelectField
          label="Surface"
          onChange={(surface_style) => set("surface_style", surface_style as SectionPresentation["surface_style"])}
          options={[{ value: "plain", label: "Fond de page" }, { value: "card", label: "Carte encadrée" }]}
          value={presentation.surface_style ?? "plain"}
        />
        <SelectField
          label="Espacement"
          onChange={(spacing) => set("spacing", spacing as SectionPresentation["spacing"])}
          options={[{ value: "compact", label: "Compact" }, { value: "regular", label: "Normal" }, { value: "generous", label: "Généreux" }]}
          value={presentation.spacing ?? "regular"}
        />
      </div>
    </fieldset>
  );
}

function PresentationField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        maxLength={max}
        onChange={(event) => onChange(event.target.value.slice(0, max))}
        value={value}
      />
      <FieldCharCount max={max} value={value} />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select className={inputClass} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

const labelClass = "mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/40";
const inputClass = "w-full rounded-xl border-[0.3px] border-white/[0.06] bg-[#0a0a0a] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[#1f8a65]/70 focus:ring-1 focus:ring-[#1f8a65]/40";
