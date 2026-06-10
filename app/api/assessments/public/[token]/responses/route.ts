import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { BulkResponsePayload } from "@/types/assessment";
import { sendBilanCompletedEmail } from "@/lib/email/mailer";
import { inngest } from "@/lib/inngest/client";
import { syncProfileFromResponses } from "@/lib/assessments/sync-profile";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/assessments/public/[token]/responses — sans auth (client)
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const db = serviceClient();

  // Valider token
  const { data: submission } = await db
    .from("assessment_submissions")
    .select(
      `
      id, coach_id, client_id, status, token_expires_at, bilan_date,
      template_snapshot,
      client:coach_clients(first_name, last_name)
    `,
    )
    .eq("token", params.token)
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (submission.status === "completed" || submission.status === "expired") {
    return NextResponse.json(
      { error: "Ce bilan ne peut plus être modifié" },
      { status: 410 },
    );
  }

  if (new Date(submission.token_expires_at) < new Date()) {
    await db
      .from("assessment_submissions")
      .update({ status: "expired" })
      .eq("id", submission.id);
    return NextResponse.json({ error: "Ce lien a expiré" }, { status: 410 });
  }

  const body: BulkResponsePayload = await req.json();

  if (!Array.isArray(body.responses) || body.responses.length === 0) {
    return NextResponse.json(
      { error: "Aucune réponse fournie" },
      { status: 400 },
    );
  }

  const rows = body.responses.map((r) => ({
    submission_id: submission.id,
    block_id: r.block_id,
    field_key: r.field_key,
    value_text: r.value_text ?? null,
    value_number: r.value_number ?? null,
    value_json: r.value_json ?? null,
    storage_path: r.storage_path ?? null,
  }));

  const { error: upsertError } = await db
    .from("assessment_responses")
    .upsert(rows, { onConflict: "submission_id,block_id,field_key" });

  if (upsertError) {
    console.error("POST public responses:", upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  if (body.submit) {
    await db
      .from("assessment_submissions")
      .update({ status: "completed", submitted_at: new Date().toISOString() })
      .eq("id", submission.id);

    // Sync profile fields (gender, dob, training_goal, fitness_level, injuries)
    const bilanDate = (submission as any).bilan_date ?? new Date().toISOString().slice(0, 10)
    await syncProfileFromResponses(db, submission.client_id, submission.coach_id, body.responses as any, bilanDate)

    // Notification coach explicite avec nom client + nom bilan
    const client = submission.client as {
      first_name?: string;
      last_name?: string;
    } | null;
    // Nom du bilan : template_snapshot[0]?.name ou .name
    let templateName = "bilan";
    if (
      Array.isArray(submission.template_snapshot) &&
      submission.template_snapshot[0]?.name
    ) {
      templateName = submission.template_snapshot[0].name;
    } else if ((submission.template_snapshot as any)?.name) {
      templateName = (submission.template_snapshot as any).name;
    }
    const clientName = client
      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
      : "Le client";
    const notifMessage = `${clientName} a complété le bilan ${templateName}.`;

    // Utilise insertClientNotification pour cohérence (résout target_user_id)
    const { insertClientNotification } =
      await import("@/lib/notifications/insert-client-notification");
    await insertClientNotification(db, {
      coachId: submission.coach_id,
      clientId: submission.client_id,
      submissionId: submission.id,
      type: "assessment_completed",
      message: notifMessage,
    });

    // Email de notification au coach
    try {
      const { data: coachAuth } = await db.auth.admin.getUserById(
        submission.coach_id,
      );
      const coachEmail = coachAuth?.user?.email;
      const coachFirstName =
        (coachAuth?.user?.user_metadata?.first_name as string | undefined) ??
        "Coach";
      if (coachEmail) {
        const client = submission.client as any;
        const templateName =
          (submission.template_snapshot as any)?.[0]?.name ??
          (submission.template_snapshot as any)?.name ??
          "Bilan";
        const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/coach/clients/${submission.client_id}/bilans/${submission.id}`;
        await sendBilanCompletedEmail({
          to: coachEmail,
          coachFirstName,
          clientFullName: client
            ? `${client.first_name} ${client.last_name}`
            : "Votre client",
          templateName,
          dashboardUrl,
        });
      }
    } catch (emailError) {
      console.error("Email send failed (non-blocking):", emailError);
    }

    // Award bilan points once per submission
    const { data: existingBilanPoints } = await db
      .from("client_points")
      .select("id")
      .eq("client_id", submission.client_id)
      .eq("action_type", "bilan")
      .eq("reference_id", submission.id)
      .maybeSingle();

    if (!existingBilanPoints) {
      await db.from("client_points").insert({
        client_id: submission.client_id,
        action_type: "bilan",
        points: 20,
        reference_id: submission.id,
      });

      await inngest.send({
        name: "points/level.update",
        data: { client_id: submission.client_id },
      });
    }
  }

  return NextResponse.json({ success: true });
}
