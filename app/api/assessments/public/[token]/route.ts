import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET /api/assessments/public/[token] — sans auth, vérifie token + expiry
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const db = serviceClient();

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
    return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  }

  if (submission.status === "completed") {
    return NextResponse.json(
      { error: "Ce bilan a déjà été complété" },
      { status: 410 },
    );
  }

  if (submission.status === "expired") {
    return NextResponse.json({ error: "Ce lien a expiré" }, { status: 410 });
  }

  const expiresAt = new Date(submission.token_expires_at);
  if (expiresAt < new Date()) {
    // Marquer expired
    await db
      .from("assessment_submissions")
      .update({ status: "expired" })
      .eq("token", params.token);

    return NextResponse.json({ error: "Ce lien a expiré" }, { status: 410 });
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

  return NextResponse.json({
    submission: {
      id: submission.id,
      status: submission.status,
      filled_by: submission.filled_by,
      template_snapshot: submission.template_snapshot,
      client: submission.client,
      responses: responses ?? [],
    },
  });
}
