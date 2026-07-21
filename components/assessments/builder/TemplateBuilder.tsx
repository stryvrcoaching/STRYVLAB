"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, ChevronLeft, ChevronRight, Eye, Settings2 } from "lucide-react";
import {
  BlockConfig,
  AssessmentTemplate,
  ResponseMap,
  TemplateType,
  type AssessmentResponseValue,
} from "@/types/assessment";
import { AssessmentModule } from "@/types/assessment";
import { createDefaultBlock } from "@/lib/assessments/modules";
import { evaluateCondition } from "@/lib/assessments/condition";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import HeaderIconButton from "@/components/layout/HeaderIconButton";
import MetricField from "@/components/assessments/form/MetricField";
import BlockPalette from "./BlockPalette";
import BlockCard from "./BlockCard";

interface Props {
  initialTemplate?: AssessmentTemplate;
}

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "intake", label: "Bilan d'entrée" },
  { value: "weekly", label: "Check-in hebdomadaire" },
  { value: "monthly", label: "Bilan mensuel" },
  { value: "custom", label: "Personnalisé" },
];

type BuilderMode = "builder" | "preview";

function ClientPreview({
  blocks,
  name,
  description,
}: {
  blocks: BlockConfig[];
  name: string;
  description: string;
}) {
  const [currentBlock, setCurrentBlock] = useState(0);
  const [responses, setResponses] = useState<ResponseMap>({});

  const block = blocks[currentBlock] ?? null;

  function setValue(
    blockId: string,
    fieldKey: string,
    value: AssessmentResponseValue,
  ) {
    setResponses((prev) => ({
      ...prev,
      [blockId]: { ...(prev[blockId] ?? {}), [fieldKey]: value },
    }));
  }

  if (!block) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-white/[0.06] bg-[#111111] text-center">
        <div>
          <p className="text-[14px] font-semibold text-white">Aucun bloc à prévisualiser</p>
          <p className="mt-2 text-[12px] text-white/45">
            Ajoute d'abord un module pour voir le rendu client.
          </p>
        </div>
      </div>
    );
  }

  const visibleFields = block.fields.filter(
    (field) => field.visible && evaluateCondition(field.show_if, responses),
  );

  return (
    <div className="rounded-[30px] border border-white/[0.06] bg-[#111111] shadow-[0_18px_44px_rgba(0,0,0,0.2)]">
      <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
              Aperçu client
            </p>
            <h3 className="mt-1 text-[18px] font-semibold text-white">
              {name || "Nouveau template"}
            </h3>
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-white/48">
                {description}
              </p>
            ) : null}
          </div>
          <div className="rounded-full bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-white/72">
            {currentBlock + 1} / {blocks.length}
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full rounded-full bg-[#1f8a65] transition-all duration-300"
            style={{ width: `${((currentBlock + 1) / blocks.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="rounded-[24px] border border-white/[0.05] bg-[#0d0d0d] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
            Bloc en cours
          </p>
          <h4 className="mt-2 text-[20px] font-semibold text-white">
            {block.label}
          </h4>

          <div className="mt-6 flex flex-col gap-6">
            {visibleFields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
                <p className="text-[12px] font-medium text-white/68">
                  Aucun champ visible dans ce bloc
                </p>
                <p className="mt-1 text-[11px] text-white/42">
                  Vérifie les champs masqués ou les conditions d'affichage.
                </p>
              </div>
            ) : (
              visibleFields.map((field) => (
                <MetricField
                  key={field.key}
                  field={field}
                  value={responses[block.id]?.[field.key]}
                  onChange={(value) => setValue(block.id, field.key, value)}
                  previewMode
                />
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentBlock((value) => Math.max(0, value - 1))}
            disabled={currentBlock === 0}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] font-semibold text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Précédent
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentBlock((value) => Math.min(blocks.length - 1, value + 1))
            }
            disabled={currentBlock === blocks.length - 1}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#217356] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Suivant
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplateBuilder({ initialTemplate }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<BuilderMode>("builder");
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(
    initialTemplate?.description ?? "",
  );
  const [templateType, setTemplateType] = useState<TemplateType>(
    initialTemplate?.template_type ?? "intake",
  );
  const [isDefault, setIsDefault] = useState(
    initialTemplate?.is_default ?? false,
  );
  const [blocks, setBlocks] = useState<BlockConfig[]>(
    initialTemplate?.blocks ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dragFrom = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const usedModules = blocks.map((b) => b.module as AssessmentModule);

  function addBlock(module: AssessmentModule) {
    const block = createDefaultBlock(module, blocks.length);
    setBlocks((prev) => [...prev, block]);
  }

  function deleteBlock(index: number) {
    setBlocks((prev) =>
      prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })),
    );
  }

  function updateBlock(index: number, block: BlockConfig) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? block : b)));
  }

  function handleDrop() {
    if (dragFrom.current === null || dragOver.current === null) return;
    const from = dragFrom.current;
    const to = dragOver.current;
    if (from === to) return;

    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((b, i) => ({ ...b, order: i }));
    });
    dragFrom.current = null;
    dragOver.current = null;
  }

  async function handleSaveInternal() {
    setError("");
    if (!name.trim()) {
      setError("Le nom du template est obligatoire");
      return;
    }
    if (blocks.length === 0) {
      setError("Ajoutez au moins un bloc");
      return;
    }

    setSaving(true);
    try {
      const url = initialTemplate
        ? `/api/assessments/templates/${initialTemplate.id}`
        : "/api/assessments/templates";
      const method = initialTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          template_type: templateType,
          blocks,
          is_default: isDefault,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Erreur lors de la sauvegarde");
        return;
      }

      router.push("/coach/assessments");
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  const handleSave = useCallback(handleSaveInternal, [
    name,
    blocks,
    description,
    templateType,
    isDefault,
    initialTemplate,
    router,
  ]);

  const topBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/coach/assessments")}
          className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center text-white/55 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
            Builder
          </p>
          <p className="text-[13px] font-semibold text-white leading-none">
            {name || "Nouveau template"}
          </p>
        </div>
      </div>
    ),
    [name, router],
  );

  const topBarRight = useMemo(
    () => (
      <div className="flex items-center gap-3">
        {error && (
          <p className="text-[11px] text-red-500 font-medium">{error}</p>
        )}
        <HeaderIconButton
          onClick={handleSave}
          disabled={saving}
          icon={<Save size={14} />}
          label={saving ? "Sauvegarde en cours" : "Sauvegarder"}
          variant="accent"
        />
      </div>
    ),
    [error, saving, handleSave],
  );

  useSetTopBar(topBarLeft, topBarRight);

  return (
    <div className="min-h-screen bg-[#121212] font-sans">
      {/* Name & Type Section */}
      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-4 border-b border-white/[0.07]">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Nom du template
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Entrez le nom du template…"
            className="bg-[#0a0a0a] rounded-xl px-4 py-2.5 text-[14px] font-medium text-white outline-none placeholder:text-white/20 focus:ring-0"
          />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => setMode("builder")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                mode === "builder"
                  ? "bg-[#1f8a65]/12 text-[#8ef0c7]"
                  : "text-white/42 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <Settings2 size={13} />
              Builder
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                mode === "preview"
                  ? "bg-[#1f8a65]/12 text-[#8ef0c7]"
                  : "text-white/42 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              <Eye size={13} />
              Aperçu client
            </button>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Type
            </label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as TemplateType)}
              className="bg-[#0a0a0a] rounded-xl px-3 py-2 text-[13px] text-white outline-none focus:ring-0"
            >
              {TEMPLATE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnelle…"
              className="bg-[#0a0a0a] rounded-xl px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/20 focus:ring-0"
            />
          </div>

          <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer h-full">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="accent-[#1f8a65]"
            />
            Par défaut
          </label>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {mode === "builder" ? (
          <div className="flex gap-8">
            <BlockPalette usedModules={usedModules} onAdd={addBlock} />

            <div className="flex-1 flex flex-col gap-3">
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-white/[0.03] text-white/60 text-[12px]">
                  <p className="font-semibold mb-1">Aucun bloc ajouté</p>
                  <p className="text-[10px] text-white/40">
                    Cliquez sur un module à gauche pour l'ajouter
                  </p>
                </div>
              ) : (
                blocks.map((block, i) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    index={i}
                    total={blocks.length}
                    onDelete={() => deleteBlock(i)}
                    onUpdate={(b) => updateBlock(i, b)}
                    onDragStart={(idx) => {
                      dragFrom.current = idx;
                    }}
                    onDragOver={(idx) => {
                      dragOver.current = idx;
                    }}
                    onDrop={handleDrop}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <ClientPreview
            blocks={blocks}
            name={name}
            description={description}
          />
        )}
      </div>
    </div>
  );
}
