"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ListChecks,
} from "lucide-react";
import type { ReadinessItem } from "@/lib/coach-page/publish-readiness";
import { cn } from "@/lib/utils";

export function PublishChecklist({
  items,
  canPublish,
}: {
  items: ReadinessItem[];
  canPublish: boolean;
}) {
  // Collapsed by default — frees space for Sections / Apparence above
  const [open, setOpen] = useState(false);
  const doneCount = items.filter((i) => i.done).length;
  const requiredLeft = items.filter((i) => i.required && !i.done).length;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0a0a0a] p-3.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg text-left transition-colors duration-150 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.99]"
      >
        <span className="inline-flex min-w-0 items-center gap-2 text-[11px] font-semibold text-white/50">
          <ListChecks
            className="h-3.5 w-3.5 shrink-0 text-[#1f8a65]"
            aria-hidden
          />
          <span className="truncate">Prêt à publier</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              canPublish ? "text-[#8ef0c7]" : "text-white/35",
            )}
          >
            {doneCount}/{items.length}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/35">
            {open ? "Masquer" : "Afficher"}
            {open ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </span>
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          <div
            className="h-1 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label="Progression checklist"
          >
            <div
              className="h-full rounded-full bg-[#1f8a65] transition-[width] duration-200 ease-out"
              style={{
                width: `${items.length ? (doneCount / items.length) * 100 : 0}%`,
              }}
            />
          </div>

          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li className="flex items-start gap-2 text-xs" key={item.id}>
                {item.done ? (
                  <Check
                    aria-hidden
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1f8a65]"
                  />
                ) : (
                  <Circle
                    aria-hidden
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/20"
                  />
                )}
                <span
                  className={cn(
                    "leading-snug",
                    item.done
                      ? "text-white/50"
                      : item.required
                        ? "text-white/75"
                        : "text-white/40",
                  )}
                >
                  {item.label}
                  {!item.required && !item.done ? (
                    <span className="text-white/25"> · optionnel</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {!canPublish ? (
            <p className="mt-3 text-[11px] leading-4 text-white/40 text-pretty">
              {requiredLeft > 0
                ? `${requiredLeft} élément${requiredLeft > 1 ? "s" : ""} requis restant${requiredLeft > 1 ? "s" : ""} pour publier.`
                : "Complétez les éléments requis pour publier une page crédible."}
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-4 text-[#8ef0c7]/90">
              Checklist complète — tu peux publier.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
