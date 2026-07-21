"use client";

import type { FontChoice, BgChoice } from "@/types/coach-page";
import { BG_VALUES, isLightBg } from "@/types/coach-page";
import { cn } from "@/lib/utils";

interface Props {
  accentColor: string;
  fontChoice: FontChoice;
  bgChoice: BgChoice;
  children: React.ReactNode;
  className?: string;
}

const FONT_VARS: Record<FontChoice, string> = {
  lufga: "var(--font-lufga), system-ui, sans-serif",
  barlow: "var(--font-barlow), system-ui, sans-serif",
  inter: "var(--font-lufga), system-ui, sans-serif",
};

export function CoachPageThemeProvider({
  accentColor,
  fontChoice,
  bgChoice,
  children,
  className,
}: Props) {
  const bg = BG_VALUES[bgChoice] ?? BG_VALUES.dark;
  const font = FONT_VARS[fontChoice] ?? FONT_VARS.lufga;
  const light = isLightBg(bgChoice);

  const tokens = light
    ? {
        "--cp-text": "#121212",
        "--cp-text-muted": "rgba(18,18,18,0.58)",
        "--cp-text-faint": "rgba(18,18,18,0.38)",
        "--cp-surface": "#ffffff",
        "--cp-surface-2": "rgba(18,18,18,0.035)",
        "--cp-border": "rgba(18,18,18,0.1)",
        "--cp-input": "#ecece8",
        "--cp-on-accent": "#ffffff",
        "--cp-footer": "rgba(18,18,18,0.35)",
      }
    : {
        "--cp-text": "#ffffff",
        "--cp-text-muted": "rgba(255,255,255,0.52)",
        "--cp-text-faint": "rgba(255,255,255,0.35)",
        "--cp-surface": "#181818",
        "--cp-surface-2": "rgba(255,255,255,0.025)",
        "--cp-border": "rgba(255,255,255,0.08)",
        "--cp-input": "#0a0a0a",
        "--cp-on-accent": "#ffffff",
        "--cp-footer": "rgba(255,255,255,0.28)",
      };

  return (
    <div
      className={cn("min-h-full antialiased", className)}
      data-cp-theme={light ? "light" : "dark"}
      style={
        {
          "--cp-accent": accentColor,
          "--cp-bg": bg,
          "--cp-font": font,
          ...tokens,
          backgroundColor: bg,
          fontFamily: font,
          color: tokens["--cp-text"],
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
