"use client";

import NutritionHubSkeleton from "@/components/clients/nutrition-hub/NutritionHubSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="space-y-6 px-6 pb-24">
        <NutritionHubSkeleton />
      </div>
    </main>
  );
}
