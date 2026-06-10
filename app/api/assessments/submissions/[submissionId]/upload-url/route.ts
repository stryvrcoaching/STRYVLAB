import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const ASSESSMENT_PHOTOS_BUCKET = "assessment-photos";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ensureAssessmentBucket(db: ReturnType<typeof serviceClient>) {
  const { data, error } = await db.storage.getBucket(ASSESSMENT_PHOTOS_BUCKET);
  if (error) {
    return { ok: false, error };
  }
  return { ok: true, data };
}

// POST /api/assessments/submissions/[submissionId]/upload-url
// Génère une signed upload URL pour le coach qui remplit le bilan côté backoffice.
export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const db = serviceClient();

  const { data: submission } = await db
    .from("assessment_submissions")
    .select("id, coach_id, client_id, status")
    .eq("id", params.submissionId)
    .eq("coach_id", user.id)
    .single();

  if (!submission) {
    return NextResponse.json(
      { error: "Soumission introuvable" },
      { status: 404 },
    );
  }

  if (submission.status === "completed" || submission.status === "expired") {
    return NextResponse.json(
      { error: "Ce bilan ne peut plus être modifié" },
      { status: 410 },
    );
  }

  const { field_key, file_extension } = await req.json();

  if (!field_key || !file_extension) {
    return NextResponse.json(
      { error: "field_key et file_extension sont obligatoires" },
      { status: 400 },
    );
  }

  const bucketCheck = await ensureAssessmentBucket(db);
  if (!bucketCheck.ok) {
    console.error("[assessments/submissions/upload-url] Bucket check failed:", {
      bucket: ASSESSMENT_PHOTOS_BUCKET,
      error: bucketCheck.error?.message,
      submissionId: params.submissionId,
    });
    return NextResponse.json(
      {
        error: `Bucket manquant ou inaccessible : ${ASSESSMENT_PHOTOS_BUCKET}`,
      },
      { status: 500 },
    );
  }

  const storagePath = `${submission.coach_id}/${submission.client_id}/${submission.id}/${field_key}.${file_extension}`;

  const { data, error } = await db.storage
    .from(ASSESSMENT_PHOTOS_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error(
      "[assessments/submissions/upload-url] Error generating signed URL:",
      {
        error: error?.message,
        storagePath,
        bucket: "assessment-photos",
        submissionId: params.submissionId,
      },
    );
    const message = error?.message?.includes("not found")
      ? "Stockage non configuré — vérifiez le bucket assessment-photos"
      : "Impossible de générer l'URL — vérifiez la taille du fichier";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    upload_url: data.signedUrl,
    storage_path: storagePath,
  });
}
