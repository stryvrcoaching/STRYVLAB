import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/client";

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  try {
    // Vérifier auth admin (à implémenter selon ton système)
    // const isAdmin = await checkAdminAuth(req);
    // if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  } catch (error: any) {
    console.error("Erreur stats admin:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
