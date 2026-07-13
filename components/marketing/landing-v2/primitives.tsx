"use client";

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { DEMO_URL } from "./content";
import { trackLandingV2Event, type LandingV2Event } from "./events";

export function Brand() {
  return (
    <span className="[font-family:var(--font-unbounded)] text-[11px] font-semibold tracking-[-0.08em] text-white sm:text-[12px]">
      STRYVLAB
    </span>
  );
}

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c6b48b] ${className}`}
    >
      {children}
    </p>
  );
}

export function PrimaryCta({
  children = "Réserver une démonstration",
  compact = false,
  eventName,
}: {
  children?: ReactNode;
  compact?: boolean;
  eventName?: LandingV2Event;
}) {
  return (
    <a
      href={DEMO_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => eventName && trackLandingV2Event(eventName)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f3f6f4] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-[#0d0d0d] transition duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6b48b] ${compact ? "px-4 text-[10px]" : "px-5 text-[11px]"}`}
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

export function SecondaryCta({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 font-barlow-condensed text-[11px] font-semibold uppercase tracking-[0.14em] text-white/84 transition duration-200 hover:border-white/55 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86aeb8]"
    >
      {children}
    </a>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-4xl ${className}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-5 font-barlow text-[clamp(2.25rem,4.8vw,4.65rem)] font-semibold uppercase leading-[0.9] tracking-[-0.055em] text-white">
        {title}
      </h2>
      {children && (
        <p className="mt-6 max-w-2xl text-[16px] leading-8 text-white/68 sm:text-[17px]">
          {children}
        </p>
      )}
    </div>
  );
}
