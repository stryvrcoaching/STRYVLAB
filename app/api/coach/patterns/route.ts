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

const exerciseSchema = z.object({
  name: z.string().optional(),
  sets: z.union([z.number(), z.string()]).optional(),
  reps: z.string().optional(),
  rest_sec: z.union([z.number(), z.string()]).nullable().optional(),
  rir: z.union([z.number(), z.string()]).nullable().optional(),
  image_url: z.string().nullable().optional(),
  dbId: z.string().nullable().optional(),
  id: z.string().optional(),
}).passthrough();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["pattern", "circuit"]).default("pattern"),
  exercises: z.array(exerciseSchema).min(1), // require at least one exercise
});

export async function GET(_req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data, error } = await db
    .from("coach_exercise_patterns")
    .select("*")
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    const msg = error.message ?? String(error);
    if (msg.includes("Could not find the table")) {
      return NextResponse.json(
        {
          error:
            "Table 'coach_exercise_patterns' introuvable. Veuillez vérifier que les migrations ont été appliquées et que la variable d'environnement SUPABASE_SERVICE_ROLE_KEY est configurée.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`,
    );
    return NextResponse.json(
      { error: `Validation failed: ${issues.join("; ")}` },
      { status: 400 },
    );
  }

  // Temporary server-side debug log to help QA: show who is saving and how
  // many exercises are included. Remove this after investigation.
  // eslint-disable-next-line no-console
  console.log(
    "POST /api/coach/patterns - coach:",
    user.id,
    "exercises:",
    Array.isArray(parsed.data.exercises) ? parsed.data.exercises.length : 0,
  );

  const db = serviceClient();

  const { data, error } = await db
    .from("coach_exercise_patterns")
    .insert({
      coach_id: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      exercises: parsed.data.exercises,
    })
    .select()
    .single();

  if (error) {
    const msg = error.message ?? String(error);
    if (msg.includes("Could not find the table")) {
      return NextResponse.json(
        {
          error:
            "Table 'coach_exercise_patterns' introuvable. Veuillez vérifier que les migrations ont été appliquées et que la variable d'environnement SUPABASE_SERVICE_ROLE_KEY est configurée.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
