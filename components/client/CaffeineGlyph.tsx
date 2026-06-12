"use client"

import { DRINK_PRESETS, type DrinkType } from "@/lib/client/nutrition/drinks"

type GlyphSize = "sm" | "md" | "lg"

interface Props {
  drinkType: DrinkType
  active?: boolean
  size?: GlyphSize
  className?: string
  color?: string
}

const SIZE_MAP: Record<GlyphSize, { glyph: number; gap: number; chip: string }> = {
  sm: { glyph: 11, gap: 4, chip: "h-6 px-1.5" },
  md: { glyph: 13, gap: 4, chip: "h-7 px-2" },
  lg: { glyph: 15, gap: 5, chip: "h-8 px-2.5" },
}

function BeanGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5c2.9 0 5 2.2 5 5.5S10.9 14.5 8 14.5 3 12.3 3 9 5.1 1.5 8 1.5Z"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.9 2.5c.7 1.2 1.1 2.6 1.1 4.2 0 2.3-.8 4.3-2.3 5.8"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LeafGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M12.8 2.8c-3.6-.7-7 .9-8.8 4.4C2.6 10 2.8 12.5 3.2 13.7c1.2.4 3.7.6 6.5-.9 3.5-1.8 5.1-5.2 4.4-8.8-.1-.5-.7-.9-1.3-1Z"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.8 11.2c1.9-2.4 4.3-4.3 7.2-5.6"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CaffeineGlyph({ drinkType, active = false, size = "md", className = "", color }: Props) {
  const preset = DRINK_PRESETS[drinkType]
  const dims = SIZE_MAP[size]
  const count = preset.cupCount
  const iconColor = color ?? (active ? "#111111" : preset.accent)
  const isTea = drinkType === "tea"

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl border ${dims.chip} ${className}`}
      style={{
        background: active ? preset.accent : "rgba(255,255,255,0.04)",
        borderColor: active ? `${preset.accent}55` : "rgba(255,255,255,0.08)",
        boxShadow: active ? `0 0 0 1px ${preset.accent}22 inset` : "none",
      }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-center" style={{ gap: dims.gap }}>
        {isTea ? (
          <LeafGlyph size={dims.glyph + 2} color={iconColor} />
        ) : (
          Array.from({ length: count }).map((_, index) => (
            <BeanGlyph
              key={`${drinkType}-${index}`}
              size={dims.glyph}
              color={iconColor}
            />
          ))
        )}
      </div>
    </div>
  )
}
