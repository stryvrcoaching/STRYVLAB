"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MetricChart from "./MetricChart";

interface MetricSeries {
  [fieldKey: string]: { date: string; value: number }[];
}

const TRACKED_FIELDS: {
  key: string;
  label: string;
  unit?: string;
  color?: string;
}[] = [
  { key: "weight_kg", label: "Poids", unit: "kg", color: "#0e8c5b" },
  { key: "body_fat_pct", label: "% Masse grasse", unit: "%", color: "#1A1A1A" },
  { key: "fat_mass_kg", label: "Masse grasse", unit: "kg", color: "#e05a5a" },
  {
    key: "muscle_mass_kg",
    label: "Masse musculaire",
    unit: "kg",
    color: "#2d9f6f",
  },
  { key: "muscle_mass_pct", label: "% Musculaire", unit: "%", color: "#3db87a" },
  { key: "body_water_pct", label: "% Hydrique", unit: "%", color: "#4db6e8" },
  { key: "bone_mass_kg", label: "Masse osseuse", unit: "kg", color: "#9b7cdb" },
  {
    key: "visceral_fat_level",
    label: "Graisse viscérale",
    unit: "",
    color: "#e08c3a",
  },
  { key: "bmi", label: "IMC", unit: "", color: "#6D6D6D" },
  {
    key: "bmr_kcal",
    label: "Métabolisme de base",
    unit: "kcal",
    color: "#d4a017",
  },
  { key: "waist_cm", label: "Tour de taille", unit: "cm", color: "#888888" },
  { key: "hips_cm", label: "Tour de hanches", unit: "cm", color: "#aaaaaa" },
  { key: "chest_cm", label: "Tour de poitrine", unit: "cm", color: "#cccccc" },
  { key: "arm_cm", label: "Tour de bras", unit: "cm", color: "#999999" },
  { key: "thigh_cm", label: "Tour de cuisse", unit: "cm", color: "#bbbbbb" },
  {
    key: "sleep_hours",
    label: "Heures de sommeil",
    unit: "h",
    color: "#7c9dd4",
  },
  { key: "energy_level", label: "Énergie", unit: "/10", color: "#f0a030" },
  { key: "stress_level", label: "Stress", unit: "/10", color: "#e05050" },
];

interface Props {
  clientId: string;
  refreshKey?: number;
}

export default function ClientMetricsDashboard({
  clientId,
  refreshKey = 0,
}: Props) {
  const [series, setSeries] = useState<MetricSeries>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSeries({});
    fetch(`/api/clients/${clientId}/metrics`)
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.series ?? {});
      })
      .catch(() => setSeries({}))
      .finally(() => setLoading(false));
  }, [clientId, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-[#181818] hover:bg-[#181818] transition-colors rounded-2xl p-4"
          >
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-40 w-full rounded-lg mb-3" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasData = TRACKED_FIELDS.some((f) => (series[f.key]?.length ?? 0) > 0);

  if (!hasData) {
    return (
      <div className="text-center py-12 text-white/60">
        <p className="font-semibold mb-1">Aucune donnée disponible</p>
        <p className="text-[11px] text-white/40">
          Les métriques apparaîtront après un import CSV ou un bilan complété
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {TRACKED_FIELDS.map((f) => {
        const data = series[f.key] ?? [];
        if (data.length === 0) return null;
        return (
          <div
            key={f.key}
            className="bg-white/[0.02] hover:bg-white/[0.025] transition-colors rounded-2xl p-4"
          >
            <MetricChart
              data={data}
              label={f.label}
              unit={f.unit}
              color={f.color}
            />
            <div className="mt-2 flex items-center justify-between text-[10px] text-white/60">
              <span>
                Dernière :{" "}
                <strong className="font-mono text-white">
                  {data[data.length - 1].value}
                  {f.unit ? ` ${f.unit}` : ""}
                </strong>
              </span>
              <span>
                {data.length} mesure{data.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
