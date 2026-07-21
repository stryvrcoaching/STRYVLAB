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
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-[#181818] p-4",
        className,
      )}
    >
      <div className="relative">{children}</div>
    </div>
  );
}
