"use client";

import { useState } from "react";
import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import SessionHistory from "@/components/clients/SessionHistory";
import PerformanceHub from "@/components/clients/PerformanceHub";
import ProgressionHistory from "@/components/clients/ProgressionHistory";

export default function PerformancesPage() {
  const { clientId } = useClient();
  useClientTopBar("Performances");
  const [dataVersion, setDataVersion] = useState(0);
  const [focusedSessionDate, setFocusedSessionDate] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 space-y-6">
        <PerformanceHub
          clientId={clientId}
          refreshKey={dataVersion}
          onFocusSessionDate={(date) => {
            setFocusedSessionDate(date);
            setFocusVersion((value) => value + 1);
          }}
        />
        <section className="rounded-2xl border border-white/[0.06] bg-[#181818] px-4 py-5 md:px-5">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
              Gestion & historique
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-white">
              Séances, brouillons et détails moteur
            </h2>
          </div>

          <div className="space-y-6">
            <SessionHistory
              clientId={clientId}
              focusedSessionDate={focusedSessionDate}
              focusVersion={focusVersion}
              onSessionsChanged={() => setDataVersion((v) => v + 1)}
            />
            <div className="border-t border-white/[0.06] pt-6">
              <ProgressionHistory clientId={clientId} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
