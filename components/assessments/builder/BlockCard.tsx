"use client";

import { useState } from "react";
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";
import { BlockConfig, FieldConfig } from "@/types/assessment";

interface Props {
  block: BlockConfig;
  index: number;
  total: number;
  onDelete: () => void;
  onUpdate: (block: BlockConfig) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}

export default function BlockCard({
  block,
  index,
  total,
  onDelete,
  onUpdate,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(block.label);

  function commitLabel() {
    setEditingLabel(false);
    if (labelDraft.trim()) onUpdate({ ...block, label: labelDraft.trim() });
    else setLabelDraft(block.label);
  }

  function toggleVisible(fieldKey: string) {
    const fields = block.fields.map((f: FieldConfig) =>
      f.key === fieldKey ? { ...f, visible: !f.visible } : f,
    );
    onUpdate({ ...block, fields });
  }

  function toggleRequired(fieldKey: string) {
    const fields = block.fields.map((f: FieldConfig) =>
      f.key === fieldKey
        ? {
            ...f,
            required: !f.required,
            visible: !f.required ? true : f.visible,
          }
        : f,
    );
    onUpdate({ ...block, fields });
  }

  function showAll() {
    onUpdate({
      ...block,
      fields: block.fields.map((f) => ({ ...f, visible: true })),
    });
  }

  function hideAll() {
    onUpdate({
      ...block,
      fields: block.fields.map((f) => ({
        ...f,
        visible: false,
        required: false,
      })),
    });
  }

  const visibleCount = block.fields.filter((f) => f.visible).length;
  const requiredCount = block.fields.filter((f) => f.required).length;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
      className="bg-white/[0.02] rounded-xl overflow-hidden select-none hover:bg-white/[0.03] transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02]">
        <GripVertical
          size={15}
          className="text-white/20 cursor-grab shrink-0"
        />

        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => e.key === "Enter" && commitLabel()}
            className="flex-1 text-[12px] font-semibold text-white bg-[#0a0a0a] rounded-lg px-2 py-0.5 outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="flex-1 text-[12px] font-semibold text-white text-left hover:text-[#1f8a65] transition-colors"
          >
            {block.label}
          </button>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 text-[9px] font-bold shrink-0">
          <span className="text-[#1f8a65]">{visibleCount}</span>
          {requiredCount > 0 && (
            <span className="text-white/40">{requiredCount}*</span>
          )}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.05] text-white/55 transition-colors"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.05] text-white/55 hover:text-red-500 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Toolbar rapide */}
      {expanded && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02]">
          <span className="text-[9px] text-white/40 uppercase tracking-[0.12em] font-bold mr-auto">
            Champs
          </span>
          <div className="flex items-center gap-0.5 bg-[#181818] border-subtle rounded-xl p-1">
            <button
              onClick={showAll}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all text-[9px] font-bold text-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              Tout
            </button>
            <button
              onClick={hideAll}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all text-[9px] font-bold text-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              Rien
            </button>
          </div>
        </div>
      )}

      {/* Fields */}
      {expanded && (
        <div className="divide-y divide-white/[0.05]">
          {block.fields.map((field: FieldConfig) => (
            <div
              key={field.key}
              className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${
                !field.visible ? "opacity-40" : ""
              }`}
            >
              {/* Visible toggle */}
              <button
                onClick={() => toggleVisible(field.key)}
                title={field.visible ? "Masquer ce champ" : "Afficher ce champ"}
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  field.visible
                    ? "text-[#1f8a65] hover:text-white/60"
                    : "text-white/20 hover:text-[#1f8a65]"
                }`}
              >
                {field.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>

              {/* Label + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-[12px] text-white truncate">
                    {field.label}
                  </p>
                  {field.show_if && (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 shrink-0"
                      title={`Affiché si "${field.show_if.field_key}" ${field.show_if.operator}${field.show_if.value ? ` "${field.show_if.value}"` : ""}`}
                    >
                      cond.
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/40">
                  {field.input_type}
                  {field.unit ? ` · ${field.unit}` : ""}
                </p>
              </div>

              {/* Required toggle — uniquement si visible */}
              {field.visible && (
                <button
                  onClick={() => toggleRequired(field.key)}
                  title={
                    field.required ? "Rendre optionnel" : "Rendre obligatoire"
                  }
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    field.required
                      ? "text-[#1f8a65]"
                      : "text-white/20 hover:text-white/60"
                  }`}
                >
                  <Star
                    size={12}
                    fill={field.required ? "currentColor" : "none"}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Légende */}
      {expanded && (
        <div className="flex items-center gap-4 px-4 py-2 bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-[9px] text-white/40">
            <Eye size={10} className="text-[#1f8a65]" />
            <span>affiché</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/40">
            <Star size={10} className="text-[#1f8a65]" fill="currentColor" />
            <span>requis</span>
          </div>
        </div>
      )}
    </div>
  );
}
