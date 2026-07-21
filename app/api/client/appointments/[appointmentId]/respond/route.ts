/**
 * POST /api/client/appointments/[appointmentId]/respond
 *
 * Client actions: confirm, request reschedule, or cancel (withdraw).
 * client_id is always resolved from auth.uid().
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendCoachNotification } from "@/lib/notifications/sendCoachNotification";
import { cancelPendingDeliveries } from "@/lib/appointments/notifications";
import {
  canClientCancel,
  canClientRespond,
} from "@/lib/appointments/types";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const RespondSchema = z.object({
  action: z.enum(["confirm", "request_reschedule", "cancel"]),
  reason: z.string().trim().max(500).optional(),
});

type RouteContext = { params: Promise<{ appointmentId: string }> | { appointmentId: string } };

async function resolveParams(params: RouteContext["params"]) {
  return typeof (params as Promise<{ appointmentId: string }>).then === "function"
    ? await (params as Promise<{ appointmentId: string }>)
    : (params as { appointmentId: string });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { appointmentId } = await resolveParams(params);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = RespondSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = service();

  const { data: clientRow } = await db
    .from("coach_clients")
    .select("id, coach_id, first_name, last_name")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!clientRow) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const { data: appt } = await db
    .from("coaching_appointments")
    .select(
      "id, status, title, starts_at, coach_id, client_id, confirmation_required",
    )
    .eq("id", appointmentId)
    .eq("client_id", clientRow.id)
    .single();

  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { action, reason } = parsed.data;
  const now = new Date().toISOString();
  const clientName =
    [clientRow.first_name, clientRow.last_name].filter(Boolean).join(" ") ||
    "Un client";

  // ── Confirm / reschedule ──────────────────────────────────────────────────
  if (action === "confirm" || action === "request_reschedule") {
    if (!canClientRespond(appt)) {
      return NextResponse.json(
        { error: "This appointment does not require a client response" },
        { status: 409 },
      );
    }

    const newStatus =
      action === "confirm" ? "confirmed" : "reschedule_requested";

    const { data: updated, error: updateErr } = await db
      .from("coaching_appointments")
      .update({
        status: newStatus,
        responded_at: now,
        reschedule_reason:
          action === "request_reschedule" ? (reason ?? null) : null,
        updated_at: now,
      })
      .eq("id", appointmentId)
      .select("id, status")
      .single();

    if (updateErr || !updated) {
      console.error("[client/appointments/respond] update error", updateErr);
      return NextResponse.json(
        { error: "Failed to update appointment" },
        { status: 500 },
      );
    }

    await db.from("coaching_appointment_activity").insert({
      appointment_id: appointmentId,
      actor_role: "client",
      actor_user_id: user.id,
      event_type: action === "confirm" ? "confirmed" : "reschedule_requested",
      metadata: { reason: reason ?? null },
    });

    if (action === "request_reschedule") {
      try {
        await sendCoachNotification(db, {
          coachId: appt.coach_id,
          clientId: appt.client_id,
          type: "appointment",
          title: `Report demandé — ${appt.title}`,
          body: reason
            ? `${clientName} : « ${reason.slice(0, 200)} »`
            : `${clientName} a demandé un report pour cet appel.`,
          payload: {
            appointment_id: appointmentId,
            action: "reschedule_requested",
          },
        });
      } catch (err) {
        console.error("[appointments/respond] coach notification error", err);
      }
    }

    return NextResponse.json({ ok: true, status: updated.status });
  }

  // ── Cancel / withdraw ─────────────────────────────────────────────────────
  if (!canClientCancel(appt)) {
    return NextResponse.json(
      { error: "This appointment can no longer be cancelled" },
      { status: 409 },
    );
  }

  const { data: updated, error: updateErr } = await db
    .from("coaching_appointments")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: reason?.trim()
        ? `Désistement client${reason.trim() ? ` : ${reason.trim()}` : ""}`
        : "Désistement client",
      responded_at: now,
      updated_at: now,
    })
    .eq("id", appointmentId)
    .select("id, status")
    .single();

  if (updateErr || !updated) {
    console.error("[client/appointments/respond] cancel error", updateErr);
    return NextResponse.json(
      { error: "Failed to cancel appointment" },
      { status: 500 },
    );
  }

  await db.from("coaching_appointment_activity").insert({
    appointment_id: appointmentId,
    actor_role: "client",
    actor_user_id: user.id,
    event_type: "cancelled",
    metadata: { reason: reason ?? null, by: "client" },
  });

  try {
    await cancelPendingDeliveries(db, appointmentId);
  } catch (err) {
    console.error("[appointments/respond] cancel deliveries error", err);
  }

  try {
    await sendCoachNotification(db, {
      coachId: appt.coach_id,
      clientId: appt.client_id,
      type: "appointment",
      title: `Désistement — ${appt.title}`,
      body: reason
        ? `${clientName} s’est désisté : « ${reason.slice(0, 200)} »`
        : `${clientName} s’est désisté de l’appel prévu.`,
      payload: {
        appointment_id: appointmentId,
        action: "client_cancelled",
      },
    });
  } catch (err) {
    console.error("[appointments/respond] coach cancel notification error", err);
  }

  return NextResponse.json({ ok: true, status: updated.status });
}
