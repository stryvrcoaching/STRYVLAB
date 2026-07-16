import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildSmoothingPlanDays } from "@/lib/nutrition/smoothing/compute-plan";
import { fetchActiveSmoothingPlanForCoach } from "@/lib/nutrition/smoothing/fetch";
import {
  clearCoachSmoothingPreps,
  fetchLatestSharedProtocol,
  materializeCoachSmoothingPreps,
  resolveFutureCandidatesForPlan,
} from "@/lib/nutrition/smoothing/coach-service";

const patchSchema = z.object({
  action: z.enum(["cancel", "modify", "note"]),
  durationDays: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(7), z.literal(10)]).optional(),
  note: z.string().trim().max(280).optional(),
});

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; planId: string }> },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, planId } = await params;
  const db = serviceClient();
  const activePlan = await fetchActiveSmoothingPlanForCoach(db as any, user.id, clientId);
  const protocol = await fetchLatestSharedProtocol(db as any, clientId);

  if (!activePlan || activePlan.id !== planId) {
    return NextResponse.json({ error: "Active smoothing plan not found" }, { status: 404 });
  }

  const note = parsed.data.note?.trim() || null;

  if (parsed.data.action === "cancel") {
    await clearCoachSmoothingPreps({ db, clientId, plan: activePlan });
    const { error } = await db
      .from("nutrition_smoothing_plans")
      .update({
        status: "cancelled",
        coach_last_action: "cancelled",
        coach_note: note,
        coach_note_updated_at: note ? new Date().toISOString() : activePlan.coach_note_updated_at,
      })
      .eq("id", planId)
      .eq("client_id", clientId)
      .eq("coach_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await db
      .from("coach_notifications")
      .update({ status: "resolved" })
      .eq("client_id", clientId)
      .eq("coach_id", user.id)
      .contains("payload", { smoothing_plan_id: planId });

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "note") {
    const { error } = await db
      .from("nutrition_smoothing_plans")
      .update({
        coach_last_action: "noted",
        coach_note: note,
        coach_note_updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .eq("client_id", clientId)
      .eq("coach_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const durationDays = parsed.data.durationDays;
  if (!durationDays) {
    return NextResponse.json({ error: "durationDays is required for modify" }, { status: 400 });
  }

  await clearCoachSmoothingPreps({ db, clientId, plan: activePlan });
  const futureDays = await resolveFutureCandidatesForPlan(db, clientId, activePlan.source_date, durationDays, protocol);
  const rebuiltDays = buildSmoothingPlanDays({
    planId,
    direction: activePlan.direction,
    smoothableDeltaKcal: Number(activePlan.smoothable_delta_kcal ?? 0),
    futureDays,
  });

  const { error: updateError } = await db
    .from("nutrition_smoothing_plans")
    .update({
      duration_days: durationDays,
      strategy: "manual",
      coach_last_action: "modified",
      coach_note: note,
      coach_note_updated_at: note ? new Date().toISOString() : activePlan.coach_note_updated_at,
    })
    .eq("id", planId)
    .eq("client_id", clientId)
    .eq("coach_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteDaysError } = await db
    .from("nutrition_smoothing_plan_days")
    .delete()
    .eq("plan_id", planId);

  if (deleteDaysError) {
    return NextResponse.json({ error: deleteDaysError.message }, { status: 500 });
  }

  if (rebuiltDays.length > 0) {
    const { error: insertDaysError } = await db
      .from("nutrition_smoothing_plan_days")
      .insert(rebuiltDays);

    if (insertDaysError) {
      return NextResponse.json({ error: insertDaysError.message }, { status: 500 });
    }
  }

  await materializeCoachSmoothingPreps({
    db,
    clientId,
    plan: {
      ...activePlan,
      duration_days: durationDays,
      coach_note: note,
      coach_note_updated_at: note ? new Date().toISOString() : activePlan.coach_note_updated_at,
      coach_last_action: "modified",
      days: rebuiltDays as any,
    },
    protocol,
  })

  await db
    .from("coach_notifications")
    .update({ status: "resolved" })
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .contains("payload", { smoothing_plan_id: planId });

  return NextResponse.json({ ok: true });
}
