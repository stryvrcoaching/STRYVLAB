import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { validateImageUpload } from "@/lib/security/image-upload";
import { checkDistributedRateLimit, rateLimitResponse } from "@/lib/security/public-rate-limit";

const BUCKET = "meal-photos";
const MAX_MEAL_PHOTO_BYTES = 10 * 1024 * 1024;

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = await resolveClientId(user.id);
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const db = service();
  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: "client_meal_photo_upload",
    subject: clientId,
    maxRequests: 30,
    windowSeconds: 10 * 60,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEAL_PHOTO_BYTES + 128_000) {
    return NextResponse.json({ error: "Fichier trop volumineux" }, { status: 413 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const validation = validateImageUpload({
    file,
    buffer: arrayBuffer,
    maxBytes: MAX_MEAL_PHOTO_BYTES,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const path = `${clientId}/${randomUUID()}.${validation.image.extension}`;
  const buffer = Buffer.from(arrayBuffer);

  const { data: bucket } = await db.storage.getBucket(BUCKET);
  if (!bucket) {
    return NextResponse.json({ error: "Stockage temporairement indisponible" }, { status: 503 });
  }

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: validation.image.mime, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Upload impossible" }, { status: 500 });

  const { data: signed } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Signed URL failed" }, { status: 500 });

  return NextResponse.json(
    { url: signed.signedUrl, storage_path: path },
    { headers: { "Cache-Control": "no-store" } },
  );
}
