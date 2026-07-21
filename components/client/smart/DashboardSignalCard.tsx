"use client";

import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { SurfaceCard } from "@/components/client/smart/SurfaceCard";

export type SignalTone = "success" | "warning" | "attention" | "info" | "neutral";

const TONE: Record<
  SignalTone,
  { icon: string; badge: string; badgeText: string }
> = {
  success: {
    icon: "text-[#5dba87]",
    badge: "bg-[#5dba87]/10",
    badgeText: "text-[#5dba87]",
  },
  warning: {
    icon: "text-[#f2c94c]",
    badge: "bg-[#f2c94c]/10",
    badgeText: "text-[#f2c94c]",
  },
  attention: {
    icon: "text-[#ff8660]",
    badge: "bg-[#ff8660]/10",
    badgeText: "text-[#ff8660]",
  },
  info: {
    icon: "text-[#7aa7ff]",
    badge: "bg-[#7aa7ff]/10",
    badgeText: "text-[#7aa7ff]",
  },
  neutral: {
    icon: "text-white/55",
    badge: "bg-white/[0.04]",
    badgeText: "text-white/50",
  },
};

type Props = {
  eyebrow?: string;
  title: string;
  body?: string | null;
  label?: string;
  icon: ElementType;
  tone?: SignalTone;
  href?: string;
  onClick?: () => void;
  onDismiss?: () => void;
  className?: string;
  children?: ReactNode;
};

export function DashboardSignalCard({
  eyebrow,
  title,
  body,
  label,
  icon: Icon,
  tone = "neutral",
  href,
  onClick,
  onDismiss,
  className,
  children,
}: Props) {
  const styles = TONE[tone];

  const inner = (
    <SurfaceCard
      className={cn(
        "p-4 active:scale-[0.99] transition-transform",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.03]">
          <Icon size={17} className={styles.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {eyebrow && (
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {eyebrow}
                </p>
              )}
              <p className={cn("text-[14px] font-medium leading-snug text-white", eyebrow && "mt-1")}>
                {title}
              </p>
              {body && (
                <p className="mt-1 text-[12px] leading-relaxed text-white/45 text-pretty">
                  {body}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {label && (
                <span
                  className={cn(
                    "rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    styles.badge,
                    styles.badgeText,
                  )}
                >
                  {label}
                </span>
              )}
              {(href || onClick) && !onDismiss && (
                <ChevronRight size={14} className="text-white/25" />
              )}
              {onDismiss && (
                <button
                  aria-label="Fermer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 transition-colors hover:text-white/70"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDismiss();
                  }}
                  type="button"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          {children}
        </div>
      </div>
    </SurfaceCard>
  );

  if (href) {
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    if (isExternal) {
      return (
        <a
          className="block w-full"
          href={href}
          onClick={onClick}
          rel="noopener noreferrer"
          target="_blank"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link className="block w-full" href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button className="block w-full text-left" onClick={onClick} type="button">
        {inner}
      </button>
    );
  }

  return inner;
}
