"use client";

import { useMemo, useState } from "react";
import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import SessionHistory from "@/components/clients/SessionHistory";
import PerformanceHub from "@/components/clients/PerformanceHub";
import ProgressionHistory from "@/components/clients/ProgressionHistory";

const WINDOWS = [7, 30, 90, 0] as const;

export default function PerformancesPage() {
  const { clientId } = useClient();
  const [dataVersion, setDataVersion] = useState(0);
  const [focusedSessionDate, setFocusedSessionDate] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [windowDays, setWindowDays] = useState<7 | 30 | 90 | 0>(30);

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
            {windowValue === 0 ? "Tout" : `${windowValue} j`}
          </button>
        ))}
      </div>
    ),
    [windowDays],
  );

  useClientTopBar("Performances", topBarRight);

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="space-y-6 px-4 pb-24 sm:px-6">
        <PerformanceHub
          clientId={clientId}
          period={windowDays}
          refreshKey={dataVersion}
          onFocusSessionDate={(date) => {
            setFocusedSessionDate(date);
            setFocusVersion((value) => value + 1);
          }}
        />
        <section className="rounded-2xl border border-white/[0.06] bg-[#181818] px-4 py-5 md:px-5">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Historique
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-white">
              Gestion des séances et brouillons
            </h2>
          </div>

          <div className="space-y-6">
            <SessionHistory
              clientId={clientId}
              focusedSessionDate={focusedSessionDate}
              focusVersion={focusVersion}
              onSessionsChanged={() => setDataVersion((v) => v + 1)}
            />
            <ProgressionHistory clientId={clientId} />
          </div>
        </section>
      </div>
    </main>
  );
}
