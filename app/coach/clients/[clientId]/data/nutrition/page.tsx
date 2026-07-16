"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NutritionHub from "@/components/clients/NutritionHub";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import { useClient } from "@/lib/client-context";

const WINDOWS = [3, 7, 14, 30] as const;

export default function NutritionDataPage() {
  const { clientId } = useClient();
  const searchParams = useSearchParams();
  const focusDate = searchParams.get("focusDate")?.trim() || null;
  const [windowDays, setWindowDays] = useState<3 | 7 | 14 | 30>(focusDate ? 30 : 14);

  const topBarRight = useMemo(
    () => (
      <div className="flex gap-1 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
        {WINDOWS.map((windowValue) => (
          <button
            key={windowValue}
            type="button"
            onClick={() => setWindowDays(windowValue)}
            className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all ${
              windowDays === windowValue
                ? "bg-white text-black"
                : "text-white/55 hover:text-white"
            }`}
          >
            {windowValue} j
          </button>
        ))}
      </div>
    ),
    [windowDays],
  );

  useClientTopBar("Nutrition", topBarRight);

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 space-y-6">
        <NutritionHub clientId={clientId} windowDays={windowDays} focusDate={focusDate} />
      </div>
    </main>
  );
}
