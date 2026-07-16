import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const exerciseSchema = z
  .object({
    name: z.string().optional(),
    sets: z.union([z.number(), z.string()]).optional(),
    reps: z.string().optional(),
    rest_sec: z.union([z.number(), z.string()]).nullable().optional(),
    rir: z.union([z.number(), z.string()]).nullable().optional(),
    image_url: z.string().nullable().optional(),
    dbId: z.string().nullable().optional(),
    id: z.string().optional(),
  })
  .passthrough();

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();

  const { data, error } = await db
    .from("coach_exercise_patterns")
    .delete()
    .match({ id: params.id, coach_id: user.id })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Pattern introuvable ou non autorisé." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: any = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.type === "string") patch.type = body.type;
  if (Array.isArray(body.exercises)) {
    const arrSchema = z.array(exerciseSchema).min(1);
    const parsed = arrSchema.safeParse(body.exercises);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      );
      return NextResponse.json(
        { error: `Invalid exercises: ${issues.join("; ")}` },
        { status: 400 },
      );
    }
    patch.exercises = parsed.data;
  }

  // Debug log: record which fields are being patched and exercises size
  // eslint-disable-next-line no-console
  console.log(
    "PATCH /api/coach/patterns/",
    params.id,
    "- coach:",
    user.id,
    "patchKeys:",
    Object.keys(patch),
    "exCount:",
    Array.isArray(patch.exercises) ? patch.exercises.length : 0,
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("coach_exercise_patterns")
    .update(patch)
    .match({ id: params.id, coach_id: user.id })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
