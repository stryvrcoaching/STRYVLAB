"use client";

import { useEffect, useState } from "react";

export type NutritionRealityPayload = {
  summary: {
    adherenceCalories: number | null;
    adherenceProtein: number | null;
    adherenceCarbs: number | null;
    adherenceFat: number | null;
    adherenceHydration: number | null;
    achievedCalories: number | null;
    achievedProtein: number | null;
    achievedCarbs: number | null;
    achievedFat: number | null;
    achievedHydration: number | null;
    nutritionScore: number | null;
    validDays: number;
  };
  trend: {
    window: 3 | 7 | 14 | 30;
    points: Array<{
      date: string;
      dayKind?: "training" | "off" | "unknown";
      consumed: {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        hydration_ml: number;
      };
      target: {
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        hydration_ml: number | null;
      };
    }>;
  };
  insights: Array<{
    id: string;
    severity: "good" | "watch" | "alert";
    title: string;
    message: string;
  }>;
  agenda: Array<{
    date: string;
    dayKind: "training" | "off" | "unknown";
    status: string;
    mealCount: number;
    consumed: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      hydration_ml: number;
    };
    target: {
      calories: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      hydration_ml: number | null;
    };
  }>;
  dataQuality: {
    validDays: number;
    partialDays: number;
    missingMealDays: number;
    missingHydrationDays: number;
  };
  availableWindows: number[];
};

export type NutritionRealityView = {
  summary: NutritionRealityPayload["summary"];
  trendPoints: NutritionRealityPayload["trend"]["points"];
  topInsights: NutritionRealityPayload["insights"];
  recentDays: NutritionRealityPayload["agenda"];
  availableWindows: Array<3 | 7>;
};

export function deriveNutritionRealityView(
  payload: NutritionRealityPayload,
): NutritionRealityView {
  return {
    summary: payload.summary,
    trendPoints: payload.trend.points,
    topInsights: payload.insights.slice(0, 3),
    recentDays: payload.agenda.slice(-3).reverse(),
    availableWindows: payload.availableWindows.filter(
      (value): value is 3 | 7 => value === 3 || value === 7,
    ),
  };
}

export function useNutritionReality(clientId: string, windowDays: 3 | 7) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NutritionRealityPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/clients/${clientId}/nutrition-hub?window=${windowDays}`,
        );
        const json = await response.json();
        if (!active) return;

        if (!response.ok) {
          setError(json?.error ?? "Erreur serveur");
          setPayload(null);
          return;
        }

        setPayload(json);
      } catch {
        if (!active) return;
        setError("Erreur réseau");
        setPayload(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [clientId, windowDays]);

  return {
    loading,
    error,
    payload,
    view: payload ? deriveNutritionRealityView(payload) : null,
  };
}
