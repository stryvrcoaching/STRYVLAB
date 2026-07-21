"use client";

import {
  PHOTO_FRAME_OPTIONS,
  COVER_FRAME_OPTIONS,
  type PhotoFrameShape,
  type CoverFrameStyle,
  normalizePhotoFrame,
} from "@/lib/coach-page/photo-frame";
import { cn } from "@/lib/utils";

type FramePickerProps = {
  label?: string;
  value?: string | null;
  onChange: (value: PhotoFrameShape) => void;
  /** Limit options (e.g. hero profile only circle/square/rounded) */
  allowed?: PhotoFrameShape[];
  defaultValue?: PhotoFrameShape;
};

export function PhotoFramePicker({
  label = "Cadre photo",
  value,
  onChange,
  allowed,
  defaultValue = "rounded",
}: FramePickerProps) {
  const current = normalizePhotoFrame(value, defaultValue);
  const options = allowed
    ? PHOTO_FRAME_OPTIONS.filter((o) => allowed.includes(o.value))
    : PHOTO_FRAME_OPTIONS;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-white/50">{label}</p>
      <div
        className="grid grid-cols-2 gap-1.5"
        role="listbox"
        aria-label={label}
      >
        {options.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border px-2.5 py-2 text-left",
                "transition-[border-color,background-color,transform] duration-150",
                "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                active
                  ? "border-[#1f8a65]/45 bg-[#1f8a65]/12"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
              )}
            >
              <FramePreview shape={opt.value} active={active} />
              <span className="text-[11px] font-semibold text-white">
                {opt.label}
              </span>
              <span className="text-[10px] leading-snug text-white/35">
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FramePreview({
  shape,
  active,
}: {
  shape: PhotoFrameShape;
  active: boolean;
}) {
  const base = cn(
    "shrink-0 border bg-white/[0.08]",
    active ? "border-[#7fe2bf]/60" : "border-white/20",
  );

  switch (shape) {
    case "circle":
      return <div className={cn(base, "h-9 w-9 rounded-full")} />;
    case "rounded":
      return <div className={cn(base, "h-9 w-9 rounded-[10px]")} />;
    case "square":
      return <div className={cn(base, "h-9 w-9 rounded-none")} />;
    case "portrait_4_5":
      return <div className={cn(base, "h-11 w-8 rounded-lg")} />;
    case "portrait_3_4":
      return <div className={cn(base, "h-10 w-[30px] rounded-lg")} />;
    case "landscape_16_9":
      return <div className={cn(base, "h-5 w-10 rounded-md")} />;
    case "landscape_3_2":
      return <div className={cn(base, "h-6 w-10 rounded-md")} />;
    case "soft":
    default:
      return <div className={cn(base, "h-7 w-10 rounded-[10px]")} />;
  }
}

type CoverPickerProps = {
  label?: string;
  value?: string | null;
  onChange: (value: CoverFrameStyle) => void;
};

export function CoverFramePicker({
  label = "Hauteur de couverture",
  value,
  onChange,
}: CoverPickerProps) {
  const current = (COVER_FRAME_OPTIONS.find((o) => o.value === value)?.value ??
    "medium") as CoverFrameStyle;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-white/50">{label}</p>
      <div
        className="flex flex-wrap gap-1.5"
        role="listbox"
        aria-label={label}
      >
        {COVER_FRAME_OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "min-h-9 rounded-[10px] border px-3 py-1.5 text-[11px] font-semibold",
                "transition-[border-color,background-color,color,transform] duration-150",
                "active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                active
                  ? "border-[#1f8a65]/45 bg-[#1f8a65]/12 text-[#7fe2bf]"
                  : "border-white/[0.06] bg-white/[0.02] text-white/65 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
