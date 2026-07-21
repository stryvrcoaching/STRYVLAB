"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { CoachPageRenderer } from "@/components/coach-page/CoachPageRenderer";
import type {
  BuilderSection,
  CoachPage,
  PublicFormula,
} from "@/types/coach-page";
import { cn } from "@/lib/utils";

interface Props {
  page: CoachPage;
  sections: BuilderSection[];
  formulas: PublicFormula[];
  profile: {
    full_name?: string | null;
    brand_name?: string | null;
    logo_url?: string | null;
  };
  /**
   * `full` — mode Aperçu (mobile/desktop, largeur dispo).
   * `sidebar` — panneau permanent à droite pendant l’édition (mobile only).
   */
  variant?: "full" | "sidebar";
  className?: string;
}

export function LivePreview({
  page,
  sections,
  formulas,
  profile,
  variant = "full",
  className,
}: Props) {
  const isSidebar = variant === "sidebar";
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const effectiveMode = isSidebar ? "mobile" : mode;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-[#0f0f0f]",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06]",
          isSidebar ? "px-3 py-2.5" : "px-4 py-3",
        )}
      >
        <p className="text-[11px] font-medium tracking-[-0.01em] text-white/50 sm:text-xs">
          {isSidebar
            ? "Aperçu mobile"
            : `Aperçu ${effectiveMode === "mobile" ? "mobile" : "desktop"}`}
        </p>
        {!isSidebar ? (
          <div
            className="flex items-center gap-0.5 rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-1"
            role="group"
            aria-label="Mode d’aperçu"
          >
            <button
              type="button"
              aria-pressed={mode === "mobile"}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
                "transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                mode === "mobile"
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/70",
              )}
              onClick={() => setMode("mobile")}
            >
              <Smartphone className="h-3.5 w-3.5" aria-hidden />
              Mobile
            </button>
            <button
              type="button"
              aria-pressed={mode === "desktop"}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium",
                "transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
                mode === "desktop"
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/70",
              )}
              onClick={() => setMode("desktop")}
            >
              <Monitor className="h-3.5 w-3.5" aria-hidden />
              Desktop
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-white/35">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#1f8a65]"
              aria-hidden
            />
            Live
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 items-start justify-center overflow-auto overscroll-contain",
          // Extra bottom padding so phone frame / content clear the coach NavDock
          isSidebar
            ? "p-3 pb-[calc(138px+20px)]"
            : "p-4 pb-[calc(138px+24px)] sm:p-6 sm:pb-[calc(138px+24px)]",
        )}
      >
        <div
          className={cn(
            "w-full overflow-hidden bg-[#0e0e0e]",
            effectiveMode === "mobile"
              ? cn(
                  "rounded-[28px] border border-white/[0.1]",
                  "outline outline-1 outline-white/[0.06] outline-offset-[-1px]",
                  "shadow-[0_12px_32px_rgba(0,0,0,0.45)]",
                  isSidebar ? "max-w-[360px]" : "max-w-[390px]",
                )
              : "max-w-[1000px] rounded-2xl border border-white/[0.08] shadow-[0_12px_28px_rgba(0,0,0,0.4)]",
          )}
        >
          {effectiveMode === "mobile" && (
            <div
              aria-hidden
              className="flex items-center justify-center border-b border-white/[0.06] bg-[#0a0a0a] py-2"
            >
              <div className="h-1.5 w-20 rounded-full bg-white/15" />
            </div>
          )}
          <div
            className={
              effectiveMode === "mobile"
                ? isSidebar
                  ? "max-h-[min(720px,calc(100dvh-88px-138px-80px))] overflow-y-auto overscroll-contain"
                  : "max-h-[min(760px,calc(100dvh-88px-138px-72px))] overflow-y-auto overscroll-contain"
                : "max-h-[min(820px,calc(100dvh-88px-138px-64px))] overflow-y-auto overscroll-contain"
            }
          >
            <CoachPageRenderer
              forceMobileLayout={effectiveMode === "mobile"}
              formulas={formulas}
              page={page}
              profile={profile}
              sections={sections}
              showFooter
            />
          </div>
        </div>
      </div>
    </div>
  );
}
