import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const BUCKET = "exercise-images";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit for reward images
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté (utilisez JPEG, PNG, WebP ou GIF)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop lourd (max 10 Mo)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    // Place under rewards/ folder in the public bucket to keep it clean
    const path = `rewards/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const db = service();

    const { error: uploadError } = await db.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("[rewards-upload-error]", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = db.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch (err: any) {
    console.error("[rewards-upload-exception]", err);
    return NextResponse.json({ error: err.message || "Erreur interne" }, { status: 500 });
  }
}
