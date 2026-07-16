import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { extractTemplateBlocks } from "@/lib/assessments/templateSnapshot";
import { isValidPublicAssessmentToken } from "@/lib/assessments/public-response-security";
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

// GET /api/assessments/public/[token] — sans auth, vérifie token + expiry
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const db = serviceClient();
  const rateLimit = await checkPublicRateLimit({
    db,
    req,
    scope: "public_assessment_read",
    subject: params.token,
    maxRequests: 60,
    windowSeconds: 10 * 60,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!isValidPublicAssessmentToken(params.token)) {
    return NextResponse.json(
      { error: "Lien invalide" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: submission, error } = await db
    .from("assessment_submissions")
    .select(
      `
      id, status, filled_by, template_snapshot, token_expires_at,
      client:coach_clients(first_name, last_name)
    `,
    )
    .eq("token", params.token)
    .single();

  if (error || !submission) {
    return NextResponse.json(
      { error: "Lien invalide" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (submission.status === "completed") {
    return NextResponse.json(
      { error: "Ce bilan a déjà été complété" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (submission.status === "expired") {
    return NextResponse.json(
      { error: "Ce lien a expiré" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  const expiresAt = new Date(submission.token_expires_at);
  if (expiresAt < new Date()) {
    // Marquer expired
    await db
      .from("assessment_submissions")
      .update({ status: "expired" })
      .eq("token", params.token);

    return NextResponse.json(
      { error: "Ce lien a expiré" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Marquer in_progress si pending
  if (submission.status === "pending") {
    await db
      .from("assessment_submissions")
      .update({ status: "in_progress" })
      .eq("token", params.token);
  }

  // Fetch existing responses (if any)
  const { data: responses } = await db
    .from("assessment_responses")
    .select(
      "block_id, field_key, value_text, value_number, value_json, storage_path",
    )
    .eq("submission_id", submission.id);

  return NextResponse.json(
    {
      submission: {
        id: submission.id,
        status: submission.status,
        filled_by: submission.filled_by,
        template_snapshot: extractTemplateBlocks(submission.template_snapshot as any),
        client: submission.client,
        responses: responses ?? [],
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
