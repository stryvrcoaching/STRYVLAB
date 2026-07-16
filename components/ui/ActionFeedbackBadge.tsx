"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

export type ActionFeedbackTone = "loading" | "success" | "error";

interface ActionFeedbackBadgeProps {
  tone: ActionFeedbackTone;
  message: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_STYLES = {
  sm: {
    container: "gap-1.5 px-2.5 py-1 text-[10px]",
    icon: 12,
  },
  md: {
    container: "gap-1.5 px-2.5 py-1 text-[11px]",
    icon: 13,
  },
} as const;

export default function ActionFeedbackBadge({
  tone,
  message,
  size = "sm",
  className = "",
}: ActionFeedbackBadgeProps) {
  const styles = SIZE_STYLES[size];
  const toneClassName =
    tone === "success"
      ? "border-[#1f8a65]/25 bg-[#1f8a65]/10 text-[#7fe2bf]"
      : tone === "loading"
        ? "border-white/10 bg-white/[0.05] text-white/75"
        : "border-red-500/25 bg-red-500/10 text-red-300";

  return (
    <div
      aria-live="polite"
      className={`flex items-center rounded-lg border font-medium ${styles.container} ${toneClassName} ${className}`.trim()}
    >
      {tone === "loading" ? (
        <Loader2 size={styles.icon} className="animate-spin" />
      ) : tone === "error" ? (
        <CircleAlert size={styles.icon} />
      ) : (
        <CheckCircle2 size={styles.icon} />
      )}
      {message}
    </div>
  );
}
