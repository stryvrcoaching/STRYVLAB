import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendBilanCompletedEmail } from "@/lib/email/mailer";
import { awardProgression } from '@/lib/rewards/progression';
import { syncProfileFromResponses } from "@/lib/assessments/sync-profile";
import {
  isValidPublicAssessmentToken,
  MAX_PUBLIC_ASSESSMENT_BODY_BYTES,
  publicAssessmentPayloadSchema,
  validatePublicAssessmentResponses,
} from "@/lib/assessments/public-response-security";
import {
  checkPublicRateLimit,
  rateLimitResponse,
} from "@/lib/security/public-rate-limit";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/assessments/public/[token]/responses — sans auth (client)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const db = serviceClient();
  let pointsEarned = 0;
  const rateLimit = await checkPublicRateLimit({
    db,
    req,
    scope: "public_assessment_write",
    subject: token,
    maxRequests: 120,
    windowSeconds: 10 * 60,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!isValidPublicAssessmentToken(token)) {
    return NextResponse.json(
      { error: "Lien invalide" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

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
    .eq("token", token)
    .single();

  if (!submission) {
    return NextResponse.json(
      { error: "Lien invalide" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (submission.status === "completed" || submission.status === "expired") {
    return NextResponse.json(
      { error: "Ce bilan ne peut plus être modifié" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (new Date(submission.token_expires_at) < new Date()) {
    await db
      .from("assessment_submissions")
      .update({ status: "expired" })
      .eq("id", submission.id);
    return NextResponse.json(
      { error: "Ce lien a expiré" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PUBLIC_ASSESSMENT_BODY_BYTES) {
    return NextResponse.json(
      { error: "Réponse trop volumineuse" },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_PUBLIC_ASSESSMENT_BODY_BYTES) {
    return NextResponse.json(
      { error: "Réponse trop volumineuse" },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsedBody = publicAssessmentPayloadSchema.safeParse(untrustedBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Réponses invalides" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = parsedBody.data;
  const responseValidation = validatePublicAssessmentResponses({
    payload: body,
    snapshot: submission.template_snapshot as any,
    coachId: submission.coach_id,
    clientId: submission.client_id,
    submissionId: submission.id,
  });

  if (!responseValidation.ok) {
    return NextResponse.json(
      { error: responseValidation.error },
      { status: 400, headers: { "Cache-Control": "no-store" } },
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
    console.error("POST public responses failed");
    return NextResponse.json(
      { error: "Impossible d'enregistrer les réponses" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (body.submit) {
    await db
      .from("assessment_submissions")
      .update({ status: "completed", submitted_at: new Date().toISOString() })
      .eq("id", submission.id);

    // Sync profile fields (gender, dob, training_goal, fitness_level, injuries)
    const bilanDate = (submission as any).bilan_date ?? new Date().toISOString().slice(0, 10)
    await syncProfileFromResponses(db, submission.client_id, submission.coach_id, body.responses as any, bilanDate, submission.id)

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
    await db.from("coach_notifications").insert({
      coach_id: submission.coach_id,
      client_id: submission.client_id,
      category: "assessment",
      subcategory: "assessment_completed",
      priority: 3,
      status: "pending",
      email_sent: false,
      title: "Bilan complété",
      body: `${clientName} a complété le bilan "${templateName}".`,
      payload: {
        assessment_submission_id: submission.id,
        template_name: templateName,
        action_url: `/coach/clients/${submission.client_id}/bilans/${submission.id}`,
      },
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
      const { data: coachProfile } = await db
        .from("coach_profiles")
        .select("notif_bilan_completed")
        .eq("coach_id", submission.coach_id)
        .maybeSingle();

      if (coachEmail && coachProfile?.notif_bilan_completed !== false) {
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

    const progression = await awardProgression(db, {
      clientId: submission.client_id,
      action: 'assessment',
      basePoints: 25,
      sourceKey: `assessment:${submission.id}`,
      referenceId: submission.id,
      metadata: { completed_after_due_date: false },
    });
    pointsEarned = progression?.already_awarded ? 0 : progression?.awarded_points ?? 0;
  }

  return NextResponse.json(
    { success: true, points_earned: pointsEarned },
    { headers: { "Cache-Control": "no-store" } },
  );
}
