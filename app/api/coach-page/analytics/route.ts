import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: page } = await supabase
    .from("coach_pages")
    .select("id")
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({
      totals: { views: 0, cta_clicks: 0, formula_clicks: 0, shares: 0 },
      last7Days: { views: 0, cta_clicks: 0 },
    });
  }

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("coach_page_events")
    .select("event_type, created_at")
    .eq("page_id", page.id)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({
      totals: { views: 0, cta_clicks: 0, formula_clicks: 0, shares: 0 },
      last7Days: { views: 0, cta_clicks: 0 },
      error: error.message,
    });
  }

  const rows = events ?? [];
  const count = (type: string, since?: string) =>
    rows.filter(
      (e) =>
        e.event_type === type &&
        (!since || new Date(e.created_at).toISOString() >= since),
    ).length;

  return NextResponse.json({
    totals: {
      views: count("view"),
      cta_clicks: count("cta_click"),
      formula_clicks: count("formula_click"),
      shares: count("share"),
    },
    last7Days: {
      views: count("view", since7d),
      cta_clicks: count("cta_click", since7d),
    },
  });
}
