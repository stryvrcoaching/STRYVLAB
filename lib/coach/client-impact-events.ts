export const CLIENT_IMPACT_EVENT = "stryvr:client-impact";

export type ClientImpactEventDetail = {
  clientId: string;
  kind: "nutrition-draft" | "workout-draft" | "refresh" | "clear-nutrition-draft" | "clear-workout-draft";
  nutrition?: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    tdee?: number | null;
  };
  workout?: {
    weeklyFrequency?: number | null;
    strengthFrequency?: number | null;
    cardioFrequency?: number | null;
    cardioDurationMin?: number | null;
    cardioTypes?: string[];
    cardioRpe?: number | null;
    sessionDurationMin?: number | null;
    trainingTypes?: string[];
    trainingRir?: number | null;
    setsWeekly?: number | null;
    repsWeekly?: number | null;
    restMinutesWeekly?: number | null;
  };
};

export function publishClientImpact(detail: ClientImpactEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ClientImpactEventDetail>(CLIENT_IMPACT_EVENT, { detail }));
}
