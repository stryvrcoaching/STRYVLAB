
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { resolveClientFromUser } from "@/lib/client/resolve-client";
import { z } from "zod";

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const TEMPLATE_NAME = "__client_live_metrics__";

const bodySchema = z.object({
  submittedAt: z.string().optional(),
  values: z
    .object({
      weight_kg:                   z.number().positive().optional(),
      neck_cm:                     z.number().positive().optional(),
      shoulder_circumference_cm:   z.number().positive().optional(),
      chest_cm:                    z.number().positive().optional(),
      waist_cm:                    z.number().positive().optional(),
      hips_cm:                     z.number().positive().optional(),
      glute_cm:                    z.number().positive().optional(),
      arm_left_cm:                 z.number().positive().optional(),
      arm_right_cm:                z.number().positive().optional(),
      forearm_left_cm:             z.number().positive().optional(),
      forearm_right_cm:            z.number().positive().optional(),
      thigh_left_cm:               z.number().positive().optional(),
      thigh_right_cm:              z.number().positive().optional(),
      calf_left_cm:                z.number().positive().optional(),
      calf_right_cm:               z.number().positive().optional(),
    })
    .refine((v) => Object.values(v).some((x) => x != null), {
      message: "At least one value is required",
    }),
});

async function getOrCreateTemplate(db: ReturnType<typeof svc>, coachId: string) {
  const { data: existing } = await db
    .from("assessment_templates")
    .select("id")
    .eq("coach_id", coachId)
    .eq("name", TEMPLATE_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created } = await db
    .from("assessment_templates")
    .insert({
      coach_id: coachId,
      name: TEMPLATE_NAME,
      description: "Template système — saisie live client",
      template_type: "custom",
      blocks: [{ id: "client_live_block", module: "biometrics", title: "Client live metrics", fields: [] }],
      is_default: false,
    })
    .select("id")
    .single();
  return created?.id as string | undefined;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();
  const client = await resolveClientFromUser(user.id, user.email, db, "id, coach_id");
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const coachId = (client as any).coach_id as string | null;
  if (!coachId) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const submittedAt = parsed.data.submittedAt ?? new Date().toISOString();
  const date = submittedAt.slice(0, 10);

  const templateId = await getOrCreateTemplate(db, coachId);
  if (!templateId) return NextResponse.json({ error: "Template creation failed" }, { status: 500 });

  const { data: existingSub } = await db
    .from("assessment_submissions")
    .select("id")
    .eq("client_id", (client as any).id)
    .eq("template_id", templateId)
    .eq("submitted_at", submittedAt)
    .maybeSingle();

  let submissionId = existingSub?.id as string | undefined;
  if (!submissionId) {
    const { data: createdSub, error: createErr } = await db
      .from("assessment_submissions")
      .insert({
        coach_id: coachId,
        client_id: (client as any).id,
        template_id: templateId,
        template_snapshot: [{ id: "client_live_block", module: "biometrics", label: "Client live metrics", order: 0, fields: [] }],
        status: "completed",
        filled_by: "client",
        submitted_at: submittedAt,
        bilan_date: date,
      })
      .select("id")
      .single();
    if (createErr || !createdSub) {
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }
    submissionId = createdSub.id as string;
  }

  for (const [fieldKey, value] of Object.entries(parsed.data.values)) {
    if (value == null) continue;
    await db.from("assessment_responses").upsert(
      {
        submission_id: submissionId,
        block_id: "client_live_block",
        field_key: fieldKey,
        value_number: value,
      },
      { onConflict: "submission_id,block_id,field_key" },
    );
  }

  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}
