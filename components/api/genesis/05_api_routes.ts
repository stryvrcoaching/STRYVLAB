export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const { sessionId } = params;
    const { data, error } = await supabase
      .from("ipt_submissions")
      .select("*")
      .eq("session_id", sessionId)
      .eq("is_completed", false)
      .single();
    if (error) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Vérifier timeout (1 heure)
    const lastUpdate = new Date(data.last_updated_at);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const SESSION_TIMEOUT = 3600000; // 1 heure

    if (diffMs > SESSION_TIMEOUT) {
      return NextResponse.json({ error: "Session expired" }, { status: 410 });
    }

    return NextResponse.json({
      sessionId: data.session_id,
      currentModule: data.current_step - 1,
      responses: data.responses,
    });
  } catch (error) {
    console.error("Resume session error:", error);
    return NextResponse.json(
      { error: "Failed to resume session" },
      { status: 500 },
    );
  }
}
