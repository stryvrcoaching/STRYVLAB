"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  CustomSectionItem,
  CustomSectionsContent,
} from "@/types/coach-page";
import {
  COACH_PAGE_IMAGE_ACCEPT,
  uploadCoachPageImage,
} from "@/lib/coach-page/upload-image";
import { PhotoFramePicker } from "@/components/coach-page-builder/PhotoFramePicker";
import {
  FieldCharCount,
  LIMITS,
} from "@/components/coach-page-builder/FieldCharCount";
import {
  UploadFeedback,
  coachPageHintStyle,
} from "@/components/coach-page-builder/UploadFeedback";
import { cn } from "@/lib/utils";

const MAX_CUSTOM_SECTIONS = 5;

interface Props {
  content: CustomSectionsContent;
  coachId: string;
  onChange: (content: CustomSectionsContent) => void;
  onSave?: (content: CustomSectionsContent) => Promise<void>;
}

function createItem(): CustomSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    is_enabled: true,
    image_position: "right",
    text_align: "left",
    surface_style: "plain",
    spacing: "regular",
    photo_frame: "rounded",
  };
}

export function CustomSectionsEditor({ content, onChange, onSave }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(
    content.items?.[0]?.id ?? null,
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const items = (content.items ?? []).slice(0, MAX_CUSTOM_SECTIONS);

  const notify = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 3200);
  };

  const setItems = (nextItems: CustomSectionItem[]) => {
    onChange({ ...content, items: nextItems.slice(0, MAX_CUSTOM_SECTIONS) });
  };

  const updateItem = (id: string, patch: Partial<CustomSectionItem>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const persistItems = async (nextItems: CustomSectionItem[], message: string) => {
    const next = { ...content, items: nextItems.slice(0, MAX_CUSTOM_SECTIONS) };
    onChange(next);
    if (onSave) {
      await onSave(next);
      notify(message);
    } else {
      notify(`${message} — clique Enregistrer pour finaliser`);
    }
  };

  const addItem = () => {
    if (items.length >= MAX_CUSTOM_SECTIONS) return;
    const item = createItem();
    setItems([...items, item]);
    setExpandedId(item.id);
  };

  const removeItem = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    if (expandedId === id) setExpandedId(next[0]?.id ?? null);
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const uploadPhoto = async (item: CustomSectionItem, file?: File) => {
    if (!file) return;
    setUploadingId(item.id);
    setError(null);
    try {
      const url = await uploadCoachPageImage(file, "custom", file.name);
      await persistItems(
        items.map((current) =>
          current.id === item.id ? { ...current, photo_url: url } : current,
        ),
        "Photo enregistrée",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload impossible");
    } finally {
      setUploadingId(null);
    }
  };

  const removePhoto = async (item: CustomSectionItem) => {
    setError(null);
    try {
      await persistItems(
        items.map((current) =>
          current.id === item.id ? { ...current, photo_url: undefined } : current,
        ),
        "Photo retirée",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <UploadFeedback error={error} status={status} />

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[12px] leading-relaxed text-white/55">
        Ajoute jusqu’à 5 sections en plus de ta page. Chaque bloc peut avoir sa propre photo, son texte, son bouton et sa mise en page.
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const expanded = expandedId === item.id;
          const uploading = uploadingId === item.id;
          const name = item.title?.trim() || `Section ${index + 1}`;
          return (
            <article
              className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
              key={item.id}
            >
              <div className="flex items-center gap-2 p-2">
                <button
                  aria-expanded={expanded}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  type="button"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[11px] font-semibold text-white/55">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                    {name}
                  </span>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <button
                  aria-label={item.is_enabled === false ? `Afficher ${name}` : `Masquer ${name}`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  onClick={() => updateItem(item.id, { is_enabled: item.is_enabled === false })}
                  title={item.is_enabled === false ? "Afficher la section" : "Masquer la section"}
                  type="button"
                >
                  {item.is_enabled === false ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  aria-label={`Supprimer ${name}`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                  onClick={() => removeItem(item.id)}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {expanded && (
                <div className="space-y-5 border-t border-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-white/40">Ordre sur la page</p>
                    <div className="flex gap-1.5">
                      <button
                        className={smallButtonClass}
                        disabled={index === 0}
                        onClick={() => moveItem(item.id, -1)}
                        type="button"
                      >
                        Monter
                      </button>
                      <button
                        className={smallButtonClass}
                        disabled={index === items.length - 1}
                        onClick={() => moveItem(item.id, 1)}
                        type="button"
                      >
                        Descendre
                      </button>
                    </div>
                  </div>

                  <Field
                    label="Sur-titre"
                    max={LIMITS.customEyebrow}
                    onChange={(eyebrow) => updateItem(item.id, { eyebrow })}
                    value={item.eyebrow ?? ""}
                  />
                  <Field
                    label="Titre"
                    max={LIMITS.customTitle}
                    onChange={(title) => updateItem(item.id, { title })}
                    required
                    value={item.title ?? ""}
                  />
                  <div>
                    <label className={labelClass}>Texte</label>
                    <textarea
                      className={inputClass}
                      maxLength={LIMITS.customText}
                      onChange={(event) =>
                        updateItem(item.id, { text: event.target.value.slice(0, LIMITS.customText) })
                      }
                      placeholder="Décris cette partie de ton accompagnement…"
                      rows={6}
                      value={item.text ?? ""}
                    />
                    <FieldCharCount max={LIMITS.customText} value={item.text ?? ""} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Alignement du texte"
                      onChange={(text_align) => updateItem(item.id, { text_align: text_align as CustomSectionItem["text_align"] })}
                      options={[{ value: "left", label: "À gauche" }, { value: "center", label: "Centré" }]}
                      value={item.text_align ?? "left"}
                    />
                    <SelectField
                      label="Surface"
                      onChange={(surface_style) => updateItem(item.id, { surface_style: surface_style as CustomSectionItem["surface_style"] })}
                      options={[{ value: "plain", label: "Fond de page" }, { value: "card", label: "Carte encadrée" }]}
                      value={item.surface_style ?? "plain"}
                    />
                    <SelectField
                      label="Espacement"
                      onChange={(spacing) => updateItem(item.id, { spacing: spacing as CustomSectionItem["spacing"] })}
                      options={[{ value: "compact", label: "Compact" }, { value: "regular", label: "Normal" }, { value: "generous", label: "Généreux" }]}
                      value={item.spacing ?? "regular"}
                    />
                    <SelectField
                      label="Position de la photo"
                      onChange={(image_position) => updateItem(item.id, { image_position: image_position as CustomSectionItem["image_position"] })}
                      options={[{ value: "right", label: "À droite" }, { value: "left", label: "À gauche" }, { value: "top", label: "Au-dessus" }, { value: "hidden", label: "Masquée" }]}
                      value={item.image_position ?? "right"}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Photo</label>
                    {item.photo_url ? (
                      <div className="flex items-center gap-3">
                        <div className="h-[75px] w-[60px] overflow-hidden rounded-xl border-[0.3px] border-white/[0.06]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="Aperçu de la section" className="h-full w-full object-cover" src={item.photo_url} />
                        </div>
                        <button
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-red-500/10 px-3 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40"
                          disabled={uploading}
                          onClick={() => void removePhoto(item)}
                          type="button"
                        >
                          <Trash2 size={13} /> Supprimer
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/[0.15] bg-white/[0.02] px-3.5 text-[12px] text-white/55 transition-colors hover:bg-white/[0.04]">
                        <ImagePlus size={15} />
                        {uploading ? "Envoi…" : "Ajouter une photo"}
                        <input
                          accept={COACH_PAGE_IMAGE_ACCEPT}
                          disabled={uploading}
                          hidden
                          onChange={(event) => {
                            void uploadPhoto(item, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                          type="file"
                        />
                      </label>
                    )}
                    <p style={coachPageHintStyle}>JPG, PNG ou WebP · jusqu’à 25 Mo (compression auto)</p>
                    <div className="mt-3">
                      <PhotoFramePicker
                        defaultValue="rounded"
                        label="Cadre de la photo"
                        onChange={(photo_frame) => updateItem(item.id, { photo_frame })}
                        value={item.photo_frame}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Libellé du bouton"
                      max={LIMITS.ctaLabel}
                      onChange={(cta_label) => updateItem(item.id, { cta_label })}
                      value={item.cta_label ?? ""}
                    />
                    <div>
                      <label className={labelClass}>Lien du bouton</label>
                      <input
                        className={inputClass}
                        inputMode="url"
                        onChange={(event) => updateItem(item.id, { cta_url: event.target.value })}
                        placeholder="https://…"
                        type="url"
                        value={item.cta_url ?? ""}
                      />
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <button
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-[#1f8a65]/45 bg-[#1f8a65]/10 px-4 text-[13px] font-semibold text-[#7fe2bf] transition-colors hover:bg-[#1f8a65]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/50",
          items.length >= MAX_CUSTOM_SECTIONS && "cursor-not-allowed opacity-45 hover:bg-[#1f8a65]/10",
        )}
        disabled={items.length >= MAX_CUSTOM_SECTIONS}
        onClick={addItem}
        type="button"
      >
        <Plus size={16} />
        {items.length >= MAX_CUSTOM_SECTIONS
          ? "Limite de 5 sections atteinte"
          : "Ajouter une section"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  max,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}{required ? " (recommandé)" : ""}
      </label>
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
const smallButtonClass = "min-h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 text-[11px] font-medium text-white/60 transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20";
