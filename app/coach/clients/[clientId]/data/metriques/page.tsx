"use client";

import { useClient } from "@/lib/client-context";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import MetricsSection from "@/components/clients/MetricsSection";

export default function MetriquesPage() {
  const { clientId, client } = useClient();
  useClientTopBar("Métriques");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">
        <MetricsSection
          clientId={clientId}
          clientGender={client.gender}
          clientDateOfBirth={client.date_of_birth}
        />
      </div>
    </main>
  );
}
