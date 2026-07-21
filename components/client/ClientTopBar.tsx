"use client";

import type { ReactNode } from "react";
import HeaderIconLink from "@/components/layout/HeaderIconLink";
import { ChevronLeft } from "lucide-react";
import { useClientT } from "@/components/client/ClientI18nProvider";
import { cn } from "@/app/lib/utils";

export interface ClientTopBarProps {
  /**
   * Title mode — single human-readable title (sentence case).
   * Prefer this over stacking a section eyebrow.
   */
  title?: string;
  /** Optional back control (title mode). */
  backHref?: string;
  /**
   * Tabs / custom left cluster. When set, replaces the title block
   * (Programme, Nutrition segmented controls).
   */
  left?: ReactNode;
  /** Trailing actions (avatar, gear, cycle arc, counts…). */
  right?: ReactNode;
  className?: string;
  /**
   * @deprecated No longer rendered. Pass a single `title` instead.
   */
  section?: string;
}

/**
 * Fixed client chrome header.
 * - Same surface as pages (`--client-page-bg` / near-black gray).
 * - Height + safe-area tokenized via `--client-top-bar-*`.
 * - Two layouts: title (+ optional back) or custom `left` (tabs).
 */
export default function ClientTopBar({
  left,
  title,
  backHref,
  right,
  className,
}: ClientTopBarProps) {
  const { t } = useClientT();

  return (
    <header
      className={cn(
        // No border under status bar — one continuous chrome band with the system status area
        "fixed inset-x-0 top-0 z-40 bg-[var(--client-chrome-bg,#0a0a0a)]",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-2 px-3"
        style={{ height: "var(--client-top-bar-height)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {left ?? (
            <>
              {backHref ? (
                <HeaderIconLink
                  href={backHref}
                  icon={<ChevronLeft size={16} />}
                  label={t("common.back")}
                  className="h-9 w-9 shrink-0 rounded-xl border-white/[0.06] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                />
              ) : null}
              {title ? (
                <h1 className="min-w-0 truncate text-[17px] font-semibold leading-tight tracking-[-0.02em] text-white">
                  {title}
                </h1>
              ) : null}
            </>
          )}
        </div>

        {right ? (
          <div className="flex max-w-[46%] shrink-0 items-center justify-end gap-2">
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
