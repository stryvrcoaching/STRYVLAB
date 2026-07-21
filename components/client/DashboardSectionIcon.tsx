import type { ReactNode } from "react";

export const DASHBOARD_SIGNAL_COLORS = {
  neutral: "#a3a3a3",
  success: "#5dba87",
  warning: "#f2c94c",
  attention: "#ff8660",
  critical: "#ef5b5b",
} as const;

/** Shared visual anchor for the section headers on the client home screen. */
export function DashboardSectionIcon({
  children,
  color = DASHBOARD_SIGNAL_COLORS.neutral,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {children}
    </div>
  );
}
