"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

/** Shared error / success line for coach-page image uploads. */
export function UploadFeedback({
  error,
  status,
}: {
  error?: string | null;
  status?: string | null;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/[0.08] px-3 py-2.5 text-[12px] leading-snug text-red-300"
      >
        <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span className="text-pretty">{error}</span>
      </div>
    );
  }
  if (status) {
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 text-[12px] font-semibold text-[#7fe2bf]"
      >
        <CheckCircle2 size={13} className="shrink-0" aria-hidden />
        {status}
      </p>
    );
  }
  return null;
}

export const coachPageHintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "rgba(255,255,255,0.4)",
  margin: "6px 0 0",
  lineHeight: 1.45,
};
