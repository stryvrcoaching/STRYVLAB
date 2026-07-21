"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock, MessageSquare } from "lucide-react";
import type {
  CockpitDirection,
  DirectionSeverity,
} from "@/lib/coach/cockpit-directions";

const DIRECTION_SEVERITY: Record<
  DirectionSeverity,
  { label: string; color: string; background: string; border: string }
> = {
  urgent: {
    label: "Priorité",
    color: "#fda4af",
    background: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.28)",
  },
  important: {
    label: "À traiter",
    color: "#f5c15d",
    background: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.28)",
  },
  info: {
    label: "Info",
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
  },
  ok: {
    label: "Stable",
    color: "#7fe0b8",
    background: "rgba(31,138,101,0.14)",
    border: "rgba(31,138,101,0.28)",
  },
};

export function CockpitDirectionsPanel({
  directions,
  compact = false,
  onMessage,
  onTreated,
  onSnooze,
}: {
  directions: CockpitDirection[];
  /** Smaller shell for profil Pilotage mirror */
  compact?: boolean;
  onMessage?: (direction: CockpitDirection) => void;
  onTreated?: (directionId: string) => void;
  onSnooze?: (directionId: string) => void;
}) {
  if (directions.length === 0) return null;
  const primary = directions[0];
  const secondary = directions.slice(1);
  const meta = DIRECTION_SEVERITY[primary.severity];

  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: meta.border, background: meta.background }}
    >
      <div className={`border-b border-white/[0.06] ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/50">
            Direction coach
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
            style={{ color: meta.color, backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            {meta.label}
          </span>
        </div>
        <h2
          className={`mt-1.5 font-semibold leading-snug text-white ${
            compact ? "text-[14px]" : "text-[15px]"
          }`}
        >
          {primary.title}
        </h2>
        <p className={`mt-1 leading-snug text-white/55 ${compact ? "text-[11px]" : "text-[11px]"}`}>
          {primary.why}
        </p>
        <p className={`mt-1.5 font-medium leading-snug text-white/85 ${compact ? "text-[12px]" : "text-[12px]"}`}>
          → {primary.action}
        </p>

        <div className={`mt-2.5 flex flex-wrap items-center gap-1.5 ${compact ? "" : "gap-2"}`}>
          <Link
            href={primary.href}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-[#1f8a65] px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-[#217356] ${
              compact ? "min-h-8" : "min-h-9 rounded-xl px-3"
            }`}
          >
            {primary.ctaLabel}
            <ArrowRight size={12} />
          </Link>

          {primary.clientMessage && onMessage && (
            <button
              type="button"
              onClick={() => onMessage(primary)}
              className={`inline-flex items-center gap-1.5 border border-white/[0.1] bg-black/20 text-[11px] font-bold text-white/80 transition-colors hover:bg-black/30 hover:text-white ${
                compact ? "min-h-8 rounded-lg px-2.5" : "min-h-9 rounded-xl px-3"
              }`}
            >
              <MessageSquare size={12} />
              Message
            </button>
          )}

          {primary.severity !== "ok" && onTreated && (
            <button
              type="button"
              onClick={() => onTreated(primary.id)}
              title="Masquer cette direction (traitée)"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-white/40 transition-colors hover:text-white/70"
            >
              <Check size={12} />
              Traité
            </button>
          )}
          {primary.severity !== "ok" && onSnooze && (
            <button
              type="button"
              onClick={() => onSnooze(primary.id)}
              title="Masquer 7 jours"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-white/40 transition-colors hover:text-white/70"
            >
              <Clock size={12} />
              7 j
            </button>
          )}
        </div>
      </div>

      {secondary.length > 0 && (
        <ul className="divide-y divide-white/[0.06]">
          {secondary.map((dir) => {
            const s = DIRECTION_SEVERITY[dir.severity];
            return (
              <li key={dir.id} className={compact ? "px-3 py-2" : "px-3.5 py-2.5"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white/90">
                      {dir.title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-white/45">
                      {dir.why}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Link
                      href={dir.href}
                      className="text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-white"
                      style={{ color: s.color }}
                    >
                      {dir.ctaLabel}
                    </Link>
                    {onTreated && dir.severity !== "ok" && (
                      <button
                        type="button"
                        onClick={() => onTreated(dir.id)}
                        className="text-[9px] text-white/30 hover:text-white/55"
                      >
                        Traité
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export { DIRECTION_SEVERITY };
