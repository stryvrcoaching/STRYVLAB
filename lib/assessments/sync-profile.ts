import { SupabaseClient } from "@supabase/supabase-js";
import { AssessmentResponse } from "@/types/assessment";

// Maps bilan primary_goal options → coach_clients.training_goal enum
const GOAL_MAP: Record<string, string> = {
  "perte de gras": "fat_loss",
  "prise de muscle": "hypertrophy",
  "recomposition corporelle": "recomp",
  "amélioration des performances": "athletic",
  "santé & bien-être général": "maintenance",
  "préparation compétition": "athletic",
  "rééducation / retour à l'activité": "maintenance",
};

// Maps bilan experience_level options → coach_clients.fitness_level enum
const LEVEL_MAP: Record<string, string> = {
  débutant: "beginner",
  intermédiaire: "intermediate",
  avancé: "advanced",
  expert: "elite",
};

// Full gym set — all equipment slugs recognized by the scoring engine (FR), excluding bodyweight (always available)
const FULL_GYM_EQUIPMENT = [
  "barre",
  "halteres",
  "machine",
  "poulie",
  "cables",
  "kettlebell",
  "smith",
  "trx",
  "elastiques",
];

// Maps bilan equipment_preference → coach_clients.equipment[] values (FR slugs expected by scoring engine)
// Note: 'poulie' and 'cables' both added when cables equipment is available (engine aliases them via expandProfileEquipment)
// Note: 'bodyweight' never stored — scoring engine always considers it available regardless
const EQUIPMENT_PREFERENCE_MAP: Record<string, string[]> = {
  "machines guidées": ["machine", "poulie", "cables"],
  "barres & haltères libres": ["barre", "halteres", "kettlebell"],
  "mixte (machines + libres)": FULL_GYM_EQUIPMENT,
  "poids de corps / calisthenics": ["elastiques"],
  "élastiques / câbles": ["elastiques", "poulie", "cables"],
  "pas de préférence": [],
};

function mapGoal(raw: string): string | null {
  const key = raw.toLowerCase().trim();
  return GOAL_MAP[key] ?? null;
}

function mapLevel(raw: string): string | null {
  const key = raw.toLowerCase().trim();
  // Partial match: "Débutant (< 1 an)" → "débutant"
  for (const [prefix, val] of Object.entries(LEVEL_MAP)) {
    if (key.startsWith(prefix)) return val;
  }
  return null;
}

export async function syncProfileFromResponses(
  db: SupabaseClient,
  clientId: string,
  coachId: string,
  responses: AssessmentResponse[],
  bilanDate: string, // YYYY-MM-DD
) {
  const profileUpdate: Record<string, unknown> = {};

  // Already handled upstream (gender, date_of_birth) — kept here for completeness
  for (const r of responses) {
    const key = r.field_key;
    const text = r.value_text ?? "";

    // gender
    if (["sexe", "gender", "genre"].includes(key) && text) {
      const v = text.toLowerCase();
      const mapped =
        v === "homme" || v === "male" || v === "m"
          ? "male"
          : v === "femme" || v === "female" || v === "f"
            ? "female"
            : v === "other" || v === "autre"
              ? "other"
              : null;
      if (mapped) profileUpdate["gender"] = mapped;
    }

    // date_of_birth
    if (
      ["birth_date", "date_naissance", "date_of_birth"].includes(key) &&
      text
    ) {
      profileUpdate["date_of_birth"] = text;
    }

    // P1 — primary_goal → training_goal
    if (key === "primary_goal" && text) {
      const mapped = mapGoal(text);
      if (mapped) profileUpdate["training_goal"] = mapped;
    }

    // P1 — experience_level → fitness_level
    if (key === "experience_level" && text) {
      const mapped = mapLevel(text);
      if (mapped) profileUpdate["fitness_level"] = mapped;
    }

    // P2 — equipment_preference → equipment[]
    if (key === "equipment_preference" && text) {
      const mapped = EQUIPMENT_PREFERENCE_MAP[text.toLowerCase().trim()];
      if (mapped !== undefined && mapped.length > 0) {
        profileUpdate["equipment"] = mapped;
      }
    }

    // P2 — training_frequency → weekly_frequency (number, clamp 1–7)
    if (key === "training_frequency" && r.value_number != null) {
      const freq = Math.min(7, Math.max(1, Math.round(r.value_number)));
      profileUpdate["weekly_frequency"] = freq;
    }
  }

  if (Object.keys(profileUpdate).length > 0) {
    await db.from("coach_clients").update(profileUpdate).eq("id", clientId);
  }

  // P1 — injuries_active / injuries_history → metric_annotations (type='injury')
  const injuryFields = ["injuries_active", "injuries_history"] as const;
  for (const field of injuryFields) {
    const r = responses.find((x) => x.field_key === field);
    if (!r?.value_text?.trim()) continue;

    // Check if annotation already exists for this submission+field (idempotent)
    const { data: existing } = await db
      .from("metric_annotations")
      .select("id")
      .eq("client_id", clientId)
      .eq("event_type", "injury")
      .eq("body", r.value_text.trim())
      .maybeSingle();

    if (existing) continue;

    const label =
      field === "injuries_active"
        ? "Blessures actuelles (bilan)"
        : "Antécédents de blessures (bilan)";

    await db.from("metric_annotations").insert({
      client_id: clientId,
      coach_id: coachId,
      event_type: "injury",
      event_date: bilanDate,
      label,
      body: r.value_text.trim(),
      severity: field === "injuries_active" ? "monitor" : null,
    });
  }
}
