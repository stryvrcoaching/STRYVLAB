type MetricField =
  | "weight_kg"
  | "sleep_duration_h"
  | "sleep_quality"
  | "energy_level"
  | "stress_level";

type MetricSource = "assessment" | "checkin";

export type LatestMetricValue = {
  value: number;
  source: MetricSource;
  measuredAt: string;
};

const CHECKIN_TO_FIELD: Partial<Record<string, MetricField>> = {
  weight_kg: "weight_kg",
  sleep_hours: "sleep_duration_h",
  sleep_quality: "sleep_quality",
  energy_level: "energy_level",
  stress_level: "stress_level",
};

function toIsoFromCheckinDate(date: string): string {
  return `${date}T12:00:00.000Z`;
}

export async function getLatestClientMetrics(
  db: any,
  clientId: string,
  fields: MetricField[],
): Promise<Partial<Record<MetricField, LatestMetricValue>>> {
  const out: Partial<Record<MetricField, LatestMetricValue>> = {};
  const fieldSet = new Set(fields);

  const [submissionsRes, checkinsRes] = await Promise.all([
    db
      .from("assessment_submissions")
      .select(
        "submitted_at, bilan_date, assessment_responses(field_key, value_number)",
      )
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("submitted_at", { ascending: false })
      .limit(60),
    db
      .from("client_daily_checkins")
      .select("date, weight_kg, sleep_hours, sleep_quality, energy_level, stress_level")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const submissions = (submissionsRes.data ?? []) as any[];
  for (const sub of submissions) {
    const measuredAt = sub.submitted_at ?? toIsoFromCheckinDate(sub.bilan_date ?? "");
    const responses = (sub.assessment_responses ?? []) as {
      field_key: string;
      value_number: number | null;
    }[];
    for (const r of responses) {
      const key = r.field_key as MetricField;
      if (!fieldSet.has(key)) continue;
      if (r.value_number == null) continue;
      if (!out[key]) {
        out[key] = {
          value: Number(r.value_number),
          source: "assessment",
          measuredAt,
        };
      }
    }
  }

  const checkins = (checkinsRes.data ?? []) as any[];
  for (const c of checkins) {
    const measuredAt = toIsoFromCheckinDate(String(c.date));
    for (const [checkinKey, metricField] of Object.entries(CHECKIN_TO_FIELD)) {
      if (!metricField || !fieldSet.has(metricField)) continue;
      const raw = c[checkinKey];
      if (raw == null) continue;
      if (!out[metricField] || measuredAt >= out[metricField]!.measuredAt) {
        out[metricField] = {
          value: Number(raw),
          source: "checkin",
          measuredAt,
        };
      }
    }
  }

  return out;
}

