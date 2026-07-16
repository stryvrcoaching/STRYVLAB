import { NextRequest, NextResponse } from "next/server";
import { requireInternalDashboardAccess } from "@/lib/dashboard/internal-access";

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, "genesis_stats");
  if ("error" in access) return access.error;

  try {
    const supabase = access.db;

    // Stats sessions
    const { data: sessions } = await supabase
      .from("ipt_sessions")
      .select("status");

    const stats = {
      total: sessions?.length || 0,
      inProgress:
        sessions?.filter((s: any) => s.status === "in_progress").length || 0,
      completed:
        sessions?.filter((s: any) => s.status === "completed").length || 0,
      abandoned:
        sessions?.filter((s: any) => s.status === "abandoned").length || 0,
    };

    // Stats réponses
    const { count: responsesCount } = await supabase
      .from("ipt_responses")
      .select("id", { count: "exact", head: true });

    // Sessions récentes
    const { data: recentSessions } = await supabase
      .from("ipt_sessions")
      .select(
        `
          id,
          email,
          status,
          progress_percentage,
          started_at,
          last_activity_at,
          user:users(first_name, last_name)
        `,
      )
      .order("started_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      stats,
      responsesCount: responsesCount || 0,
      recentSessions,
    });
  } catch (error) {
    console.error("Erreur stats admin:", error);
    return NextResponse.json({ error: "Impossible de charger les statistiques" }, { status: 500 });
  }
}
