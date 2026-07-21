"use client";

import type { ReactNode } from "react";
import type { SectionPresentation } from "@/types/coach-page";
import { cn } from "@/lib/utils";

const spacingClasses = {
  compact: "px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10",
  regular: "px-4 py-7 sm:px-6 sm:py-14 lg:px-10 lg:py-18",
  generous: "px-4 py-10 sm:px-6 sm:py-16 lg:px-10 lg:py-24",
} as const;

export function SectionShell({
  id,
  label,
  title,
  description,
  children,
  className,
  narrow,
  wide,
  presentation,
}: {
  id?: string;
  label?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  /** Wider content column (formulas desktop) */
  wide?: boolean;
  /** Coach-controlled heading and layout shared by native sections. */
  presentation?: SectionPresentation;
}) {
  const eyebrow = presentation?.eyebrow ?? label;
  const heading = presentation?.title ?? title;
  const intro = presentation?.subtitle ?? description;
  const centered = narrow || presentation?.text_align === "center";
  const card = presentation?.surface_style === "card";

  return (
    <section
      className={cn(
        spacingClasses[presentation?.spacing ?? "regular"],
        className,
      )}
      id={id}
    >
      <div
        className={cn(
          "mx-auto w-full",
          narrow ? "max-w-xl" : wide ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        <div
          className={cn(
            card && "rounded-2xl border border-[color:var(--cp-border)] bg-[color:var(--cp-surface)] p-5 sm:p-7 lg:p-9",
          )}
        >
        {(eyebrow || heading || intro) && (
          <header
            className={cn(
              "mb-4 sm:mb-7 lg:mb-9",
              centered ? "text-center" : "",
            )}
          >
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--cp-accent)]/90 sm:text-xs sm:font-medium sm:normal-case sm:tracking-wide">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="mt-2 text-[1.65rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[color:var(--cp-text)] text-balance sm:text-3xl sm:leading-[1.08]">
                {heading}
              </h2>
            )}
            {intro && (
              <p className={cn("mt-2.5 max-w-xl text-[15px] leading-6 text-[color:var(--cp-text-muted)] text-pretty sm:mt-3 sm:text-sm sm:leading-6", centered && "mx-auto")}>
                {intro}
              </p>
            )}
          </header>
        )}
        {children}
        </div>
      </div>
    </section>
  );
}

export function AccentButton({
  href,
  children,
  className,
  external,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold text-[color:var(--cp-on-accent)] transition-[transform,opacity,background-color] duration-150 ease-out active:scale-[0.96] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--cp-bg)]",
        className,
      )}
      href={href}
      onClick={onClick}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      style={{ backgroundColor: "var(--cp-accent)" }}
    >
      {children}
    </a>
  );
}

export function GhostButton({
  href,
  children,
  className,
  external,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent)]",
        className,
      )}
      href={href}
      onClick={onClick}
      style={{
        borderColor: "var(--cp-border)",
        backgroundColor: "var(--cp-surface-2)",
        color: "var(--cp-text-muted)",
      }}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
    </a>
  );
}
