"use client";

import { useEffect } from "react";

type LiquidGlassController = {
  destroy: () => void;
};

type LiquidGlassFactory = (
  element: Element,
  options: {
    scale: number;
    chroma: number;
    blur: number;
    saturate: number;
    fallbackBlur: number;
  },
) => LiquidGlassController;

export default function LiquidGlassEffect({ targetId }: { targetId: string }) {
  useEffect(() => {
    let cancelled = false;
    let controller: LiquidGlassController | undefined;
    const target = document.getElementById(targetId);

    if (!target) return;

    if (window.matchMedia("(max-width: 639px)").matches) {
      const mobileGlass = "blur(14px) saturate(1)";
      (target as HTMLElement).style.backdropFilter = mobileGlass;
      (target as HTMLElement).style.webkitBackdropFilter = mobileGlass;
      target.classList.add("lg-fallback");

      return () => {
        (target as HTMLElement).style.backdropFilter = "";
        (target as HTMLElement).style.webkitBackdropFilter = "";
        target.classList.remove("lg-fallback");
      };
    }

    void import("../../.codex/skills/liquid-glass/assets/liquid-glass.js").then(() => {
      if (cancelled) return;

      const liquidGlass = (window as Window & { liquidGlass?: LiquidGlassFactory }).liquidGlass;

      if (!liquidGlass) return;

      controller = liquidGlass(target, {
        scale: -35,
        chroma: 1,
        blur: 3,
        saturate: 1,
        fallbackBlur: 14,
      });
    });

    return () => {
      cancelled = true;
      controller?.destroy();
    };
  }, [targetId]);

  return null;
}
