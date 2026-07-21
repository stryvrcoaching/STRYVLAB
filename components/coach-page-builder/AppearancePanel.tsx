"use client";

import type { FontChoice, BgChoice } from "@/types/coach-page";
import {
  PRESET_ACCENT_COLORS,
  BG_LABELS,
  FONT_LABELS,
} from "@/types/coach-page";
import { APPEARANCE_TEMPLATES } from "@/lib/coach-page/appearance-templates";

interface Props {
  accentColor: string;
  fontChoice: FontChoice;
  bgChoice: BgChoice;
  onChange: (
    field: "accent_color" | "font_choice" | "bg_choice",
    value: string,
  ) => void;
  onApplyTemplate?: (template: {
    accent_color: string;
    font_choice: FontChoice;
    bg_choice: BgChoice;
  }) => void;
}

export function AppearancePanel({
  accentColor,
  fontChoice,
  bgChoice,
  onChange,
  onApplyTemplate,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2.5 text-[11px] font-semibold text-white/50">
          Templates
        </p>
        <div className="grid gap-1.5">
          {APPEARANCE_TEMPLATES.map((template) => {
            const active =
              accentColor.toLowerCase() ===
                template.accent_color.toLowerCase() &&
              fontChoice === template.font_choice &&
              bgChoice === template.bg_choice;
            return (
              <button
                className={`rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                  active
                    ? "border-[#1f8a65]/50 bg-[#1f8a65]/10"
                    : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
                key={template.id}
                onClick={() =>
                  onApplyTemplate
                    ? onApplyTemplate({
                        accent_color: template.accent_color,
                        font_choice: template.font_choice,
                        bg_choice: template.bg_choice,
                      })
                    : (() => {
                        onChange("accent_color", template.accent_color);
                        onChange("font_choice", template.font_choice);
                        onChange("bg_choice", template.bg_choice);
                      })()
                }
                type="button"
                aria-pressed={active}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-7 w-7 shrink-0 rounded-lg border border-white/10 outline outline-1 outline-white/[0.06] outline-offset-[-1px]"
                    style={{ background: template.accent_color }}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-white">
                      {template.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/40">
                      {template.description}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold text-white/50">
          Couleur d&apos;accent
        </p>
        <div className="mb-3 flex flex-wrap gap-1">
          {PRESET_ACCENT_COLORS.map((color) => (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              key={color}
              onClick={() => onChange("accent_color", color)}
              title={color}
              type="button"
              aria-label={`Accent ${color}`}
              aria-pressed={accentColor === color}
            >
              <span
                className="h-7 w-7 rounded-full border-2 transition-transform duration-150"
                style={{
                  background: color,
                  borderColor:
                    accentColor === color ? "#ffffff" : "transparent",
                  boxShadow:
                    accentColor === color
                      ? `0 0 0 2px ${color}`
                      : "none",
                  transform: accentColor === color ? "scale(1.06)" : "scale(1)",
                }}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 shrink-0 rounded-lg border border-white/[0.06] outline outline-1 outline-white/[0.06] outline-offset-[-1px]"
            style={{ background: accentColor }}
            aria-hidden
          />
          <input
            className="h-9 w-[110px] rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-3 font-mono text-[13px] text-white outline-none transition-[border-color] duration-150 placeholder:text-white/25 focus:border-[#1f8a65]/50 focus-visible:ring-2 focus-visible:ring-[#1f8a65]/30"
            maxLength={7}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange("accent_color", v);
            }}
            placeholder="#1f8a65"
            type="text"
            value={accentColor}
            aria-label="Code hex accent"
          />
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold text-white/50">Police</p>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(FONT_LABELS) as FontChoice[]).map((font) => (
            <button
              className={`min-h-10 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                fontChoice === font
                  ? "border-[#1f8a65]/45 bg-white/[0.04] text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-white/55 hover:text-white"
              }`}
              key={font}
              onClick={() => onChange("font_choice", font)}
              type="button"
              aria-pressed={fontChoice === font}
            >
              {FONT_LABELS[font]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-[11px] font-semibold text-white/50">Fond</p>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(BG_LABELS) as BgChoice[]).map((bg) => (
            <button
              className={`min-h-10 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                bgChoice === bg
                  ? "border-[#1f8a65]/45 bg-white/[0.04] text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-white/55 hover:text-white"
              }`}
              key={bg}
              onClick={() => onChange("bg_choice", bg)}
              type="button"
              aria-pressed={bgChoice === bg}
            >
              {BG_LABELS[bg]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
