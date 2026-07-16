import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { resolveInternalOpsAccess } from "@/lib/auth/internal-ops-access";

export const dynamic = "force-dynamic";

type FeedbackStatus = "pending" | "reviewed" | "exported";
type FeedbackSource = "voice" | "text";

type FeedbackRow = {
  id: string;
  client_id: string;
  meal_id: string | null;
  source: FeedbackSource;
  transcript: string;
  meal_type: string | null;
  parsed_payload: any;
  corrected_payload: any;
  notes: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  coach_clients: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireInternalOpsAccess() {
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  }

  const db = serviceClient();
  const access = await resolveInternalOpsAccess({
    userId: user.id,
    email: user.email,
  });
  if (!access.allowed) {
    return { error: NextResponse.json({ error: "Accès ops refusé" }, { status: 403 }) };
  }

  return { db, userId: user.id, accessMode: access.mode };
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferIssueKeys(row: FeedbackRow): string[] {
  const parsed = row.parsed_payload ?? {};
  const corrected = row.corrected_payload ?? {};
  const parsedItems = Array.isArray(parsed.items) ? parsed.items : [];
  const correctedItems = Array.isArray(corrected.items) ? corrected.items : [];
  const issueKeys = new Set<string>();

  if ((parsed.meal_type ?? null) !== (corrected.meal_type ?? null)) {
    issueKeys.add("meal_type");
  }
  if (parsedItems.length !== correctedItems.length) {
    issueKeys.add("item_count");
  }

  const pairCount = Math.min(parsedItems.length, correctedItems.length);
  for (let index = 0; index < pairCount; index += 1) {
    const before = parsedItems[index] ?? {};
    const after = correctedItems[index] ?? {};
    const beforeName = normalizeName(before.name);
    const afterName = normalizeName(after.name);
    const beforeFoodId = before.food_item_id ?? null;
    const afterFoodId = after.food_item_id ?? null;
    const beforeQty = Number(before.quantity_g) || 0;
    const afterQty = Number(after.quantity_g) || 0;

    if ((beforeFoodId && afterFoodId && beforeFoodId !== afterFoodId) || beforeName !== afterName) {
      issueKeys.add("food_match");
    }
    if (Math.abs(beforeQty - afterQty) >= 5) {
      issueKeys.add("quantity");
    }
    if ((before.category_l1 ?? null) !== (after.category_l1 ?? null)) {
      issueKeys.add("category");
    }
  }

  if (issueKeys.size === 0) {
    issueKeys.add("minor_edit");
  }

  return Array.from(issueKeys);
}

function issueLabel(key: string): string {
  switch (key) {
    case "food_match":
      return "aliment mal resolu";
    case "quantity":
      return "quantite incorrecte";
    case "meal_type":
      return "meal type incorrect";
    case "category":
      return "categorie corrigee";
    case "item_count":
      return "nombre d'aliments incorrect";
    default:
      return "edition mineure";
  }
}

export async function GET() {
  const access = await requireInternalOpsAccess();
  if ("error" in access) return access.error;
  const { db } = access;

  const { data, error } = await db
    .from("nutrition_parse_feedback")
    .select(`
      id,
      client_id,
      meal_id,
      source,
      transcript,
      meal_type,
      parsed_payload,
      corrected_payload,
      notes,
      status,
      created_at,
      updated_at,
      coach_clients!inner(first_name, last_name, email, coach_id)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as any[]).map((row) => {
    const feedback = row as FeedbackRow & {
      coach_clients: { first_name: string | null; last_name: string | null; email: string | null; coach_id: string } | null;
    };
    const metrics = feedback.parsed_payload?.metrics ?? null;
    const issues = inferIssueKeys(feedback);
    return {
      id: feedback.id,
      client_id: feedback.client_id,
      meal_id: feedback.meal_id,
      source: feedback.source,
      transcript: feedback.transcript,
      meal_type: feedback.meal_type,
      parsed_payload: feedback.parsed_payload,
      corrected_payload: feedback.corrected_payload,
      notes: feedback.notes,
      status: feedback.status,
      created_at: feedback.created_at,
      updated_at: feedback.updated_at,
      client_name: [feedback.coach_clients?.first_name, feedback.coach_clients?.last_name].filter(Boolean).join(" ") || "Client",
      client_email: feedback.coach_clients?.email ?? null,
      metrics,
      issues,
    };
  });

  const topIssueMap = new Map<string, number>();
  for (const row of rows) {
    for (const key of row.issues) {
      topIssueMap.set(key, (topIssueMap.get(key) ?? 0) + 1);
    }
  }

  const avgScore = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.metrics?.score ?? 0), 0) / rows.length
    : 0;

  const traceSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: llmTraceRows } = await db
    .from("llm_traces")
    .select("error_type, created_at")
    .gte("created_at", traceSince)
    .not("error_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const llmErrorMap = new Map<string, number>();
  for (const row of llmTraceRows ?? []) {
    const key = String((row as any).error_type ?? "").trim();
    if (!key) continue;
    llmErrorMap.set(key, (llmErrorMap.get(key) ?? 0) + 1);
  }

  return NextResponse.json({
    feedbacks: rows,
    stats: {
      total: rows.length,
      pending: rows.filter((row) => row.status === "pending").length,
      reviewed: rows.filter((row) => row.status === "reviewed").length,
      exported: rows.filter((row) => row.status === "exported").length,
      voice: rows.filter((row) => row.source === "voice").length,
      text: rows.filter((row) => row.source === "text").length,
      averageScore: Math.round(avgScore * 10) / 10,
      topIssues: Array.from(topIssueMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([key, count]) => ({ key, label: issueLabel(key), count })),
    },
    llmTraceStats: {
      windowHours: 24,
      totalErrors: (llmTraceRows ?? []).length,
      topErrorTypes: Array.from(llmErrorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([key, count]) => ({ key, count })),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const access = await requireInternalOpsAccess();
  if ("error" in access) return access.error;
  const { db } = access;

  const body = await req.json().catch(() => null);
  const feedbackId = typeof body?.id === "string" ? body.id : null;
  const status = body?.status as FeedbackStatus | undefined;

  if (!feedbackId || !status || !["pending", "reviewed", "exported"].includes(status)) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const { data: ownedFeedback } = await db
    .from("nutrition_parse_feedback")
    .select("id")
    .eq("id", feedbackId)
    .single();

  if (!ownedFeedback) {
    return NextResponse.json({ error: "Feedback introuvable" }, { status: 404 });
  }

  const { data, error } = await db
    .from("nutrition_parse_feedback")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", feedbackId)
    .select("id, status, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
