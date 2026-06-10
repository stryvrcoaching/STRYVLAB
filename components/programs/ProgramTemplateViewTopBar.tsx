"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";

interface ProgramTemplateViewTopBarProps {
  templateName?: string;
}

export default function ProgramTemplateViewTopBar({
  templateName,
}: ProgramTemplateViewTopBarProps) {
  const router = useRouter();

  const topBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push("/coach/programs/templates")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            Templates
          </p>
          <p className="text-[13px] font-semibold text-white leading-none truncate">
            Template — {templateName ?? "Détail"}
          </p>
        </div>
      </div>
    ),
    [router, templateName],
  );

  useSetTopBar(topBarLeft);

  return null;
}
