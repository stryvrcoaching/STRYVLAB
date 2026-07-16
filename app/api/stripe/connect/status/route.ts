import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCoachConnectAccount } from "@/lib/stripe/connect";

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    return NextResponse.json(await getCoachConnectAccount(user.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Statut Stripe indisponible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
