"use client";

import type { ReactNode } from "react";

export default function NutritionMetricSpotlight({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-[28px] font-semibold text-white">{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/52">{detail}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
