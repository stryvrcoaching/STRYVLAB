import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { extractTemplateBlocks } from "@/lib/assessments/templateSnapshot";
import { isValidPublicAssessmentToken } from "@/lib/assessments/public-response-security";
import {
  checkPublicRateLimit,
  rateLimitResponse,
} from "@/lib/security/public-rate-limit";

const ASSESSMENT_PHOTOS_BUCKET = "assessment-photos";
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const uploadRequestSchema = z
  .object({
    block_id: identifierSchema,
    field_key: identifierSchema,
    file_extension: z.enum(["jpg", "jpeg", "png", "webp"]),
  })
  .strict();

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
  const rateLimit = await checkPublicRateLimit({
    db,
    req,
    scope: "public_assessment_upload",
    subject: params.token,
    maxRequests: 20,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  if (!isValidPublicAssessmentToken(params.token)) {
    return NextResponse.json(
      { error: "Lien invalide" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: submission } = await db
    .from("assessment_submissions")
    .select("id, coach_id, client_id, status, token_expires_at, template_snapshot")
    .eq("token", params.token)
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
    return NextResponse.json(
      { error: "Ce lien a expiré" },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsedBody = uploadRequestSchema.safeParse(untrustedBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Paramètres d'upload invalides" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { block_id, field_key, file_extension } = parsedBody.data;
  const photoField = extractTemplateBlocks(submission.template_snapshot as any)
    .find((block) => block.id === block_id)
    ?.fields.find((field) => field.key === field_key && field.visible && field.input_type === "photo_upload");

  if (!photoField) {
    return NextResponse.json(
      { error: "Champ photo invalide" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const bucketCheck = await ensureAssessmentBucket(db);
  if (!bucketCheck.ok) {
    console.error("[assessments/public/upload-url] Bucket check failed:", {
      bucket: ASSESSMENT_PHOTOS_BUCKET,
      error: bucketCheck.error?.message,
    });
    return NextResponse.json(
      { error: "Stockage temporairement indisponible" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const normalizedExtension = file_extension === "jpeg" ? "jpg" : file_extension;
  const storagePath = `${submission.coach_id}/${submission.client_id}/${submission.id}/${block_id}/${field_key}.${normalizedExtension}`;

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
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      upload_url: data.signedUrl,
      storage_path: storagePath,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
