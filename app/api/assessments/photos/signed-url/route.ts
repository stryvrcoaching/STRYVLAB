import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({ path: z.string().min(1).max(1024) });
const idSchema = z.string().uuid();
const privateHeaders = { "Cache-Control": "private, no-store" };

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/assessments/photos/signed-url
// Body: { path: string }
// Returns: { signedUrl: string }
// Requires coach auth — bucket is private, must sign via service role
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400, headers: privateHeaders });
  }

  const { path } = body.data;
  const parts = path.split("/");
  const [coachId, clientId, submissionId] = parts;
  // Both historical field paths and block-scoped paths exist in stored responses.
  if (
    ![4, 5].includes(parts.length) ||
    parts.some((part) => !part || part === "." || part === ".." || /[%\\\u0000-\u001f]/.test(part)) ||
    ![coachId, clientId, submissionId].every((id) => idSchema.safeParse(id).success)
  ) {
    return NextResponse.json({ error: "Chemin invalide" }, { status: 400, headers: privateHeaders });
  }

  if (coachId !== user.id) {
    return NextResponse.json({ error: "Photo introuvable" }, { status: 404, headers: privateHeaders });
  }

  const db = serviceClient();
  const { data: submission, error: submissionError } = await db
    .from("assessment_submissions")
    .select("id")
    .eq("id", submissionId)
    .eq("coach_id", user.id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (submissionError) {
    return NextResponse.json({ error: "Photos temporairement indisponibles" }, { status: 503, headers: privateHeaders });
  }
  if (!submission) {
    return NextResponse.json({ error: "Photo introuvable" }, { status: 404, headers: privateHeaders });
  }

  const { data, error } = await db
    .storage.from("assessment-photos")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Impossible de générer l'URL" },
      { status: 500, headers: privateHeaders },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl }, { headers: privateHeaders });
}
