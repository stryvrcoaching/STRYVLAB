import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { computePhysiologicalDateInTimezone } from "@/lib/client/checkin/timeWindows"
import {
  buildCoachSmoothingState,
  buildPlanFromProposal,
  clearCoachSmoothingPreps,
  combineSmoothableDelta,
  ensureCoachSmoothingRecommendationNotification,
  fetchLatestSharedProtocol,
  materializeCoachSmoothingPreps,
  resolveConsumedForDate,
  resolveDayTarget,
  resolveFutureCandidatesForPlan,
} from "@/lib/nutrition/smoothing/coach-service"
import { fetchActiveSmoothingPlanForCoach } from "@/lib/nutrition/smoothing/fetch"
import type { NutritionSmoothingPlan } from "@/lib/nutrition/smoothing/types"

const durationSchema = z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(7), z.literal(10)])

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: durationSchema,
  mode: z.enum(["create", "add", "replace"]).default("create"),
  note: z.string().trim().max(280).optional(),
})

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function resolveCoachClient(
  db: ReturnType<typeof serviceClient>,
  coachId: string,
  clientId: string,
) {
  const { data } = await db
    .from("coach_clients")
    .select("id, timezone")
    .eq("id", clientId)
    .eq("coach_id", coachId)
    .maybeSingle()

  return data ?? null
}

function toResponse(state: Awaited<ReturnType<typeof buildCoachSmoothingState>>) {
  return {
    date: state.date,
    protocolId: state.protocolId,
    protocolName: state.protocolName,
    activePlan: state.activePlan
      ? {
          id: state.activePlan.id,
          sourceDate: state.activePlan.source_date,
          direction: state.activePlan.direction,
          durationDays: state.activePlan.duration_days,
          smoothableDeltaKcal: state.activePlan.smoothable_delta_kcal,
          coachNote: state.activePlan.coach_note,
          coachLastAction: state.activePlan.coach_last_action,
        }
      : null,
    proposal: state.proposal,
    previewDays: state.previewDays,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { clientId } = await params
  const db = serviceClient()
  const client = await resolveCoachClient(db, user.id, clientId)
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const timezone = String((client as any).timezone ?? "").trim() || await resolveClientTimezone(db, clientId)
  const date = req.nextUrl.searchParams.get("date")?.trim() || computePhysiologicalDateInTimezone(new Date(), timezone)
  const durationParam = req.nextUrl.searchParams.get("durationDays")
  const parsedDuration = durationParam ? durationSchema.safeParse(Number(durationParam)) : null

  const state = await buildCoachSmoothingState({
    db,
    coachId: user.id,
    clientId,
    date,
    durationDays: parsedDuration?.success ? parsedDuration.data : undefined,
  })

  await ensureCoachSmoothingRecommendationNotification({
    db,
    coachId: user.id,
    clientId,
    protocolId: state.protocolId,
    sourceDate: date,
    proposal: state.proposal,
  })

  return NextResponse.json(toResponse(state))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { clientId } = await params
  const db = serviceClient()
  const client = await resolveCoachClient(db, user.id, clientId)
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { date, durationDays, mode, note } = parsed.data
  const protocol = await fetchLatestSharedProtocol(db, clientId)
  if (!protocol) {
    return NextResponse.json({ error: "No shared nutrition protocol found" }, { status: 409 })
  }

  const state = await buildCoachSmoothingState({
    db,
    coachId: user.id,
    clientId,
    date,
    durationDays,
  })

  if (!state.proposal.eligible || !state.proposal.direction || state.proposal.recommendedDurationDays == null) {
    return NextResponse.json({ error: "No eligible smoothing recommendation" }, { status: 409 })
  }

  const activePlan = await fetchActiveSmoothingPlanForCoach(db as any, user.id, clientId)
  if (activePlan && mode === "create") {
    return NextResponse.json({ error: "An active smoothing plan already exists" }, { status: 409 })
  }

  const { signedSmoothableDelta, direction } = combineSmoothableDelta(activePlan, state.proposal, mode)
  if (signedSmoothableDelta === 0) {
    return NextResponse.json({ error: "Combined smoothing delta is zero" }, { status: 409 })
  }

  if (activePlan && (mode === "replace" || mode === "add")) {
    await clearCoachSmoothingPreps({ db, clientId, plan: activePlan })
    await db
      .from("nutrition_smoothing_plans")
      .update({
        status: "replaced",
        replaced_by_plan_id: null,
        coach_last_action: activePlan.coach_last_action,
      })
      .eq("id", activePlan.id)
  }

  const futureDays = await resolveFutureCandidatesForPlan(db, clientId, date, durationDays, protocol)
  const planId = crypto.randomUUID()
  const days = buildPlanFromProposal({
    planId,
    sourceDate: date,
    direction,
    smoothableDeltaKcal: signedSmoothableDelta,
    futureDays,
  })

  const { target } = await resolveDayTarget(db, clientId, date, protocol)
  const consumed = await resolveConsumedForDate(db, clientId, date)
  const { error: planError } = await db
    .from("nutrition_smoothing_plans")
    .insert({
      id: planId,
      client_id: clientId,
      coach_id: user.id,
      source_date: date,
      source_target_kcal: Math.round(target.kcal),
      source_consumed_kcal: Math.round(consumed.kcal),
      threshold_kcal: state.proposal.thresholdKcal,
      raw_delta_kcal: state.proposal.rawDeltaKcal,
      smoothable_delta_kcal: signedSmoothableDelta,
      direction,
      duration_days: durationDays,
      strategy: durationDays === state.proposal.recommendedDurationDays ? "recommended" : "manual",
      status: "active",
      created_by: "coach",
      client_decision: null,
      coach_note: note?.trim() || null,
      coach_note_updated_at: note?.trim() ? new Date().toISOString() : null,
    })

  if (planError) {
    return NextResponse.json({ error: planError.message }, { status: 500 })
  }

  if (days.length > 0) {
    const { error: dayError } = await db
      .from("nutrition_smoothing_plan_days")
      .insert(days)
    if (dayError) {
      await db.from("nutrition_smoothing_plans").delete().eq("id", planId)
      return NextResponse.json({ error: dayError.message }, { status: 500 })
    }
  }

  const createdPlan: NutritionSmoothingPlan = {
    id: planId,
    client_id: clientId,
    coach_id: user.id,
    source_date: date,
    source_target_kcal: Math.round(target.kcal),
    source_consumed_kcal: Math.round(consumed.kcal),
    threshold_kcal: state.proposal.thresholdKcal,
    raw_delta_kcal: state.proposal.rawDeltaKcal,
    smoothable_delta_kcal: signedSmoothableDelta,
    direction,
    duration_days: durationDays,
    strategy: durationDays === state.proposal.recommendedDurationDays ? "recommended" : "manual",
    status: "active",
    created_by: "coach",
    client_decision: null,
    replaced_by_plan_id: null,
    coach_note: note?.trim() || null,
    coach_note_updated_at: note?.trim() ? new Date().toISOString() : null,
    coach_last_action: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    days: days as any,
  }

  try {
    await materializeCoachSmoothingPreps({
      db,
      clientId,
      plan: createdPlan,
      protocol,
    })
  } catch (error) {
    await db.from("nutrition_smoothing_plan_days").delete().eq("plan_id", planId)
    await db.from("nutrition_smoothing_plans").delete().eq("id", planId)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to materialize plan adjustments" }, { status: 500 })
  }

  await db
    .from("coach_notifications")
    .update({ status: "resolved" })
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .eq("category", "nutrition_trend")
    .eq("subcategory", "calorie_smoothing_recommended")
    .contains("payload", {
      entity_type: "nutrition_smoothing_recommendation",
      source_date: date,
    })

  const nextState = await buildCoachSmoothingState({
    db,
    coachId: user.id,
    clientId,
    date,
    durationDays,
  })

  return NextResponse.json({
    ok: true,
    planId,
    ...toResponse(nextState),
  })
}
