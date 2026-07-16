import type { SupabaseClient } from "@supabase/supabase-js";
import type { TdeeEstimationStatus } from "@/lib/nutrition/tdee-quality";

export type TdeeConfidence = "high" | "medium" | "low";
export type TdeeSource = "weight_delta" | "formula_proxy";
export type TdeeStabilityStatus = "stable" | "watch" | "action";
export type TdeeUpdateOutcome = "initialized" | "noise" | "watch" | "promoted";

export interface ClientTdeeStateRow {
  client_id: string;
  current_tdee: number | null;
  current_tdee_at: string | null;
  latest_observed_tdee: number | null;
  latest_observed_at: string | null;
  confidence: TdeeConfidence | null;
  confidence_score: number | null;
  confidence_reasons: string[] | null;
  source: TdeeSource | null;
  method_version: string;
  stability_status: TdeeStabilityStatus;
  pending_direction: "up" | "down" | null;
  pending_delta_kcal: number | null;
  pending_streak: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_skip_at: string | null;
  last_skip_reason: string | null;
  last_error_at: string | null;
  last_error: string | null;
  window_days: number | null;
  tracked_days: number | null;
  weight_samples: number | null;
  excluded_current_day: boolean;
  anchored_to_protocol: boolean;
  smoothed_weight_used: boolean;
  applied_luteal_correction: boolean;
  estimation_status: TdeeEstimationStatus;
  data_quality_score: number | null;
  data_quality_reasons: string[] | null;
  auto_enabled: boolean;
  current_tdee_lower: number | null;
  current_tdee_upper: number | null;
  latest_observed_lower: number | null;
  latest_observed_upper: number | null;
  actionable_streak: number;
  context_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TdeeObservationPayload {
  protocolId: string;
  clientId: string;
  calculatedAt: string;
  tdeeFormula: number;
  tdeeAdaptive: number;
  deltaKcal: number;
  weightSamples: number;
  caloriesSource: "logs" | "protocol";
  avgIntakeKcal: number;
  weightDeltaKg: number;
  protocolUpdated: boolean;
  confidence: TdeeConfidence;
  confidenceScore: number;
  confidenceReasons: string[];
  windowDays: number;
  trackedDays: number;
  excludedCurrentDay: boolean;
  anchoredToProtocol: boolean;
  smoothedWeightUsed: boolean;
  appliedLutealCorrection: boolean;
  estimationStatus: TdeeEstimationStatus;
  dataQualityScore: number;
  dataQualityReasons: string[];
  tdeeLower: number;
  tdeeUpper: number;
  completeDays: number;
  contextChanged: boolean;
}

const METHOD_VERSION = "adaptive_tdee_v4";
const NOISE_THRESHOLD_KCAL = 50;
const WATCH_THRESHOLD_KCAL = 75;
const PROMOTION_THRESHOLD_KCAL = 100;
const IMMEDIATE_PROMOTION_THRESHOLD_KCAL = 150;

function roundTo10(value: number) {
  return Math.round(value / 10) * 10;
}

function resolveDirection(deltaKcal: number): "up" | "down" | null {
  if (deltaKcal > 0) return "up";
  if (deltaKcal < 0) return "down";
  return null;
}

function smoothPromotedTdee(previousStable: number, observedTdee: number, confidenceScore: number) {
  const alpha = Math.abs(observedTdee - previousStable) >= IMMEDIATE_PROMOTION_THRESHOLD_KCAL && confidenceScore >= 90
    ? 0.45
    : 0.35;
  let next = roundTo10(previousStable + (observedTdee - previousStable) * alpha);
  if (next === previousStable && observedTdee !== previousStable) {
    next = previousStable + (observedTdee > previousStable ? 10 : -10);
  }
  return roundTo10(next);
}

export function evaluateClientTdeeTransition(
  previousState: ClientTdeeStateRow | null,
  observation: Pick<TdeeObservationPayload, "tdeeAdaptive" | "confidenceScore">,
) {
  const previousStable = previousState?.current_tdee ?? null;
  const observedTdee = roundTo10(observation.tdeeAdaptive);

  if (previousStable == null) {
    return {
      currentTdee: observedTdee,
      stabilityStatus: "stable" as TdeeStabilityStatus,
      pendingDirection: null,
      pendingDeltaKcal: null,
      pendingStreak: 0,
      updateOutcome: "initialized" as TdeeUpdateOutcome,
    };
  }

  const deltaKcal = observedTdee - previousStable;
  const absDelta = Math.abs(deltaKcal);
  const direction = resolveDirection(deltaKcal);
  const sameDirection = direction !== null && direction === previousState?.pending_direction;
  const pendingStreak = direction == null
    ? 0
    : sameDirection
      ? (previousState?.pending_streak ?? 0) + 1
      : 1;

  if (absDelta < NOISE_THRESHOLD_KCAL) {
    return {
      currentTdee: previousStable,
      stabilityStatus: "stable" as TdeeStabilityStatus,
      pendingDirection: null,
      pendingDeltaKcal: null,
      pendingStreak: 0,
      updateOutcome: "noise" as TdeeUpdateOutcome,
    };
  }

  const shouldPromoteImmediately =
    absDelta >= IMMEDIATE_PROMOTION_THRESHOLD_KCAL && observation.confidenceScore >= 90;
  const shouldPromoteConfirmed =
    (absDelta >= PROMOTION_THRESHOLD_KCAL && pendingStreak >= 2) ||
    (absDelta >= WATCH_THRESHOLD_KCAL && pendingStreak >= 3);

  if (shouldPromoteImmediately || shouldPromoteConfirmed) {
    return {
      currentTdee: smoothPromotedTdee(previousStable, observedTdee, observation.confidenceScore),
      stabilityStatus: "action" as TdeeStabilityStatus,
      pendingDirection: direction,
      pendingDeltaKcal: deltaKcal,
      pendingStreak,
      updateOutcome: "promoted" as TdeeUpdateOutcome,
    };
  }

  return {
    currentTdee: previousStable,
    stabilityStatus: "watch" as TdeeStabilityStatus,
    pendingDirection: direction,
    pendingDeltaKcal: deltaKcal,
    pendingStreak,
    updateOutcome: "watch" as TdeeUpdateOutcome,
  };
}

export function evaluateTdeeObservationTransition(
  previousState: ClientTdeeStateRow | null,
  observation: Pick<TdeeObservationPayload, "tdeeAdaptive" | "confidenceScore" | "estimationStatus">,
) {
  const needsSecondActionableWindow =
    previousState?.current_tdee == null && (previousState?.actionable_streak ?? 0) < 1;
  if (observation.estimationStatus !== "actionable" || needsSecondActionableWindow) {
    return {
      currentTdee: previousState?.current_tdee ?? null,
      stabilityStatus: previousState?.stability_status ?? "stable" as TdeeStabilityStatus,
      pendingDirection: previousState?.pending_direction ?? null,
      pendingDeltaKcal: previousState?.pending_delta_kcal ?? null,
      pendingStreak: previousState?.pending_streak ?? 0,
      updateOutcome: "noise" as TdeeUpdateOutcome,
    };
  }

  return evaluateClientTdeeTransition(previousState, observation);
}

export function hasCurrentTdeeSkip(state: ClientTdeeStateRow | null) {
  if (!state?.last_skip_reason || !state.last_skip_at) return false;
  if (!state.last_success_at) return true;

  return new Date(state.last_skip_at).getTime() >= new Date(state.last_success_at).getTime();
}

export async function fetchClientTdeeState(
  db: SupabaseClient,
  clientId: string,
): Promise<ClientTdeeStateRow | null> {
  const { data } = await db
    .from("client_tdee_state")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  return (data as ClientTdeeStateRow | null) ?? null;
}

export async function markClientTdeeAttempt(
  db: SupabaseClient,
  clientId: string,
  at: string = new Date().toISOString(),
) {
  const previous = await fetchClientTdeeState(db, clientId);
  const payload = {
    client_id: clientId,
    last_attempt_at: at,
    current_tdee: previous?.current_tdee ?? null,
    current_tdee_at: previous?.current_tdee_at ?? null,
    latest_observed_tdee: previous?.latest_observed_tdee ?? null,
    latest_observed_at: previous?.latest_observed_at ?? null,
    confidence: previous?.confidence ?? null,
    confidence_score: previous?.confidence_score ?? null,
    confidence_reasons: previous?.confidence_reasons ?? [],
    source: previous?.source ?? null,
    method_version: previous?.method_version ?? METHOD_VERSION,
    stability_status: previous?.stability_status ?? "stable",
    pending_direction: previous?.pending_direction ?? null,
    pending_delta_kcal: previous?.pending_delta_kcal ?? null,
    pending_streak: previous?.pending_streak ?? 0,
    last_success_at: previous?.last_success_at ?? null,
    last_skip_at: previous?.last_skip_at ?? null,
    last_skip_reason: previous?.last_skip_reason ?? null,
    last_error_at: previous?.last_error_at ?? null,
    last_error: previous?.last_error ?? null,
    window_days: previous?.window_days ?? null,
    tracked_days: previous?.tracked_days ?? null,
    weight_samples: previous?.weight_samples ?? null,
    excluded_current_day: previous?.excluded_current_day ?? true,
    anchored_to_protocol: previous?.anchored_to_protocol ?? false,
    smoothed_weight_used: previous?.smoothed_weight_used ?? false,
    applied_luteal_correction: previous?.applied_luteal_correction ?? false,
    estimation_status: previous?.estimation_status ?? "collecting",
    data_quality_score: previous?.data_quality_score ?? null,
    data_quality_reasons: previous?.data_quality_reasons ?? [],
    auto_enabled: previous?.auto_enabled ?? false,
    current_tdee_lower: previous?.current_tdee_lower ?? null,
    current_tdee_upper: previous?.current_tdee_upper ?? null,
    latest_observed_lower: previous?.latest_observed_lower ?? null,
    latest_observed_upper: previous?.latest_observed_upper ?? null,
    actionable_streak: previous?.actionable_streak ?? 0,
    context_changed_at: previous?.context_changed_at ?? null,
  };

  await db.from("client_tdee_state").upsert(payload, { onConflict: "client_id" });
}

export async function markClientTdeeSkip(
  db: SupabaseClient,
  params: {
    clientId: string;
    reason: string;
    at?: string;
    windowDays?: number | null;
    trackedDays?: number | null;
    weightSamples?: number | null;
    anchoredToProtocol?: boolean;
  },
) {
  const at = params.at ?? new Date().toISOString();
  const previous = await fetchClientTdeeState(db, params.clientId);
  await db.from("client_tdee_state").upsert({
    client_id: params.clientId,
    current_tdee: previous?.current_tdee ?? null,
    current_tdee_at: previous?.current_tdee_at ?? null,
    latest_observed_tdee: previous?.latest_observed_tdee ?? null,
    latest_observed_at: previous?.latest_observed_at ?? null,
    confidence: previous?.confidence ?? null,
    confidence_score: previous?.confidence_score ?? null,
    confidence_reasons: previous?.confidence_reasons ?? [],
    source: previous?.source ?? null,
    method_version: previous?.method_version ?? METHOD_VERSION,
    stability_status: previous?.stability_status ?? "stable",
    pending_direction: previous?.pending_direction ?? null,
    pending_delta_kcal: previous?.pending_delta_kcal ?? null,
    pending_streak: previous?.pending_streak ?? 0,
    last_attempt_at: at,
    last_success_at: previous?.last_success_at ?? null,
    last_skip_at: at,
    last_skip_reason: params.reason,
    last_error_at: previous?.last_error_at ?? null,
    last_error: previous?.last_error ?? null,
    window_days: params.windowDays ?? previous?.window_days ?? null,
    tracked_days: params.trackedDays ?? previous?.tracked_days ?? null,
    weight_samples: params.weightSamples ?? previous?.weight_samples ?? null,
    excluded_current_day: previous?.excluded_current_day ?? true,
    anchored_to_protocol: params.anchoredToProtocol ?? previous?.anchored_to_protocol ?? false,
    smoothed_weight_used: previous?.smoothed_weight_used ?? false,
    applied_luteal_correction: previous?.applied_luteal_correction ?? false,
    estimation_status: previous?.estimation_status ?? "collecting",
    data_quality_score: previous?.data_quality_score ?? null,
    data_quality_reasons: previous?.data_quality_reasons ?? [],
    auto_enabled: previous?.auto_enabled ?? false,
    current_tdee_lower: previous?.current_tdee_lower ?? null,
    current_tdee_upper: previous?.current_tdee_upper ?? null,
    latest_observed_lower: previous?.latest_observed_lower ?? null,
    latest_observed_upper: previous?.latest_observed_upper ?? null,
    actionable_streak: previous?.actionable_streak ?? 0,
    context_changed_at: previous?.context_changed_at ?? null,
  }, { onConflict: "client_id" });
}

export async function markClientTdeeError(
  db: SupabaseClient,
  clientId: string,
  error: string,
  at: string = new Date().toISOString(),
) {
  const previous = await fetchClientTdeeState(db, clientId);
  await db.from("client_tdee_state").upsert({
    client_id: clientId,
    current_tdee: previous?.current_tdee ?? null,
    current_tdee_at: previous?.current_tdee_at ?? null,
    latest_observed_tdee: previous?.latest_observed_tdee ?? null,
    latest_observed_at: previous?.latest_observed_at ?? null,
    confidence: previous?.confidence ?? null,
    confidence_score: previous?.confidence_score ?? null,
    confidence_reasons: previous?.confidence_reasons ?? [],
    source: previous?.source ?? null,
    method_version: previous?.method_version ?? METHOD_VERSION,
    stability_status: previous?.stability_status ?? "stable",
    pending_direction: previous?.pending_direction ?? null,
    pending_delta_kcal: previous?.pending_delta_kcal ?? null,
    pending_streak: previous?.pending_streak ?? 0,
    last_attempt_at: at,
    last_success_at: previous?.last_success_at ?? null,
    last_skip_at: previous?.last_skip_at ?? null,
    last_skip_reason: previous?.last_skip_reason ?? null,
    last_error_at: at,
    last_error: error,
    window_days: previous?.window_days ?? null,
    tracked_days: previous?.tracked_days ?? null,
    weight_samples: previous?.weight_samples ?? null,
    excluded_current_day: previous?.excluded_current_day ?? true,
    anchored_to_protocol: previous?.anchored_to_protocol ?? false,
    smoothed_weight_used: previous?.smoothed_weight_used ?? false,
    applied_luteal_correction: previous?.applied_luteal_correction ?? false,
    estimation_status: previous?.estimation_status ?? "collecting",
    data_quality_score: previous?.data_quality_score ?? null,
    data_quality_reasons: previous?.data_quality_reasons ?? [],
    auto_enabled: previous?.auto_enabled ?? false,
    current_tdee_lower: previous?.current_tdee_lower ?? null,
    current_tdee_upper: previous?.current_tdee_upper ?? null,
    latest_observed_lower: previous?.latest_observed_lower ?? null,
    latest_observed_upper: previous?.latest_observed_upper ?? null,
    actionable_streak: previous?.actionable_streak ?? 0,
    context_changed_at: previous?.context_changed_at ?? null,
  }, { onConflict: "client_id" });
}

async function upsertSameDayObservation(
  db: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const calculatedAt = String(payload.calculated_at);
  const dayStart = `${calculatedAt.slice(0, 10)}T00:00:00.000Z`;
  const dayEnd = `${calculatedAt.slice(0, 10)}T23:59:59.999Z`;

  const { data: existing } = await db
    .from("nutrition_tdee_history")
    .select("id")
    .eq("protocol_id", payload.protocol_id)
    .eq("client_id", payload.client_id)
    .eq("protocol_updated", false)
    .gte("calculated_at", dayStart)
    .lte("calculated_at", dayEnd)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((existing as { id?: string } | null)?.id) {
    const { data } = await db
      .from("nutrition_tdee_history")
      .update(payload)
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .single();
    return data;
  }

  const { data } = await db
    .from("nutrition_tdee_history")
    .insert(payload)
    .select("*")
    .single();
  return data;
}

export async function recordClientTdeeObservation(
  db: SupabaseClient,
  observation: TdeeObservationPayload,
) {
  const previousState = await fetchClientTdeeState(db, observation.clientId);
  const transition = evaluateTdeeObservationTransition(previousState, {
    tdeeAdaptive: observation.tdeeAdaptive,
    confidenceScore: observation.confidenceScore,
    estimationStatus: observation.estimationStatus,
  });
  const actionableStreak = observation.estimationStatus === "actionable"
    ? (previousState?.actionable_streak ?? 0) + 1
    : 0;
  const promotedNow = transition.updateOutcome === "initialized" || transition.updateOutcome === "promoted";
  const promotedIntervalOffset = promotedNow
    ? (transition.currentTdee ?? roundTo10(observation.tdeeAdaptive)) - roundTo10(observation.tdeeAdaptive)
    : 0;

  const statePayload = {
    client_id: observation.clientId,
    current_tdee: transition.currentTdee,
    current_tdee_at:
      promotedNow
        ? observation.calculatedAt
        : previousState?.current_tdee_at ?? observation.calculatedAt,
    latest_observed_tdee: roundTo10(observation.tdeeAdaptive),
    latest_observed_at: observation.calculatedAt,
    confidence: observation.confidence,
    confidence_score: observation.confidenceScore,
    confidence_reasons: observation.confidenceReasons,
    source: observation.caloriesSource === "protocol" ? "formula_proxy" : "weight_delta",
    method_version: METHOD_VERSION,
    stability_status: transition.stabilityStatus,
    pending_direction: transition.pendingDirection,
    pending_delta_kcal: transition.pendingDeltaKcal,
    pending_streak: transition.pendingStreak,
    last_attempt_at: observation.calculatedAt,
    last_success_at: observation.calculatedAt,
    last_skip_at: null,
    last_skip_reason: null,
    last_error_at: null,
    last_error: null,
    window_days: observation.windowDays,
    tracked_days: observation.trackedDays,
    weight_samples: observation.weightSamples,
    excluded_current_day: observation.excludedCurrentDay,
    anchored_to_protocol: observation.anchoredToProtocol,
    smoothed_weight_used: observation.smoothedWeightUsed,
    applied_luteal_correction: observation.appliedLutealCorrection,
    estimation_status: observation.estimationStatus,
    data_quality_score: observation.dataQualityScore,
    data_quality_reasons: observation.dataQualityReasons,
    auto_enabled: previousState?.auto_enabled ?? false,
    current_tdee_lower: promotedNow ? observation.tdeeLower + promotedIntervalOffset : previousState?.current_tdee_lower ?? null,
    current_tdee_upper: promotedNow ? observation.tdeeUpper + promotedIntervalOffset : previousState?.current_tdee_upper ?? null,
    latest_observed_lower: observation.tdeeLower,
    latest_observed_upper: observation.tdeeUpper,
    actionable_streak: actionableStreak,
    context_changed_at: observation.contextChanged ? observation.calculatedAt : previousState?.context_changed_at ?? null,
  };

  const historyPayload = {
    protocol_id: observation.protocolId,
    client_id: observation.clientId,
    calculated_at: observation.calculatedAt,
    tdee_formula: observation.tdeeFormula,
    tdee_adaptive: roundTo10(observation.tdeeAdaptive),
    delta_kcal: observation.deltaKcal,
    weight_samples: observation.weightSamples,
    calories_source: observation.caloriesSource,
    avg_intake_kcal: observation.avgIntakeKcal,
    weight_delta_kg: observation.weightDeltaKg,
    protocol_updated: observation.protocolUpdated,
    confidence: observation.confidence,
    confidence_score: observation.confidenceScore,
    confidence_reasons: observation.confidenceReasons,
    tracked_days: observation.trackedDays,
    excluded_current_day: observation.excludedCurrentDay,
    anchored_to_protocol: observation.anchoredToProtocol,
    smoothed_weight_used: observation.smoothedWeightUsed,
    applied_luteal_correction: observation.appliedLutealCorrection,
    stable_tdee_after: transition.currentTdee,
    stability_status_after: transition.stabilityStatus,
    update_outcome: transition.updateOutcome,
    method_version: METHOD_VERSION,
    estimation_status: observation.estimationStatus,
    data_quality_score: observation.dataQualityScore,
    data_quality_reasons: observation.dataQualityReasons,
    tdee_lower: observation.tdeeLower,
    tdee_upper: observation.tdeeUpper,
    complete_days: observation.completeDays,
    context_changed: observation.contextChanged,
  };

  const [historyRow] = await Promise.all([
    upsertSameDayObservation(db, historyPayload),
    db.from("client_tdee_state").upsert(statePayload, { onConflict: "client_id" }),
  ]);

  return {
    history: historyRow,
    state: statePayload,
    transition,
  };
}

export async function setClientTdeeAutoEnabled(
  db: SupabaseClient,
  clientId: string,
  enabled: boolean,
) {
  const previous = await fetchClientTdeeState(db, clientId);
  await db.from("client_tdee_state").upsert({
    client_id: clientId,
    current_tdee: previous?.current_tdee ?? null,
    current_tdee_at: previous?.current_tdee_at ?? null,
    latest_observed_tdee: previous?.latest_observed_tdee ?? null,
    latest_observed_at: previous?.latest_observed_at ?? null,
    confidence: previous?.confidence ?? null,
    confidence_score: previous?.confidence_score ?? null,
    confidence_reasons: previous?.confidence_reasons ?? [],
    source: previous?.source ?? null,
    method_version: previous?.method_version ?? METHOD_VERSION,
    stability_status: previous?.stability_status ?? "stable",
    pending_direction: previous?.pending_direction ?? null,
    pending_delta_kcal: previous?.pending_delta_kcal ?? null,
    pending_streak: previous?.pending_streak ?? 0,
    last_attempt_at: previous?.last_attempt_at ?? null,
    last_success_at: previous?.last_success_at ?? null,
    last_skip_at: previous?.last_skip_at ?? null,
    last_skip_reason: previous?.last_skip_reason ?? null,
    last_error_at: previous?.last_error_at ?? null,
    last_error: previous?.last_error ?? null,
    window_days: previous?.window_days ?? null,
    tracked_days: previous?.tracked_days ?? null,
    weight_samples: previous?.weight_samples ?? null,
    excluded_current_day: previous?.excluded_current_day ?? true,
    anchored_to_protocol: previous?.anchored_to_protocol ?? false,
    smoothed_weight_used: previous?.smoothed_weight_used ?? false,
    applied_luteal_correction: previous?.applied_luteal_correction ?? false,
    estimation_status: previous?.estimation_status ?? "collecting",
    data_quality_score: previous?.data_quality_score ?? null,
    data_quality_reasons: previous?.data_quality_reasons ?? [],
    auto_enabled: enabled,
    current_tdee_lower: previous?.current_tdee_lower ?? null,
    current_tdee_upper: previous?.current_tdee_upper ?? null,
    latest_observed_lower: previous?.latest_observed_lower ?? null,
    latest_observed_upper: previous?.latest_observed_upper ?? null,
    actionable_streak: previous?.actionable_streak ?? 0,
    context_changed_at: previous?.context_changed_at ?? null,
  }, { onConflict: "client_id" });
}
