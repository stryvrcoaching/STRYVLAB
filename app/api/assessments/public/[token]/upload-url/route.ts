import { NextRequest, NextResponse } from "next/server";
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

// POST /api/assessments/public/[token]/upload-url — génère une signed upload URL
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const db = serviceClient();

  const { data: submission } = await db
    .from("assessment_submissions")
    .select("id, coach_id, client_id, status, token_expires_at")
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
    return NextResponse.json({ error: "Ce lien a expiré" }, { status: 410 });
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
    console.error("[assessments/public/upload-url] Bucket check failed:", {
      bucket: ASSESSMENT_PHOTOS_BUCKET,
      error: bucketCheck.error?.message,
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
      "[assessments/public/upload-url] Error generating signed URL:",
      {
        error: error?.message,
        storagePath,
        bucket: "assessment-photos",
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
