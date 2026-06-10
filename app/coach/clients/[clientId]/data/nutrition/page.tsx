"use client";

import NutritionHub from "@/components/clients/NutritionHub";
import { useClientTopBar } from "@/components/clients/useClientTopBar";
import { useClient } from "@/lib/client-context";

export default function NutritionDataPage() {
  const { clientId } = useClient();

  useClientTopBar("Nutrition");

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 space-y-6">
        <NutritionHub clientId={clientId} />
      </div>
    </main>
  );
}
