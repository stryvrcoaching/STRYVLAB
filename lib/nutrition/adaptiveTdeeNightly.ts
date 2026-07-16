import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  collectDailyTdeeIntakes,
  collectWeightSamples,
  resolveProtocolStartDate,
} from "@/lib/nutrition/weightSamples";
import { estimateClientTdeeV2 } from "@/lib/nutrition/tdee-model-v2";
import {
  markClientTdeeAttempt,
  markClientTdeeError,
  markClientTdeeSkip,
  recordClientTdeeObservation,
} from "@/lib/nutrition/tdee-state";

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type AutoProtocolRow = {
  id: string;
  client_id: string;
  coach_id: string;
  name: string | null;
  tdee_reference: number | null;
  nutrition_protocol_days: Array<{ id: string; calories: number | null; position: number }> | null;
};

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(`${date}T00:00:00.000Z`).getTime()) / 86_400_000);
}

export async function processAdaptiveTdeeProtocol(
  db: SupabaseClient,
  protocol: AutoProtocolRow,
) {
  const { client_id: clientId, id: protocolId, coach_id: coachId } = protocol;
  const days = protocol.nutrition_protocol_days ?? [];

  try {
    const day1Cal = [...days].sort((left, right) => left.position - right.position)[0]?.calories ?? 2000;
    const tdeeReference = protocol.tdee_reference ?? day1Cal;
    const attemptAt = new Date().toISOString();
    await markClientTdeeAttempt(db, clientId, attemptAt);

    const { samples: weightSamples, windowDays, anchoredToProtocol } =
      await collectWeightSamples(db, clientId, 14, 4);

    if (weightSamples.length < 2) {
      await markClientTdeeSkip(db, {
        clientId,
        at: attemptAt,
        reason: "insufficient_weight_samples",
        windowDays,
        weightSamples: weightSamples.length,
        anchoredToProtocol,
      });
      return { skipped: true, reason: "insufficient_weight_samples", protocolId, weightSamples: weightSamples.length };
    }

    const [{ entries: dailyIntakes, trackedDays }, contextStartDate] = await Promise.all([
      collectDailyTdeeIntakes(db, clientId, windowDays),
      resolveProtocolStartDate(db, clientId, protocol.name ?? "", protocolId),
    ]);
    const contextChanged = contextStartDate != null && daysSince(contextStartDate) < 7;
    const result = estimateClientTdeeV2({
      weightSamples,
      dailyIntakes,
      fallbackIntakeKcal: tdeeReference,
      windowDays,
      contextChanged,
    });
    const caloriesSource = result.completeDays > 0 ? "logs" : "protocol";
    const confidence = result.confidenceScore >= 80 ? "high" : result.confidenceScore >= 55 ? "medium" : "low";
    const calculatedAt = new Date().toISOString();
    const deltaKcal = result.estimate - tdeeReference;
    const recorded = await recordClientTdeeObservation(db, {
      protocolId,
      clientId,
      calculatedAt,
      tdeeFormula: tdeeReference,
      tdeeAdaptive: result.estimate,
      deltaKcal,
      weightSamples: result.weightSamplesUsed,
      caloriesSource,
      avgIntakeKcal: result.avgIntakeKcal,
      weightDeltaKg: result.weightDeltaKg,
      protocolUpdated: false,
      confidence,
      confidenceScore: result.confidenceScore,
      confidenceReasons: result.reasons,
      windowDays,
      trackedDays,
      excludedCurrentDay: true,
      anchoredToProtocol,
      smoothedWeightUsed: false,
      appliedLutealCorrection: false,
      estimationStatus: result.status,
      dataQualityScore: result.confidenceScore,
      dataQualityReasons: result.reasons,
      tdeeLower: result.lower,
      tdeeUpper: result.upper,
      completeDays: result.completeDays,
      contextChanged,
    });

    if (result.status === "actionable" && recorded.state.current_tdee != null) {
      await db.from("nutrition_protocols").update({
        tdee_adaptive: recorded.state.current_tdee,
        tdee_adaptive_at: recorded.state.current_tdee_at,
        tdee_data_source: recorded.state.source,
      }).eq("id", protocolId);
    }

    if (Math.abs(deltaKcal) < 100 || result.status !== "actionable" || recorded.state.current_tdee == null) {
      return {
        recorded: true,
        reason: result.status === "actionable" ? "awaiting_second_actionable_window" : "estimation_not_actionable",
        deltaKcal,
        protocolId,
        calculatedAt,
        clientTdee: recorded.state.current_tdee,
        stabilityStatus: recorded.state.stability_status,
        estimationStatus: result.status,
        dataQualityScore: result.confidenceScore,
      };
    }

    const { data: clientRow } = await db
      .from("coach_clients")
      .select("first_name")
      .eq("id", clientId)
      .single();
    const firstName = (clientRow as any)?.first_name ?? "Client";
    const sign = deltaKcal > 0 ? "+" : "";

    await db.from("coach_notifications").insert({
      coach_id: coachId,
      client_id: clientId,
      category: "nutrition_trend",
      subcategory: "tdee_coach_alert",
      priority: 3,
      status: "pending",
      email_sent: false,
      title: `TDEE ${firstName} recalculé - action requise`,
      body: `Nouvelle estimation TDEE exploitable : ${recorded.state.current_tdee} kcal (${sign}${deltaKcal} vs référence). Confirmez l’application dans Nutrition Studio.`,
      payload: { action_url: `/coach/clients/${clientId}/protocoles/nutrition` },
    });

    return {
      recorded: true,
      protocolId,
      tdeeObserved: result.estimate,
      clientTdee: recorded.state.current_tdee,
      tdeeLower: result.lower,
      tdeeUpper: result.upper,
      deltaKcal,
      windowDays,
      weightSamples: result.weightSamplesUsed,
      completeDays: result.completeDays,
      calculatedAt,
      stabilityStatus: recorded.state.stability_status,
      estimationStatus: result.status,
      dataQualityScore: result.confidenceScore,
    };
  } catch (error) {
    await markClientTdeeError(
      db,
      clientId,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

export async function runAdaptiveTdeeNightly() {
  const db = svc();
  const { data: enabledStates, error: enabledStatesError } = await db
    .from("client_tdee_state")
    .select("client_id")
    .eq("auto_enabled", true);

  if (enabledStatesError) throw new Error(`fetch-auto-tdee-clients: ${enabledStatesError.message}`);

  const clientIds = (enabledStates ?? []).map((state: { client_id: string }) => state.client_id);
  if (clientIds.length === 0) return { processed: 0, results: [] };

  const { data, error } = await db
    .from("nutrition_protocols")
    .select("id, client_id, coach_id, name, tdee_reference, nutrition_protocol_days(id, calories, position)")
    .eq("status", "shared")
    .in("client_id", clientIds)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`fetch-auto-protocols: ${error.message}`);

  const protocolByClient = new Map<string, AutoProtocolRow>();
  for (const protocol of (data ?? []) as AutoProtocolRow[]) {
    if (!protocolByClient.has(protocol.client_id)) protocolByClient.set(protocol.client_id, protocol);
  }

  const results = await Promise.allSettled(
    clientIds.map((clientId) => {
      const protocol = protocolByClient.get(clientId);
      return protocol
        ? processAdaptiveTdeeProtocol(db, protocol)
        : Promise.resolve({ skipped: true, reason: "no_shared_protocol_consumer", clientId });
    }),
  );

  return {
    processed: clientIds.length,
    results: results.map((result) =>
      result.status === "fulfilled"
        ? { status: "fulfilled", value: result.value }
        : { status: "rejected", reason: result.reason instanceof Error ? result.reason.message : String(result.reason) },
    ),
  };
}
