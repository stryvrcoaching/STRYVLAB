import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const ALLOWED = new Set(["view", "cta_click", "formula_click", "share"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  let body: { event_type?: string; meta?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.event_type;
  if (!eventType || !ALLOWED.has(eventType)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: page } = await supabase
    .from("coach_pages")
    .select("id, coach_id, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? body.meta
      : {};

  // Cap meta size
  const safeMeta = Object.fromEntries(
    Object.entries(meta).slice(0, 8).map(([k, v]) => [
      String(k).slice(0, 40),
      typeof v === "string" ? v.slice(0, 120) : v,
    ]),
  );

  const { error } = await supabase.from("coach_page_events").insert({
    page_id: page.id,
    coach_id: page.coach_id,
    event_type: eventType,
    meta: safeMeta,
  });

  if (error) {
    // Table may not exist yet in some envs — fail soft for public UX
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
