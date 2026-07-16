"use client";

import { cn } from "@/app/lib/utils";

export function SurfaceCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-[#09090a] border border-white/[0.04] relative overflow-hidden rounded-[24px] p-4", className)}>
      <div className="relative">{children}</div>
    </div>
  );
}
