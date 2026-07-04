import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { buildSmoothingPlanDays } from "@/lib/nutrition/smoothing/compute-plan";
import { fetchActiveSmoothingPlanForCoach } from "@/lib/nutrition/smoothing/fetch";
import { resolveProtocolDayByDate } from "@/lib/nutrition/protocol-schedule";

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

function shiftDate(iso: string, offsetDays: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function resolveFutureCandidates(
  db: ReturnType<typeof serviceClient>,
  clientId: string,
  activePlan: NonNullable<Awaited<ReturnType<typeof fetchActiveSmoothingPlanForCoach>>>,
  durationDays: number,
) {
  const { data: protocol } = await db
    .from("nutrition_protocols")
    .select("schedule_start_date, nutrition_protocol_days(position, name, calories), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)")
    .eq("client_id", clientId)
    .eq("status", "shared")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingByDate = new Map(
    (activePlan.days ?? []).map((day) => [day.date, day] as const),
  );
  const protocolDays = ((protocol as any)?.nutrition_protocol_days ?? []) as Array<Record<string, unknown>>;
  const scheduleSlots = ((protocol as any)?.nutrition_protocol_schedule_slots ?? []) as Array<Record<string, unknown>>;

  const candidates = [];
  for (let index = 1; index <= durationDays; index += 1) {
    const date = shiftDate(activePlan.source_date, index);
    const existing = existingByDate.get(date);
    if (existing) {
      candidates.push({
        date,
        label: existing.source_day_label,
        target_kcal: Number(existing.base_target_kcal ?? existing.cycle_synced_target_kcal ?? 0),
      });
      continue;
    }

    const protocolDay = resolveProtocolDayByDate(
      date,
      (protocol as any)?.schedule_start_date ?? null,
      protocolDays as any,
      scheduleSlots as any,
    ) as Record<string, unknown> | null;

    candidates.push({
      date,
      label: String(protocolDay?.name ?? "Jour"),
      target_kcal: Number(protocolDay?.calories ?? activePlan.source_target_kcal ?? 0),
    });
  }

  return candidates;
}

async function notifyClient(
  db: ReturnType<typeof serviceClient>,
  args: {
    clientId: string;
    coachId: string;
    title: string;
    body: string;
    planId: string;
  },
) {
  await db.from("coach_client_notifications").insert({
    client_id: args.clientId,
    coach_id: args.coachId,
    type: "coach_note",
    title: args.title,
    body: args.body,
    payload: {
      entity_type: "nutrition_smoothing",
      entity_id: args.planId,
      action_url: "/client/nutrition",
    },
  });
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

  if (!activePlan || activePlan.id !== planId) {
    return NextResponse.json({ error: "Active smoothing plan not found" }, { status: 404 });
  }

  const note = parsed.data.note?.trim() || null;

  if (parsed.data.action === "cancel") {
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

    await notifyClient(db, {
      clientId,
      coachId: user.id,
      planId,
      title: "Lissage nutrition annulé",
      body: note || "Ton coach a annulé le lissage calorique actif.",
    });

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

    if (note) {
      await notifyClient(db, {
        clientId,
        coachId: user.id,
        planId,
        title: "Note nutrition du coach",
        body: note,
      });
    }

    return NextResponse.json({ ok: true });
  }

  const durationDays = parsed.data.durationDays;
  if (!durationDays) {
    return NextResponse.json({ error: "durationDays is required for modify" }, { status: 400 });
  }

  const futureDays = await resolveFutureCandidates(db, clientId, activePlan, durationDays);
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

  await db
    .from("coach_notifications")
    .update({ status: "resolved" })
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .contains("payload", { smoothing_plan_id: planId });

  await notifyClient(db, {
    clientId,
    coachId: user.id,
    planId,
    title: "Lissage nutrition modifié",
    body:
      note ||
      `Ton coach a ajusté le lissage calorique sur ${durationDays} jours.`,
  });

  return NextResponse.json({ ok: true });
}
